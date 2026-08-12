alter table public.push_subscriptions
  add column timezone text null
  check (timezone is null or char_length(timezone) between 1 and 100);

grant insert (timezone) on table public.push_subscriptions to authenticated;
grant update (timezone) on table public.push_subscriptions to authenticated;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table private.push_events (
  id uuid primary key default extensions.gen_random_uuid(),
  event_type text not null check (event_type in (
    'role_assigned',
    'role_removed',
    'setlist_added',
    'setlist_removed',
    'jam_updated',
    'jam_reminder',
    'song_incomplete'
  )),
  actor_user_id uuid references auth.users(id) on delete set null,
  jam_id uuid not null references public.jams(id) on delete cascade,
  song_id uuid references public.songs(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  target_path text not null check (target_path like '/jansession/#/%'),
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);

create index push_events_jam_created_idx
  on private.push_events(jam_id, created_at desc);

create table private.push_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references private.push_events(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.push_subscriptions(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts smallint not null default 0 check (attempts between 0 and 10),
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  response_status integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, subscription_id)
);

create index push_deliveries_claim_idx
  on private.push_deliveries(status, available_at, created_at)
  where status in ('pending', 'processing');

create index push_deliveries_recipient_idx
  on private.push_deliveries(recipient_user_id, created_at desc);

revoke all on table private.push_events from public, anon, authenticated;
revoke all on table private.push_deliveries from public, anon, authenticated;

create function private.cancel_deleted_subscription_deliveries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.push_deliveries
  set status = 'cancelled',
      claimed_at = null,
      updated_at = pg_catalog.now(),
      last_error = 'Push subscription removed'
  where subscription_id = old.id
    and status in ('pending', 'processing');
  return old;
end;
$$;

create trigger cancel_deliveries_before_subscription_delete
before delete on public.push_subscriptions
for each row execute function private.cancel_deleted_subscription_deliveries();

create function private.push_is_suppressed()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(pg_catalog.current_setting('jansession.suppress_push', true), '') = 'on';
$$;

create function private.enqueue_push_event(
  target_event_type text,
  target_actor_user_id uuid,
  target_jam_id uuid,
  target_song_id uuid,
  target_payload jsonb,
  target_path text,
  target_dedupe_key text,
  target_recipient_user_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_event_id uuid;
begin
  if private.push_is_suppressed() or coalesce(pg_catalog.array_length(target_recipient_user_ids, 1), 0) = 0 then
    return null;
  end if;

  if not exists (
    select 1
    from pg_catalog.unnest(target_recipient_user_ids) as recipient(user_id)
    join public.push_subscriptions as subscription on subscription.user_id = recipient.user_id
    where target_actor_user_id is null or recipient.user_id <> target_actor_user_id
  ) then
    return null;
  end if;

  insert into private.push_events (
    event_type,
    actor_user_id,
    jam_id,
    song_id,
    payload,
    target_path,
    dedupe_key
  ) values (
    target_event_type,
    target_actor_user_id,
    target_jam_id,
    target_song_id,
    target_payload,
    target_path,
    target_dedupe_key
  )
  on conflict (dedupe_key) do nothing
  returning id into created_event_id;

  if created_event_id is null then
    return null;
  end if;

  insert into private.push_deliveries (event_id, recipient_user_id, subscription_id)
  select distinct created_event_id, recipient.user_id, subscription.id
  from pg_catalog.unnest(target_recipient_user_ids) as recipient(user_id)
  join public.push_subscriptions as subscription on subscription.user_id = recipient.user_id
  where target_actor_user_id is null or recipient.user_id <> target_actor_user_id
  on conflict (event_id, subscription_id) do nothing;

  return created_event_id;
end;
$$;

create function private.suppress_push_for_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.set_config('jansession.suppress_push', 'on', true);
  return old;
end;
$$;

create trigger suppress_push_before_profile_delete
before delete on public.profiles
for each row execute function private.suppress_push_for_cleanup();

create trigger suppress_push_before_jam_delete
before delete on public.jams
for each row execute function private.suppress_push_for_cleanup();

create trigger suppress_push_before_song_delete
before delete on public.songs
for each row execute function private.suppress_push_for_cleanup();

create or replace function public.remove_jam_participant(target_jam_id uuid, target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  owner_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select jam.creator_id
  into owner_id
  from public.jams as jam
  where jam.id = target_jam_id
  for update;

  if owner_id is null then
    raise exception using errcode = '22023', message = 'Jam not found';
  end if;

  perform 1
  from public.jam_members as member
  where member.jam_id = target_jam_id and member.user_id = target_user_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'Jam member not found';
  end if;

  if actor_id = target_user_id then
    if actor_id = owner_id then
      raise exception using errcode = '42501', message = 'The jam creator cannot leave';
    end if;
  elsif actor_id <> owner_id then
    raise exception using errcode = '42501', message = 'Only the jam creator can remove another member';
  end if;

  perform pg_catalog.set_config('jansession.suppress_push', 'on', true);

  delete from public.role_assignments as assignment
  using public.song_role_slots as slot, public.songs as song
  where assignment.slot_id = slot.id
    and slot.song_id = song.id
    and song.jam_id = target_jam_id
    and assignment.user_id = target_user_id;

  delete from public.role_volunteers as volunteer
  using public.songs as song
  where volunteer.song_id = song.id
    and song.jam_id = target_jam_id
    and volunteer.user_id = target_user_id;

  delete from public.song_preparation as preparation
  using public.songs as song
  where preparation.song_id = song.id
    and song.jam_id = target_jam_id
    and preparation.user_id = target_user_id;

  delete from public.jam_members as member
  where member.jam_id = target_jam_id and member.user_id = target_user_id;

  return true;
end;
$$;

revoke all on function public.remove_jam_participant(uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_jam_participant(uuid, uuid) to authenticated;

create function private.push_role_assignment_inserted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := coalesce(auth.uid(), new.assigned_by);
  target_jam_id uuid;
  target_song_id uuid;
  song_title text;
  instrument_name text;
begin
  if private.push_is_suppressed() or actor_id = new.user_id then
    return new;
  end if;

  select song.jam_id, song.id, song.title, instrument.name
  into target_jam_id, target_song_id, song_title, instrument_name
  from public.song_role_slots as slot
  join public.songs as song on song.id = slot.song_id
  join public.instruments as instrument on instrument.id = slot.instrument_id
  where slot.id = new.slot_id;

  if not found then
    return new;
  end if;

  perform private.enqueue_push_event(
    'role_assigned',
    actor_id,
    target_jam_id,
    target_song_id,
    pg_catalog.jsonb_build_object('songTitle', song_title, 'instrument', instrument_name),
    pg_catalog.format('/jansession/#/jam/%s/song/%s', target_jam_id, target_song_id),
    pg_catalog.format('role-assigned:%s:%s:%s', new.slot_id, new.user_id, new.created_at),
    array[new.user_id]
  );

  return new;
end;
$$;

create function private.push_role_assignment_deleting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_jam_id uuid;
  target_song_id uuid;
  song_title text;
  instrument_name text;
  was_complete boolean := false;
  is_in_setlist boolean := false;
  manager_ids uuid[];
begin
  if private.push_is_suppressed() or actor_id is null then
    return old;
  end if;

  select song.jam_id, song.id, song.title, instrument.name
  into target_jam_id, target_song_id, song_title, instrument_name
  from public.song_role_slots as slot
  join public.songs as song on song.id = slot.song_id
  join public.instruments as instrument on instrument.id = slot.instrument_id
  where slot.id = old.slot_id;

  if not found then
    return old;
  end if;

  select
    exists (select 1 from public.song_role_slots as existing_slot where existing_slot.song_id = target_song_id)
    and not exists (
      select 1
      from public.song_role_slots as required_slot
      left join public.role_assignments as assignment on assignment.slot_id = required_slot.id
      where required_slot.song_id = target_song_id and assignment.slot_id is null
    ),
    exists (select 1 from public.setlist_items as item where item.song_id = target_song_id)
  into was_complete, is_in_setlist;

  if actor_id <> old.user_id then
    perform private.enqueue_push_event(
      'role_removed',
      actor_id,
      target_jam_id,
      target_song_id,
      pg_catalog.jsonb_build_object('songTitle', song_title, 'instrument', instrument_name),
      pg_catalog.format('/jansession/#/jam/%s/song/%s', target_jam_id, target_song_id),
      pg_catalog.format('role-removed:%s:%s:%s', old.slot_id, old.user_id, old.created_at),
      array[old.user_id]
    );
  end if;

  if was_complete and is_in_setlist then
    select pg_catalog.array_agg(member.user_id order by member.user_id)
    into manager_ids
    from public.jam_members as member
    where member.jam_id = target_jam_id
      and member.role in ('organizer', 'co-organizer');

    perform private.enqueue_push_event(
      'song_incomplete',
      actor_id,
      target_jam_id,
      target_song_id,
      pg_catalog.jsonb_build_object('songTitle', song_title, 'instrument', instrument_name),
      pg_catalog.format('/jansession/#/jam/%s/song/%s', target_jam_id, target_song_id),
      pg_catalog.format('song-incomplete:%s:%s:%s', target_song_id, old.slot_id, old.created_at),
      manager_ids
    );
  end if;

  return old;
end;
$$;

create trigger push_after_role_assignment_insert
after insert on public.role_assignments
for each row execute function private.push_role_assignment_inserted();

create trigger push_before_role_assignment_delete
before delete on public.role_assignments
for each row execute function private.push_role_assignment_deleting();

create function private.push_setlist_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.setlist_items;
  actor_id uuid := auth.uid();
  song_title text;
  recipient_ids uuid[];
  target_event_type text;
begin
  if tg_op = 'INSERT' then
    item := new;
  else
    item := old;
  end if;

  if private.push_is_suppressed() or actor_id is null then
    return item;
  end if;

  select song.title into song_title
  from public.songs as song
  where song.id = item.song_id;

  if not found then
    return item;
  end if;

  select pg_catalog.array_agg(distinct assignment.user_id)
  into recipient_ids
  from public.role_assignments as assignment
  join public.song_role_slots as slot on slot.id = assignment.slot_id
  where slot.song_id = item.song_id;

  target_event_type := case when tg_op = 'INSERT' then 'setlist_added' else 'setlist_removed' end;

  perform private.enqueue_push_event(
    target_event_type,
    actor_id,
    item.jam_id,
    item.song_id,
    pg_catalog.jsonb_build_object('songTitle', song_title),
    pg_catalog.format('/jansession/#/jam/%s/setlist', item.jam_id),
    pg_catalog.format('%s:%s', target_event_type, item.id),
    recipient_ids
  );

  return item;
end;
$$;

create trigger push_after_setlist_insert
after insert on public.setlist_items
for each row execute function private.push_setlist_changed();

create trigger push_before_setlist_delete
before delete on public.setlist_items
for each row execute function private.push_setlist_changed();

create function private.cancel_obsolete_reminders(target_jam_id uuid, target_starts_at timestamptz)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.push_deliveries as delivery
  set status = 'cancelled',
      claimed_at = null,
      updated_at = pg_catalog.now(),
      last_error = 'Jam rescheduled before delivery'
  from private.push_events as event
  where event.id = delivery.event_id
    and event.event_type = 'jam_reminder'
    and event.jam_id = target_jam_id
    and (event.payload ->> 'startsAt')::timestamptz is distinct from target_starts_at
    and delivery.status in ('pending', 'processing');
$$;

create function private.push_jam_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  starts_at_changed boolean := new.starts_at is distinct from old.starts_at;
  location_changed boolean := new.location is distinct from old.location;
  address_changed boolean := new.location_address is distinct from old.location_address;
  actor_id uuid := auth.uid();
  recipient_ids uuid[];
begin
  if not (starts_at_changed or location_changed or address_changed) or private.push_is_suppressed() then
    return new;
  end if;

  if starts_at_changed then
    perform private.cancel_obsolete_reminders(new.id, new.starts_at);
  end if;

  select pg_catalog.array_agg(member.user_id order by member.user_id)
  into recipient_ids
  from public.jam_members as member
  where member.jam_id = new.id;

  perform private.enqueue_push_event(
    'jam_updated',
    actor_id,
    new.id,
    null,
    pg_catalog.jsonb_build_object(
      'jamName', new.name,
      'startsAtChanged', starts_at_changed,
      'locationChanged', location_changed,
      'addressChanged', address_changed,
      'oldStartsAt', old.starts_at,
      'startsAt', new.starts_at,
      'location', new.location,
      'locationAddress', new.location_address
    ),
    pg_catalog.format('/jansession/#/jam/%s', new.id),
    pg_catalog.format('jam-updated:%s:%s', new.id, extensions.gen_random_uuid()),
    recipient_ids
  );

  return new;
end;
$$;

create trigger push_after_jam_update
after update of starts_at, location, location_address on public.jams
for each row execute function private.push_jam_updated();

create function private.enqueue_due_jam_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate record;
  created_count integer := 0;
  created_event_id uuid;
begin
  for candidate in
    select jam.id as jam_id,
           jam.name as jam_name,
           jam.starts_at,
           jam.location,
           member.user_id
    from public.jams as jam
    join public.jam_members as member on member.jam_id = jam.id
    where jam.starts_at >= pg_catalog.now() + interval '23 hours 45 minutes'
      and jam.starts_at < pg_catalog.now() + interval '24 hours 15 minutes'
      and exists (
        select 1
        from public.push_subscriptions as subscription
        where subscription.user_id = member.user_id
      )
  loop
    created_event_id := private.enqueue_push_event(
      'jam_reminder',
      null,
      candidate.jam_id,
      null,
      pg_catalog.jsonb_build_object(
        'jamName', candidate.jam_name,
        'startsAt', candidate.starts_at,
        'location', candidate.location
      ),
      pg_catalog.format('/jansession/#/jam/%s', candidate.jam_id),
      pg_catalog.format('jam-reminder:%s:%s:%s', candidate.jam_id, candidate.user_id, candidate.starts_at),
      array[candidate.user_id]
    );
    if created_event_id is not null then
      created_count := created_count + 1;
    end if;
  end loop;

  return created_count;
end;
$$;

create function public.claim_push_deliveries(batch_size integer default 50)
returns table (
  delivery_id uuid,
  event_id uuid,
  event_type text,
  payload jsonb,
  target_path text,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  locale text,
  timezone text,
  attempt smallint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  update private.push_deliveries as stale
  set status = 'pending',
      available_at = pg_catalog.now(),
      claimed_at = null,
      updated_at = pg_catalog.now(),
      last_error = 'Recovered stale claim'
  where stale.status = 'processing'
    and stale.claimed_at < pg_catalog.now() - interval '10 minutes';

  update private.push_deliveries as obsolete
  set status = 'cancelled',
      claimed_at = null,
      updated_at = pg_catalog.now(),
      last_error = 'Event is no longer current'
  from private.push_events as event
  left join public.jams as jam on jam.id = event.jam_id
  where event.id = obsolete.event_id
    and obsolete.status in ('pending', 'processing')
    and (
      jam.id is null
      or not exists (
        select 1
        from public.jam_members as member
        where member.jam_id = event.jam_id
          and member.user_id = obsolete.recipient_user_id
      )
      or (
        event.event_type = 'jam_reminder'
        and (event.payload ->> 'startsAt')::timestamptz is distinct from jam.starts_at
      )
    );

  return query
  with candidates as (
    select delivery.id
    from private.push_deliveries as delivery
    join public.push_subscriptions as subscription on subscription.id = delivery.subscription_id
    where delivery.status = 'pending'
      and delivery.available_at <= pg_catalog.now()
    order by delivery.created_at, delivery.id
    for update of delivery skip locked
    limit greatest(1, least(batch_size, 100))
  ), claimed as (
    update private.push_deliveries as delivery
    set status = 'processing',
        attempts = delivery.attempts + 1,
        claimed_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    from candidates
    where delivery.id = candidates.id
    returning delivery.*
  )
  select claimed.id,
         event.id,
         event.event_type,
         event.payload,
         event.target_path,
         subscription.id,
         subscription.endpoint,
         subscription.p256dh,
         subscription.auth,
         subscription.locale,
         subscription.timezone,
         claimed.attempts
  from claimed
  join private.push_events as event on event.id = claimed.event_id
  join public.push_subscriptions as subscription on subscription.id = claimed.subscription_id;
end;
$$;

create function public.push_delivery_is_current(target_delivery_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_current boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  select exists (
    select 1
    from private.push_deliveries as delivery
    join private.push_events as event on event.id = delivery.event_id
    join public.jams as jam on jam.id = event.jam_id
    join public.jam_members as member
      on member.jam_id = event.jam_id
     and member.user_id = delivery.recipient_user_id
    join public.push_subscriptions as subscription on subscription.id = delivery.subscription_id
    where delivery.id = target_delivery_id
      and delivery.status = 'processing'
      and (
        event.event_type <> 'jam_reminder'
        or (event.payload ->> 'startsAt')::timestamptz = jam.starts_at
      )
  ) into is_current;

  if not is_current then
    update private.push_deliveries
    set status = 'cancelled',
        claimed_at = null,
        updated_at = pg_catalog.now(),
        last_error = 'Event is no longer current'
    where id = target_delivery_id and status = 'processing';
  end if;

  return is_current;
end;
$$;

create function public.finish_push_delivery(
  target_delivery_id uuid,
  outcome text,
  target_response_status integer default null,
  target_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery private.push_deliveries;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  select * into delivery
  from private.push_deliveries
  where id = target_delivery_id
  for update;

  if delivery.id is null or delivery.status <> 'processing' then
    return;
  end if;

  if outcome = 'sent' then
    update private.push_deliveries
    set status = 'sent',
        sent_at = pg_catalog.now(),
        claimed_at = null,
        response_status = target_response_status,
        last_error = null,
        updated_at = pg_catalog.now()
    where id = target_delivery_id;
  elsif outcome = 'expired' then
    update private.push_deliveries
    set status = 'failed',
        claimed_at = null,
        response_status = target_response_status,
        last_error = left(coalesce(target_error, 'Push subscription expired'), 500),
        updated_at = pg_catalog.now()
    where id = target_delivery_id;

    update private.push_deliveries
    set status = 'failed',
        claimed_at = null,
        response_status = target_response_status,
        last_error = left(coalesce(target_error, 'Push subscription expired'), 500),
        updated_at = pg_catalog.now()
    where subscription_id = delivery.subscription_id
      and status in ('pending', 'processing');

    delete from public.push_subscriptions
    where id = delivery.subscription_id;
  elsif outcome = 'temporary' and delivery.attempts < 5 then
    update private.push_deliveries
    set status = 'pending',
        available_at = pg_catalog.now() + pg_catalog.make_interval(
          secs => least(3600, (30 * pg_catalog.power(2, delivery.attempts - 1))::integer)
        ),
        claimed_at = null,
        response_status = target_response_status,
        last_error = left(coalesce(target_error, 'Temporary push failure'), 500),
        updated_at = pg_catalog.now()
    where id = target_delivery_id;
  else
    update private.push_deliveries
    set status = 'failed',
        claimed_at = null,
        response_status = target_response_status,
        last_error = left(coalesce(target_error, 'Permanent push failure'), 500),
        updated_at = pg_catalog.now()
    where id = target_delivery_id;
  end if;
end;
$$;

create function private.invoke_push_dispatcher()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  secret_key text;
  request_id bigint;
begin
  select secret.decrypted_secret into project_url
  from vault.decrypted_secrets as secret
  where secret.name = 'jansession_project_url'
  limit 1;

  select secret.decrypted_secret into secret_key
  from vault.decrypted_secrets as secret
  where secret.name = 'jansession_secret_key'
  limit 1;

  if project_url is null or secret_key is null then
    return null;
  end if;

  select net.http_post(
    url := pg_catalog.rtrim(project_url, '/') || '/functions/v1/dispatch-push',
    headers := pg_catalog.jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', secret_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function private.push_is_suppressed() from public, anon, authenticated;
revoke all on function private.cancel_deleted_subscription_deliveries() from public, anon, authenticated;
revoke all on function private.enqueue_push_event(text, uuid, uuid, uuid, jsonb, text, text, uuid[]) from public, anon, authenticated;
revoke all on function private.suppress_push_for_cleanup() from public, anon, authenticated;
revoke all on function private.push_role_assignment_inserted() from public, anon, authenticated;
revoke all on function private.push_role_assignment_deleting() from public, anon, authenticated;
revoke all on function private.push_setlist_changed() from public, anon, authenticated;
revoke all on function private.cancel_obsolete_reminders(uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.push_jam_updated() from public, anon, authenticated;
revoke all on function private.enqueue_due_jam_reminders() from public, anon, authenticated;
revoke all on function private.invoke_push_dispatcher() from public, anon, authenticated;

revoke all on function public.claim_push_deliveries(integer) from public, anon, authenticated;
revoke all on function public.push_delivery_is_current(uuid) from public, anon, authenticated;
revoke all on function public.finish_push_delivery(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.claim_push_deliveries(integer) to service_role;
grant execute on function public.push_delivery_is_current(uuid) to service_role;
grant execute on function public.finish_push_delivery(uuid, text, integer, text) to service_role;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'jansession-enqueue-push-reminders';
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
  perform cron.schedule(
    'jansession-enqueue-push-reminders',
    '*/5 * * * *',
    'select private.enqueue_due_jam_reminders()'
  );

  select jobid into existing_job_id from cron.job where jobname = 'jansession-dispatch-push';
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
  perform cron.schedule(
    'jansession-dispatch-push',
    '* * * * *',
    'select private.invoke_push_dispatcher()'
  );
end;
$$;
