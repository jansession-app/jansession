alter table private.push_events
  drop constraint push_events_event_type_check,
  add constraint push_events_event_type_check check (event_type in (
    'role_assigned',
    'role_removed',
    'setlist_added',
    'setlist_removed',
    'jam_updated',
    'jam_reminder',
    'song_incomplete',
    'join_request_created',
    'join_request_accepted'
  ));

create function private.cancel_obsolete_join_request_deliveries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending'::public.jam_join_request_status
     and new.status <> 'pending'::public.jam_join_request_status then
    update private.push_deliveries as delivery
    set status = 'cancelled',
        claimed_at = null,
        updated_at = pg_catalog.now(),
        last_error = 'Join request is no longer pending'
    from private.push_events as event
    where event.id = delivery.event_id
      and event.event_type = 'join_request_created'
      and event.payload ->> 'requestId' = new.id::text
      and delivery.status in ('pending', 'processing');
  end if;

  return new;
end;
$$;

create trigger cancel_join_request_deliveries_after_status_change
after update of status on public.jam_join_requests
for each row execute function private.cancel_obsolete_join_request_deliveries();

create or replace function public.request_to_join_jam(target_jam_id uuid)
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
  request_cycle_at timestamptz;
  requester_display_name text;
  manager_user_ids uuid[];
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

  select profile.display_name
  into requester_display_name
  from public.profiles as profile
  where profile.id = actor_id;

  select coalesce(
    pg_catalog.array_agg(distinct member.user_id)
      filter (where member.user_id is not null),
    '{}'::uuid[]
  )
  into manager_user_ids
  from public.jam_members as member
  where member.jam_id = target_jam_id
    and member.role in ('organizer', 'co-organizer');

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
    where request.id = existing_request.id
    returning request.updated_at into request_cycle_at;

    perform private.enqueue_push_event(
      'join_request_created',
      actor_id,
      target_jam_id,
      null,
      pg_catalog.jsonb_build_object(
        'jamName', target_jam.name,
        'requestId', existing_request.id,
        'requesterDisplayName', requester_display_name
      ),
      pg_catalog.format('/jansession/#/jam/%s/musicians', target_jam_id),
      pg_catalog.format('join-request-created:%s:%s', existing_request.id, request_cycle_at),
      manager_user_ids
    );

    return existing_request.id;
  end if;

  insert into public.jam_join_requests (jam_id, requester_id)
  values (target_jam_id, actor_id)
  returning id, updated_at into created_request_id, request_cycle_at;

  perform private.enqueue_push_event(
    'join_request_created',
    actor_id,
    target_jam_id,
    null,
    pg_catalog.jsonb_build_object(
      'jamName', target_jam.name,
      'requestId', created_request_id,
      'requesterDisplayName', requester_display_name
    ),
    pg_catalog.format('/jansession/#/jam/%s/musicians', target_jam_id),
    pg_catalog.format('join-request-created:%s:%s', created_request_id, request_cycle_at),
    manager_user_ids
  );

  return created_request_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'Join request already exists';
end;
$$;

create or replace function public.accept_jam_join_request(target_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_request public.jam_join_requests%rowtype;
  target_jam_name text;
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

  select jam.name
  into target_jam_name
  from public.jams as jam
  where jam.id = target_request.jam_id;

  insert into public.jam_members (jam_id, user_id, role)
  values (target_request.jam_id, target_request.requester_id, 'musician'::public.jam_member_role)
  on conflict (jam_id, user_id) do nothing;

  update public.jam_join_requests as request
  set status = 'accepted'::public.jam_join_request_status,
      decided_at = pg_catalog.now(),
      decided_by = actor_id,
      updated_at = pg_catalog.now()
  where request.id = target_request.id;

  perform private.enqueue_push_event(
    'join_request_accepted',
    actor_id,
    target_request.jam_id,
    null,
    pg_catalog.jsonb_build_object(
      'jamName', target_jam_name,
      'requestId', target_request.id
    ),
    pg_catalog.format('/jansession/#/jam/%s', target_request.jam_id),
    pg_catalog.format('join-request-accepted:%s', target_request.id),
    array[target_request.requester_id]
  );

  return target_request.jam_id;
end;
$$;

revoke all on function public.request_to_join_jam(uuid) from public, anon, authenticated;
grant execute on function public.request_to_join_jam(uuid) to authenticated;

revoke all on function public.accept_jam_join_request(uuid) from public, anon, authenticated;
grant execute on function public.accept_jam_join_request(uuid) to authenticated;

revoke all on function private.cancel_obsolete_join_request_deliveries() from public, anon, authenticated;
