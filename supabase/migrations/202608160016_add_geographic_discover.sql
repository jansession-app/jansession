create extension if not exists postgis with schema extensions;

create table private.geocoding_cache (
  id uuid primary key default extensions.gen_random_uuid(),
  provider text not null check (provider = 'nominatim'),
  normalized_query text not null,
  locale text not null check (locale in ('it', 'en')),
  status text not null default 'pending' check (status in ('pending', 'ready', 'not_found')),
  expires_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (provider, normalized_query, locale)
);

create table private.geocoding_cache_candidates (
  id uuid primary key default extensions.gen_random_uuid(),
  cache_id uuid not null references private.geocoding_cache(id) on delete cascade,
  provider_result_key text not null,
  display_name text not null check (pg_catalog.char_length(pg_catalog.btrim(display_name)) between 1 and 300),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  position extensions.geography(Point, 4326) not null,
  rank smallint not null check (rank between 1 and 5),
  created_at timestamptz not null default pg_catalog.now(),
  unique (cache_id, provider_result_key),
  unique (cache_id, rank)
);

create table private.geocoding_provider_state (
  provider text primary key check (provider = 'nominatim'),
  lease_token uuid,
  lease_cache_id uuid references private.geocoding_cache(id) on delete set null,
  lease_expires_at timestamptz,
  next_request_at timestamptz not null default '-infinity'::timestamptz,
  updated_at timestamptz not null default pg_catalog.now()
);

insert into private.geocoding_provider_state (provider)
values ('nominatim')
on conflict (provider) do nothing;

create table private.geocoding_cache_misses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default pg_catalog.now()
);

create index geocoding_cache_misses_user_time_idx
  on private.geocoding_cache_misses(user_id, occurred_at desc);

create table private.jam_public_positions (
  jam_id uuid primary key references public.jams(id) on delete cascade,
  candidate_id uuid not null,
  provider text not null check (provider = 'nominatim'),
  normalized_public_area text not null,
  position extensions.geography(Point, 4326) not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index jam_public_positions_position_idx
  on private.jam_public_positions
  using gist (position);

alter table private.geocoding_cache enable row level security;
alter table private.geocoding_cache_candidates enable row level security;
alter table private.geocoding_provider_state enable row level security;
alter table private.geocoding_cache_misses enable row level security;
alter table private.jam_public_positions enable row level security;

revoke all on table private.geocoding_cache from public, anon, authenticated;
revoke all on table private.geocoding_cache_candidates from public, anon, authenticated;
revoke all on table private.geocoding_provider_state from public, anon, authenticated;
revoke all on table private.geocoding_cache_misses from public, anon, authenticated;
revoke all on table private.jam_public_positions from public, anon, authenticated;
revoke all on sequence private.geocoding_cache_misses_id_seq from public, anon, authenticated;

create function private.normalize_place_query(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select pg_catalog.lower(
    pg_catalog.regexp_replace(
      pg_catalog.btrim(normalize(value, NFKC)),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

revoke all on function private.normalize_place_query(text) from public, anon, authenticated;

create function private.invalidate_jam_public_position()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.public_area is distinct from new.public_area
     or new.visibility <> 'public'::public.jam_visibility then
    delete from private.jam_public_positions as position
    where position.jam_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.invalidate_jam_public_position() from public, anon, authenticated;

create trigger invalidate_jam_public_position_after_update
after update of public_area, visibility on public.jams
for each row
execute function private.invalidate_jam_public_position();

create function public.geocoding_cache_lookup(
  target_provider text,
  target_normalized_query text,
  target_locale text
)
returns table (
  cache_status text,
  candidate_id uuid,
  display_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select cache.status,
         candidate.id,
         candidate.display_name
  from private.geocoding_cache as cache
  left join private.geocoding_cache_candidates as candidate
    on candidate.cache_id = cache.id
  where cache.provider = target_provider
    and cache.normalized_query = target_normalized_query
    and cache.locale = target_locale
    and cache.status in ('ready', 'not_found')
    and cache.expires_at > pg_catalog.now()
  order by candidate.rank nulls last;
$$;

create function public.acquire_geocoding_lease(
  target_provider text,
  target_normalized_query text,
  target_locale text,
  target_user_id uuid
)
returns table (
  outcome text,
  lease_token uuid,
  retry_after_ms integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_cache private.geocoding_cache%rowtype;
  provider_state private.geocoding_provider_state%rowtype;
  generated_lease uuid;
  recent_misses bigint;
  wait_ms integer;
begin
  if target_provider <> 'nominatim'
     or target_locale not in ('it', 'en')
     or target_user_id is null
     or target_normalized_query is null
     or pg_catalog.char_length(target_normalized_query) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'Invalid geocoding request';
  end if;

  insert into private.geocoding_cache (provider, normalized_query, locale)
  values (target_provider, target_normalized_query, target_locale)
  on conflict (provider, normalized_query, locale) do nothing;

  select cache.*
  into current_cache
  from private.geocoding_cache as cache
  where cache.provider = target_provider
    and cache.normalized_query = target_normalized_query
    and cache.locale = target_locale
  for update;

  if current_cache.status in ('ready', 'not_found')
     and current_cache.expires_at > pg_catalog.now() then
    return query select 'cache_hit'::text, null::uuid, 0;
    return;
  end if;

  select state.*
  into provider_state
  from private.geocoding_provider_state as state
  where state.provider = target_provider
  for update;

  if provider_state.lease_token is not null
     and provider_state.lease_expires_at > pg_catalog.now() then
    wait_ms := GREATEST(250, pg_catalog.ceil(
      extract(epoch from (provider_state.lease_expires_at - pg_catalog.now())) * 1000
    )::integer);
    return query select 'provider_busy'::text, null::uuid, wait_ms;
    return;
  end if;

  if provider_state.next_request_at > pg_catalog.now() then
    wait_ms := GREATEST(250, pg_catalog.ceil(
      extract(epoch from (provider_state.next_request_at - pg_catalog.now())) * 1000
    )::integer);
    return query select 'provider_busy'::text, null::uuid, wait_ms;
    return;
  end if;

  select pg_catalog.count(*)
  into recent_misses
  from private.geocoding_cache_misses as miss
  where miss.user_id = target_user_id
    and miss.occurred_at > pg_catalog.now() - interval '1 minute';

  if recent_misses >= 10 then
    return query select 'user_limited'::text, null::uuid, 60000;
    return;
  end if;

  generated_lease := extensions.gen_random_uuid();

  insert into private.geocoding_cache_misses (user_id)
  values (target_user_id);

  delete from private.geocoding_cache_misses as miss
  where miss.occurred_at < pg_catalog.now() - interval '1 day';

  update private.geocoding_provider_state as state
  set lease_token = generated_lease,
      lease_cache_id = current_cache.id,
      lease_expires_at = pg_catalog.now() + interval '15 seconds',
      next_request_at = pg_catalog.now() + interval '1 second',
      updated_at = pg_catalog.now()
  where state.provider = target_provider;

  update private.geocoding_cache as cache
  set status = 'pending',
      expires_at = null,
      updated_at = pg_catalog.now()
  where cache.id = current_cache.id;

  return query select 'acquired'::text, generated_lease, 0;
end;
$$;

create function public.complete_geocoding_request(
  target_provider text,
  target_normalized_query text,
  target_locale text,
  target_lease_token uuid,
  target_candidates jsonb
)
returns table (
  candidate_id uuid,
  display_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_cache_id uuid;
  candidate jsonb;
  candidate_count integer := 0;
  candidate_rank integer := 0;
  candidate_latitude double precision;
  candidate_longitude double precision;
  candidate_name text;
  candidate_key text;
  active_lease_cache_id uuid;
begin
  select cache.id
  into target_cache_id
  from private.geocoding_cache as cache
  where cache.provider = target_provider
    and cache.normalized_query = target_normalized_query
    and cache.locale = target_locale
  for update;

  if target_cache_id is null then
    raise exception using errcode = '22023', message = 'Geocoding cache entry not found';
  end if;

  select state.lease_cache_id
  into active_lease_cache_id
  from private.geocoding_provider_state as state
  where state.provider = target_provider
    and state.lease_token = target_lease_token
    and state.lease_expires_at > pg_catalog.now()
  for update;

  if target_lease_token is null
     or active_lease_cache_id is distinct from target_cache_id then
    raise exception using errcode = '42501', message = 'Invalid geocoding lease';
  end if;

  delete from private.geocoding_cache_candidates as stored
  where stored.cache_id = target_cache_id;

  for candidate in
    select item.value
    from pg_catalog.jsonb_array_elements(coalesce(target_candidates, '[]'::jsonb)) with ordinality as item(value, ordinal)
    order by item.ordinal
    limit 5
  loop
    candidate_key := pg_catalog.btrim(candidate->>'provider_result_key');
    candidate_name := pg_catalog.btrim(candidate->>'display_name');
    candidate_latitude := (candidate->>'latitude')::double precision;
    candidate_longitude := (candidate->>'longitude')::double precision;

    if candidate_key is null or candidate_key = ''
       or candidate_name is null or pg_catalog.char_length(candidate_name) not between 1 and 300
       or candidate_latitude not between -90 and 90
       or candidate_longitude not between -180 and 180 then
      raise exception using errcode = '22023', message = 'Invalid geocoding candidate';
    end if;

    candidate_rank := candidate_rank + 1;
    insert into private.geocoding_cache_candidates (
      cache_id,
      provider_result_key,
      display_name,
      latitude,
      longitude,
      position,
      rank
    ) values (
      target_cache_id,
      candidate_key,
      candidate_name,
      candidate_latitude,
      candidate_longitude,
      extensions.st_setsrid(extensions.st_makepoint(candidate_longitude, candidate_latitude), 4326)::extensions.geography,
      candidate_rank
    );
    candidate_count := candidate_count + 1;
  end loop;

  update private.geocoding_cache as cache
  set status = case when candidate_count = 0 then 'not_found' else 'ready' end,
      expires_at = pg_catalog.now() + case when candidate_count = 0 then interval '24 hours' else interval '30 days' end,
      updated_at = pg_catalog.now()
  where cache.id = target_cache_id;

  update private.geocoding_provider_state as state
  set lease_token = null,
      lease_cache_id = null,
      lease_expires_at = null,
      updated_at = pg_catalog.now()
  where state.provider = target_provider
    and state.lease_token = target_lease_token;

  return query
  select stored.id, stored.display_name
  from private.geocoding_cache_candidates as stored
  where stored.cache_id = target_cache_id
  order by stored.rank;
end;
$$;

create function public.release_geocoding_lease(
  target_provider text,
  target_normalized_query text,
  target_locale text,
  target_lease_token uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.geocoding_provider_state as state
  set lease_token = null,
      lease_cache_id = null,
      lease_expires_at = null,
      updated_at = pg_catalog.now()
  where state.provider = target_provider
    and state.lease_token = target_lease_token
    and state.lease_cache_id = (
      select cache.id
      from private.geocoding_cache as cache
      where cache.provider = target_provider
        and cache.normalized_query = target_normalized_query
        and cache.locale = target_locale
    );

  if found then
    update private.geocoding_cache as cache
    set status = 'pending',
        expires_at = null,
        updated_at = pg_catalog.now()
    where cache.provider = target_provider
      and cache.normalized_query = target_normalized_query
      and cache.locale = target_locale;
  end if;
end;
$$;

create function public.set_jam_public_place(
  target_jam_id uuid,
  target_public_area text,
  target_candidate_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_area text := private.normalize_place_query(target_public_area);
  selected_candidate private.geocoding_cache_candidates%rowtype;
begin
  if actor_id is null or not private.can_manage_jam(target_jam_id, actor_id) then
    raise exception using errcode = '42501', message = 'Manager access required';
  end if;
  if normalized_area is null or pg_catalog.char_length(normalized_area) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'Invalid public area';
  end if;

  select candidate.*
  into selected_candidate
  from private.geocoding_cache_candidates as candidate
  join private.geocoding_cache as cache on cache.id = candidate.cache_id
  where candidate.id = target_candidate_id
    and cache.provider = 'nominatim'
    and cache.normalized_query = normalized_area
    and cache.status = 'ready'
    and cache.expires_at > pg_catalog.now();

  if not found then
    raise exception using errcode = '22023', message = 'Geocoding candidate does not match public area';
  end if;

  update public.jams as jam
  set public_area = pg_catalog.btrim(target_public_area)
  where jam.id = target_jam_id;

  if not found then
    raise exception using errcode = '22023', message = 'Jam not found';
  end if;

  insert into private.jam_public_positions (
    jam_id,
    candidate_id,
    provider,
    normalized_public_area,
    position
  ) values (
    target_jam_id,
    selected_candidate.id,
    'nominatim',
    normalized_area,
    selected_candidate.position
  )
  on conflict (jam_id) do update
  set candidate_id = excluded.candidate_id,
      provider = excluded.provider,
      normalized_public_area = excluded.normalized_public_area,
      position = excluded.position,
      updated_at = pg_catalog.now();
end;
$$;

create function public.discover_jams(
  geocode_candidate_id uuid,
  page_offset integer default 0,
  page_limit integer default 30
)
returns table (
  jam_id uuid,
  name text,
  starts_at timestamptz,
  public_area text,
  accepting_members boolean,
  participant_count bigint,
  song_count bigint,
  wanted_instruments text[],
  request_status text,
  distance_meters bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  search_position extensions.geography(Point, 4326);
  safe_offset integer := GREATEST(0, page_offset);
  safe_limit integer := GREATEST(1, LEAST(page_limit, 30));
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select candidate.position
  into search_position
  from private.geocoding_cache_candidates as candidate
  join private.geocoding_cache as cache on cache.id = candidate.cache_id
  where candidate.id = geocode_candidate_id
    and cache.status = 'ready'
    and cache.expires_at > pg_catalog.now();

  if search_position is null then
    raise exception using errcode = '22023', message = 'Invalid or expired geocoding candidate';
  end if;

  return query
  select jam.id,
         jam.name,
         jam.starts_at,
         jam.public_area,
         jam.accepting_members,
         (select pg_catalog.count(*) from public.jam_members as member where member.jam_id = jam.id),
         (select pg_catalog.count(*) from public.songs as song where song.jam_id = jam.id),
         coalesce((
           select pg_catalog.array_agg(instrument.name order by instrument.name)
           from public.jam_wanted_instruments as wanted
           join public.instruments as instrument on instrument.id = wanted.instrument_id
           where wanted.jam_id = jam.id
         ), '{}'::text[]),
         coalesce((
           select request.status::text
           from public.jam_join_requests as request
           where request.jam_id = jam.id
             and request.requester_id = actor_id
         ), case when private.is_jam_member(jam.id, actor_id) then 'accepted' end),
         pg_catalog.round(extensions.st_distance(position.position, search_position))::bigint
  from public.jams as jam
  join private.jam_public_positions as position on position.jam_id = jam.id
  where jam.visibility = 'public'::public.jam_visibility
    and jam.public_area is not null
    and pg_catalog.char_length(pg_catalog.btrim(jam.public_area)) >= 2
    and jam.starts_at > pg_catalog.now()
    and extensions.st_dwithin(position.position, search_position, 73000)
  order by extensions.st_distance(position.position, search_position) asc,
           jam.starts_at asc,
           jam.id asc
  offset safe_offset
  limit safe_limit;
end;
$$;

revoke all on function public.geocoding_cache_lookup(text, text, text) from public, anon, authenticated;
revoke all on function public.acquire_geocoding_lease(text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.complete_geocoding_request(text, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.release_geocoding_lease(text, text, text, uuid) from public, anon, authenticated;

grant execute on function public.geocoding_cache_lookup(text, text, text) to service_role;
grant execute on function public.acquire_geocoding_lease(text, text, text, uuid) to service_role;
grant execute on function public.complete_geocoding_request(text, text, text, uuid, jsonb) to service_role;
grant execute on function public.release_geocoding_lease(text, text, text, uuid) to service_role;

revoke all on function public.set_jam_public_place(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.set_jam_public_place(uuid, text, uuid) to authenticated;

revoke all on function public.discover_jams(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.discover_jams(uuid, integer, integer) to authenticated;
