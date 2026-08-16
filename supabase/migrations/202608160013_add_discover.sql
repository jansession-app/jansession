create extension if not exists pg_trgm with schema extensions;

alter table public.jams
  add column public_area text null,
  add column accepting_members boolean not null default true,
  add constraint jams_public_area_length
    check (public_area is null or pg_catalog.char_length(pg_catalog.btrim(public_area)) between 2 and 180),
  add constraint jams_public_area_required_when_public
    check (
      visibility <> 'public'::public.jam_visibility
      or public_area is not null
    );

create index jams_public_area_trgm_idx
  on public.jams
  using gin ((pg_catalog.lower(public_area)) extensions.gin_trgm_ops)
  where visibility = 'public'::public.jam_visibility;

create type public.jam_join_request_status as enum ('pending', 'accepted', 'rejected');

create table public.jam_wanted_instruments (
  jam_id uuid not null references public.jams(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (jam_id, instrument_id)
);

create table public.jam_join_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  jam_id uuid not null references public.jams(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  status public.jam_join_request_status not null default 'pending',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  unique (jam_id, requester_id),
  constraint jam_join_request_decision_consistent check (
    (status = 'pending' and decided_at is null and decided_by is null)
    or (status in ('accepted', 'rejected') and decided_at is not null)
  )
);

create index jam_join_requests_jam_status_idx
  on public.jam_join_requests(jam_id, status, created_at);

alter table public.jam_wanted_instruments enable row level security;
alter table public.jam_join_requests enable row level security;

create policy "Members read wanted instruments"
on public.jam_wanted_instruments
for select to authenticated
using (private.is_jam_member(jam_id));

create policy "Managers add wanted instruments"
on public.jam_wanted_instruments
for insert to authenticated
with check (private.can_manage_jam(jam_id));

create policy "Managers remove wanted instruments"
on public.jam_wanted_instruments
for delete to authenticated
using (private.can_manage_jam(jam_id));

create policy "Requesters read own join request"
on public.jam_join_requests
for select to authenticated
using (requester_id = auth.uid());

revoke all on table public.jam_wanted_instruments from public, anon, authenticated;
grant select, insert, delete on table public.jam_wanted_instruments to authenticated;

revoke all on table public.jam_join_requests from public, anon, authenticated;
grant select (id, jam_id, requester_id, status, created_at, updated_at, decided_at)
on table public.jam_join_requests to authenticated;

grant update (visibility, public_area, accepting_members) on table public.jams to authenticated;

create function private.sync_jam_visibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.visibility = 'link'::public.jam_visibility
     and new.visibility <> 'link'::public.jam_visibility then
    update public.jam_invites as invite
    set revoked_at = pg_catalog.now()
    where invite.jam_id = new.id
      and invite.revoked_at is null;
  elsif old.visibility <> 'link'::public.jam_visibility
        and new.visibility = 'link'::public.jam_visibility then
    insert into public.jam_invites (
      token,
      jam_id,
      created_by,
      expires_at,
      revoked_at,
      created_at
    ) values (
      public.make_invite_token(),
      new.id,
      new.creator_id,
      null,
      null,
      pg_catalog.now()
    )
    on conflict (jam_id) do update
    set token = excluded.token,
        created_by = excluded.created_by,
        expires_at = null,
        revoked_at = null,
        created_at = pg_catalog.now();
  end if;

  if old.visibility = 'public'::public.jam_visibility
     and new.visibility <> 'public'::public.jam_visibility then
    update public.jam_join_requests as request
    set status = 'rejected'::public.jam_join_request_status,
        decided_at = pg_catalog.now(),
        decided_by = auth.uid(),
        updated_at = pg_catalog.now()
    where request.jam_id = new.id
      and request.status = 'pending'::public.jam_join_request_status;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_jam_visibility() from public, anon, authenticated;

create trigger sync_jam_visibility_before_update
before update of visibility on public.jams
for each row
execute function private.sync_jam_visibility();

create or replace function public.get_jam_invite_preview(invite_token text)
returns table (id uuid, name text, starts_at timestamptz, location text, token text)
language sql
stable
security definer
set search_path = ''
as $$
  select jam.id,
         jam.name,
         jam.starts_at,
         jam.location,
         invite.token
  from public.jam_invites as invite
  join public.jams as jam on jam.id = invite.jam_id
  where invite.token = pg_catalog.upper($1)
    and jam.visibility = 'link'::public.jam_visibility
    and invite.revoked_at is null
    and (invite.expires_at is null or invite.expires_at > pg_catalog.now());
$$;

create or replace function public.accept_jam_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_jam_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select invite.jam_id
  into target_jam_id
  from public.jam_invites as invite
  join public.jams as jam on jam.id = invite.jam_id
  where invite.token = pg_catalog.upper($1)
    and jam.visibility = 'link'::public.jam_visibility
    and invite.revoked_at is null
    and (invite.expires_at is null or invite.expires_at > pg_catalog.now())
  for update of invite;

  if target_jam_id is null then
    raise exception using errcode = '22023', message = 'Invalid or expired invite';
  end if;

  insert into public.jam_members (jam_id, user_id, role)
  values (target_jam_id, auth.uid(), 'musician'::public.jam_member_role)
  on conflict (jam_id, user_id) do nothing;

  return target_jam_id;
end;
$$;

create function public.discover_jams(
  search_text text,
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
  request_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_search text := pg_catalog.btrim(search_text);
  safe_offset integer := pg_catalog.greatest(0, page_offset);
  safe_limit integer := pg_catalog.greatest(1, pg_catalog.least(page_limit, 30));
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if normalized_search is null or pg_catalog.char_length(normalized_search) < 2 or pg_catalog.char_length(normalized_search) > 80 then
    raise exception using errcode = '22023', message = 'Search text must contain between 2 and 80 characters';
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
             and request.requester_id = auth.uid()
         ), case when private.is_jam_member(jam.id, auth.uid()) then 'accepted' end)
  from public.jams as jam
  where jam.visibility = 'public'::public.jam_visibility
    and jam.public_area is not null
    and pg_catalog.char_length(pg_catalog.btrim(jam.public_area)) >= 2
    and jam.starts_at > pg_catalog.now()
    and pg_catalog.lower(jam.public_area) like '%' || pg_catalog.lower(normalized_search) || '%'
  order by jam.starts_at asc, jam.id asc
  offset safe_offset
  limit safe_limit;
end;
$$;

create function public.get_public_jam(target_jam_id uuid)
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
  public_songs jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
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
             and request.requester_id = auth.uid()
         ), case when private.is_jam_member(jam.id, auth.uid()) then 'accepted' end),
         coalesce((
           select pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object(
               'title', song.title,
               'artist', song.artist,
               'roles', coalesce((
                 select pg_catalog.jsonb_agg(instrument.name order by slot.position, instrument.name)
                 from public.song_role_slots as slot
                 join public.instruments as instrument on instrument.id = slot.instrument_id
                 where slot.song_id = song.id
               ), '[]'::jsonb)
             )
             order by song.created_at, song.id
           )
           from public.songs as song
           where song.jam_id = jam.id
         ), '[]'::jsonb)
  from public.jams as jam
  where jam.id = target_jam_id
    and jam.visibility = 'public'::public.jam_visibility
    and jam.public_area is not null
    and pg_catalog.char_length(pg_catalog.btrim(jam.public_area)) >= 2;
end;
$$;

create function public.request_to_join_jam(target_jam_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_jam public.jams%rowtype;
  existing_request public.jam_join_requests%rowtype;
  created_request_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select jam.*
  into target_jam
  from public.jams as jam
  where jam.id = target_jam_id
  for update;

  if not found
     or target_jam.visibility <> 'public'::public.jam_visibility
     or target_jam.public_area is null then
    raise exception using errcode = '22023', message = 'Jam is not public';
  end if;
  if not target_jam.accepting_members then
    raise exception using errcode = '22023', message = 'Join requests are closed';
  end if;
  if private.is_jam_member(target_jam_id, actor_id) then
    raise exception using errcode = '23505', message = 'User is already a member';
  end if;

  select request.*
  into existing_request
  from public.jam_join_requests as request
  where request.jam_id = target_jam_id
    and request.requester_id = actor_id
  for update;

  if found then
    if existing_request.status in ('pending', 'accepted') then
      raise exception using errcode = '23505', message = 'Join request already exists';
    end if;

    update public.jam_join_requests as request
    set status = 'pending'::public.jam_join_request_status,
        updated_at = pg_catalog.now(),
        decided_at = null,
        decided_by = null
    where request.id = existing_request.id;
    return existing_request.id;
  end if;

  insert into public.jam_join_requests (jam_id, requester_id)
  values (target_jam_id, actor_id)
  returning id into created_request_id;

  return created_request_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'Join request already exists';
end;
$$;

create function public.list_jam_join_requests(target_jam_id uuid)
returns table (
  request_id uuid,
  display_name text,
  instruments text[],
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.can_manage_jam(target_jam_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'Manager access required';
  end if;

  return query
  select request.id,
         coalesce(profile.display_name, ''),
         coalesce(pg_catalog.array_agg(instrument.name order by instrument.name)
           filter (where instrument.name is not null), '{}'::text[]),
         request.created_at
  from public.jam_join_requests as request
  join public.profiles as profile on profile.id = request.requester_id
  left join public.profile_instruments as profile_instrument on profile_instrument.profile_id = profile.id
  left join public.instruments as instrument on instrument.id = profile_instrument.instrument_id
  where request.jam_id = target_jam_id
    and request.status = 'pending'::public.jam_join_request_status
  group by request.id, profile.display_name, request.created_at
  order by request.created_at asc, request.id asc;
end;
$$;

create function public.accept_jam_join_request(target_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_request public.jam_join_requests%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select request.*
  into target_request
  from public.jam_join_requests as request
  where request.id = target_request_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'Join request not found';
  end if;
  if not private.can_manage_jam(target_request.jam_id, actor_id) then
    raise exception using errcode = '42501', message = 'Manager access required';
  end if;
  if target_request.status <> 'pending'::public.jam_join_request_status then
    raise exception using errcode = '22023', message = 'Join request is not pending';
  end if;

  insert into public.jam_members (jam_id, user_id, role)
  values (target_request.jam_id, target_request.requester_id, 'musician'::public.jam_member_role)
  on conflict (jam_id, user_id) do nothing;

  update public.jam_join_requests as request
  set status = 'accepted'::public.jam_join_request_status,
      decided_at = pg_catalog.now(),
      decided_by = actor_id,
      updated_at = pg_catalog.now()
  where request.id = target_request.id;

  return target_request.jam_id;
end;
$$;

create function public.reject_jam_join_request(target_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_request public.jam_join_requests%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select request.*
  into target_request
  from public.jam_join_requests as request
  where request.id = target_request_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'Join request not found';
  end if;
  if not private.can_manage_jam(target_request.jam_id, actor_id) then
    raise exception using errcode = '42501', message = 'Manager access required';
  end if;
  if target_request.status <> 'pending'::public.jam_join_request_status then
    raise exception using errcode = '22023', message = 'Join request is not pending';
  end if;

  update public.jam_join_requests as request
  set status = 'rejected'::public.jam_join_request_status,
      decided_at = pg_catalog.now(),
      decided_by = actor_id,
      updated_at = pg_catalog.now()
  where request.id = target_request.id;

  return target_request.jam_id;
end;
$$;

create function public.set_jam_wanted_instruments(
  target_jam_id uuid,
  target_instrument_names text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.can_manage_jam(target_jam_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'Manager access required';
  end if;

  delete from public.jam_wanted_instruments as wanted
  where wanted.jam_id = target_jam_id;

  insert into public.instruments (name, is_standard)
  select distinct pg_catalog.btrim(candidate.name), false
  from pg_catalog.unnest(coalesce(target_instrument_names, '{}'::text[])) as candidate(name)
  where pg_catalog.char_length(pg_catalog.btrim(candidate.name)) between 1 and 50
  on conflict (name) do nothing;

  insert into public.jam_wanted_instruments (jam_id, instrument_id)
  select target_jam_id, instrument.id
  from public.instruments as instrument
  where instrument.name in (
    select distinct pg_catalog.btrim(candidate.name)
    from pg_catalog.unnest(coalesce(target_instrument_names, '{}'::text[])) as candidate(name)
    where pg_catalog.char_length(pg_catalog.btrim(candidate.name)) between 1 and 50
  )
  on conflict (jam_id, instrument_id) do nothing;
end;
$$;

revoke all on function public.get_jam_invite_preview(text) from public, anon, authenticated;
grant execute on function public.get_jam_invite_preview(text) to anon, authenticated;

revoke all on function public.accept_jam_invite(text) from public, anon, authenticated;
grant execute on function public.accept_jam_invite(text) to authenticated;

revoke all on function public.discover_jams(text, integer, integer) from public, anon, authenticated;
grant execute on function public.discover_jams(text, integer, integer) to authenticated;

revoke all on function public.get_public_jam(uuid) from public, anon, authenticated;
grant execute on function public.get_public_jam(uuid) to authenticated;

revoke all on function public.request_to_join_jam(uuid) from public, anon, authenticated;
grant execute on function public.request_to_join_jam(uuid) to authenticated;

revoke all on function public.list_jam_join_requests(uuid) from public, anon, authenticated;
grant execute on function public.list_jam_join_requests(uuid) to authenticated;

revoke all on function public.accept_jam_join_request(uuid) from public, anon, authenticated;
grant execute on function public.accept_jam_join_request(uuid) to authenticated;

revoke all on function public.reject_jam_join_request(uuid) from public, anon, authenticated;
grant execute on function public.reject_jam_join_request(uuid) to authenticated;

revoke all on function public.set_jam_wanted_instruments(uuid, text[]) from public, anon, authenticated;
grant execute on function public.set_jam_wanted_instruments(uuid, text[]) to authenticated;
