begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
alter default privileges in schema private revoke execute on functions from public;

create function private.is_jam_member(target_jam_id uuid, target_user_id uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.jam_members
    where jam_id = target_jam_id and user_id = target_user_id
  );
$$;

create function private.jam_role(target_jam_id uuid, target_user_id uuid default auth.uid()) returns public.jam_member_role
language sql stable security definer set search_path = public as $$
  select role from public.jam_members
  where jam_id = target_jam_id and user_id = target_user_id;
$$;

create function private.can_manage_jam(target_jam_id uuid, target_user_id uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public, private as $$
  select coalesce(private.jam_role(target_jam_id, target_user_id) in ('organizer', 'co-organizer'), false);
$$;

create function private.jam_creator(target_jam_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select creator_id from public.jams where id = target_jam_id;
$$;

create function private.shares_jam(other_user_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select other_user_id = auth.uid() or exists (
    select 1
    from public.jam_members mine
    join public.jam_members theirs using (jam_id)
    where mine.user_id = auth.uid() and theirs.user_id = other_user_id
  );
$$;

create function private.song_jam_id(target_song_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select jam_id from public.songs where id = target_song_id;
$$;

create function private.slot_jam_id(target_slot_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select song.jam_id
  from public.song_role_slots slot
  join public.songs song on song.id = slot.song_id
  where slot.id = target_slot_id;
$$;

create function private.user_plays_slot(target_user_id uuid, target_slot_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.song_role_slots slot
    join public.profile_instruments profile_instrument on profile_instrument.instrument_id = slot.instrument_id
    where slot.id = target_slot_id and profile_instrument.profile_id = target_user_id
  );
$$;

create function private.song_is_playable(target_song_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from public.song_role_slots where song_id = target_song_id)
    and not exists (
      select 1
      from public.song_role_slots slot
      left join public.role_assignments assignment on assignment.slot_id = slot.id
      where slot.song_id = target_song_id and assignment.slot_id is null
    )
    and not exists (
      select 1
      from public.role_assignments assignment
      join public.song_role_slots slot on slot.id = assignment.slot_id
      left join public.song_preparation preparation
        on preparation.song_id = slot.song_id and preparation.user_id = assignment.user_id
      where slot.song_id = target_song_id
        and coalesce(preparation.state::text, 'UNKNOWN') not in ('KNOWS_STRUCTURE', 'READY')
    );
$$;

grant execute on function private.is_jam_member(uuid, uuid) to authenticated;
grant execute on function private.jam_role(uuid, uuid) to authenticated;
grant execute on function private.can_manage_jam(uuid, uuid) to authenticated;
grant execute on function private.jam_creator(uuid) to authenticated;
grant execute on function private.shares_jam(uuid) to authenticated;
grant execute on function private.song_jam_id(uuid) to authenticated;
grant execute on function private.slot_jam_id(uuid) to authenticated;
grant execute on function private.user_plays_slot(uuid, uuid) to authenticated;
grant execute on function private.song_is_playable(uuid) to authenticated;

drop policy "Profiles visible to self and jam peers" on public.profiles;
create policy "Profiles visible to self and jam peers" on public.profiles
for select to authenticated using (private.shares_jam(id));

drop policy "Profile instruments visible to jam peers" on public.profile_instruments;
create policy "Profile instruments visible to jam peers" on public.profile_instruments
for select to authenticated using (private.shares_jam(profile_id));

drop policy "Members read jams" on public.jams;
create policy "Members read jams" on public.jams
for select to authenticated using (private.is_jam_member(id));

drop policy "Managers update jams" on public.jams;
create policy "Managers update jams" on public.jams
for update to authenticated
using (private.can_manage_jam(id))
with check (private.can_manage_jam(id) and creator_id = private.jam_creator(id));

drop policy "Members read membership" on public.jam_members;
create policy "Members read membership" on public.jam_members
for select to authenticated using (private.is_jam_member(jam_id));

drop policy "Managers add members" on public.jam_members;

drop policy "Organizer updates non-owner membership" on public.jam_members;
create policy "Organizer updates non-owner membership" on public.jam_members
for update to authenticated
using (private.jam_role(jam_id) = 'organizer' and role <> 'organizer')
with check (private.jam_role(jam_id) = 'organizer' and role <> 'organizer');

drop policy "Members leave or managers remove non-owner" on public.jam_members;
create policy "Members leave or managers remove non-owner" on public.jam_members
for delete to authenticated using (
  (user_id = auth.uid() and role <> 'organizer')
  or (private.jam_role(jam_id) = 'organizer' and role <> 'organizer')
  or (private.jam_role(jam_id) = 'co-organizer' and role = 'musician')
);

drop policy "Managers read invites" on public.jam_invites;
create policy "Managers read invites" on public.jam_invites
for select to authenticated using (private.can_manage_jam(jam_id));

drop policy "Organizer manages invites" on public.jam_invites;
create policy "Organizer manages invites" on public.jam_invites
for all to authenticated
using (private.jam_creator(jam_id) = auth.uid())
with check (private.jam_creator(jam_id) = auth.uid());

drop policy "Members read songs" on public.songs;
create policy "Members read songs" on public.songs
for select to authenticated using (private.is_jam_member(jam_id));

drop policy "Members propose while open" on public.songs;
create policy "Members propose while open" on public.songs
for insert to authenticated with check (
  proposer_id = auth.uid()
  and private.is_jam_member(jam_id)
  and (select jam.proposals_open from public.jams jam where jam.id = jam_id)
);

drop policy "Proposers or managers update songs" on public.songs;
create policy "Proposers or managers update songs" on public.songs
for update to authenticated
using (
  (proposer_id = auth.uid() and (select jam.proposals_open from public.jams jam where jam.id = jam_id))
  or private.can_manage_jam(jam_id)
)
with check (
  private.is_jam_member(jam_id)
  and (
    (proposer_id = auth.uid() and (select jam.proposals_open from public.jams jam where jam.id = jam_id))
    or private.can_manage_jam(jam_id)
  )
);

drop policy "Proposers or managers delete songs" on public.songs;
create policy "Proposers or managers delete songs" on public.songs
for delete to authenticated using (
  (proposer_id = auth.uid() and (select jam.proposals_open from public.jams jam where jam.id = jam_id))
  or private.can_manage_jam(jam_id)
);

drop policy "Members read role slots" on public.song_role_slots;
create policy "Members read role slots" on public.song_role_slots
for select to authenticated using (private.is_jam_member(private.song_jam_id(song_id)));

drop policy "Proposers or managers add role slots" on public.song_role_slots;
create policy "Proposers or managers add role slots" on public.song_role_slots
for insert to authenticated with check (
  exists (
    select 1
    from public.songs song
    join public.jams jam on jam.id = song.jam_id
    where song.id = song_id
      and ((song.proposer_id = auth.uid() and jam.proposals_open) or private.can_manage_jam(song.jam_id))
  )
);

drop policy "Proposers or managers update role slots" on public.song_role_slots;
create policy "Proposers or managers update role slots" on public.song_role_slots
for update to authenticated
using (
  exists (
    select 1
    from public.songs song
    join public.jams jam on jam.id = song.jam_id
    where song.id = song_id
      and ((song.proposer_id = auth.uid() and jam.proposals_open) or private.can_manage_jam(song.jam_id))
  )
)
with check (
  exists (
    select 1
    from public.songs song
    join public.jams jam on jam.id = song.jam_id
    where song.id = song_id
      and ((song.proposer_id = auth.uid() and jam.proposals_open) or private.can_manage_jam(song.jam_id))
  )
);

drop policy "Proposers or managers delete role slots" on public.song_role_slots;
create policy "Proposers or managers delete role slots" on public.song_role_slots
for delete to authenticated using (
  exists (
    select 1
    from public.songs song
    join public.jams jam on jam.id = song.jam_id
    where song.id = song_id
      and ((song.proposer_id = auth.uid() and jam.proposals_open) or private.can_manage_jam(song.jam_id))
  )
);

drop policy "Members read assignments" on public.role_assignments;
create policy "Members read assignments" on public.role_assignments
for select to authenticated using (private.is_jam_member(private.slot_jam_id(slot_id)));

drop policy "Self assignment or manager assignment" on public.role_assignments;
create policy "Self assignment or manager assignment" on public.role_assignments
for insert to authenticated with check (
  private.is_jam_member(private.slot_jam_id(slot_id))
  and assigned_by = auth.uid()
  and (
    (
      (select jam.assignments_open from public.jams jam where jam.id = private.slot_jam_id(slot_id))
      and user_id = auth.uid()
      and private.user_plays_slot(auth.uid(), slot_id)
    )
    or (
      private.can_manage_jam(private.slot_jam_id(slot_id))
      and private.is_jam_member(private.slot_jam_id(slot_id), user_id)
      and private.user_plays_slot(user_id, slot_id)
    )
  )
);

drop policy "Managers update assignments" on public.role_assignments;

drop policy "Self leaves or manager removes" on public.role_assignments;
create policy "Self leaves or manager removes" on public.role_assignments
for delete to authenticated using (
  user_id = auth.uid() or private.can_manage_jam(private.slot_jam_id(slot_id))
);

drop policy "Members read volunteers" on public.role_volunteers;
create policy "Members read volunteers" on public.role_volunteers
for select to authenticated using (private.is_jam_member(private.song_jam_id(song_id)));

drop policy "Members volunteer themselves" on public.role_volunteers;
create policy "Members volunteer themselves" on public.role_volunteers
for insert to authenticated with check (
  user_id = auth.uid() and private.is_jam_member(private.song_jam_id(song_id))
);

drop policy "Members read preparation" on public.song_preparation;
create policy "Members read preparation" on public.song_preparation
for select to authenticated using (private.is_jam_member(private.song_jam_id(song_id)));

drop policy "Users create own preparation" on public.song_preparation;
create policy "Users create own preparation" on public.song_preparation
for insert to authenticated with check (
  user_id = auth.uid() and private.is_jam_member(private.song_jam_id(song_id))
);

drop policy "Users update only own preparation" on public.song_preparation;
create policy "Users update only own preparation" on public.song_preparation
for update to authenticated
using (user_id = auth.uid() and private.is_jam_member(private.song_jam_id(song_id)))
with check (user_id = auth.uid() and private.is_jam_member(private.song_jam_id(song_id)));

drop policy "Users delete only own preparation" on public.song_preparation;
create policy "Users delete only own preparation" on public.song_preparation
for delete to authenticated using (
  user_id = auth.uid() and private.is_jam_member(private.song_jam_id(song_id))
);

drop policy "Members read setlist" on public.setlist_items;
create policy "Members read setlist" on public.setlist_items
for select to authenticated using (private.is_jam_member(jam_id));

drop policy "Managers add playable songs" on public.setlist_items;
create policy "Managers add playable songs" on public.setlist_items
for insert to authenticated with check (
  private.can_manage_jam(jam_id)
  and private.song_jam_id(song_id) = jam_id
  and private.song_is_playable(song_id)
);

drop policy "Managers update setlist" on public.setlist_items;

drop policy "Managers remove setlist items" on public.setlist_items;
create policy "Managers remove setlist items" on public.setlist_items
for delete to authenticated using (private.can_manage_jam(jam_id));

revoke update on table public.profiles from authenticated;
grant update (display_name, onboarding_completed) on table public.profiles to authenticated;

revoke update on table public.jams from authenticated;
grant update (name, starts_at, location, proposals_open, assignments_open) on table public.jams to authenticated;

revoke update on table public.jam_members from authenticated;
grant update (role) on table public.jam_members to authenticated;

revoke update on table public.songs from authenticated;
grant update (title, artist, listening_url, bpm, musical_key, notes) on table public.songs to authenticated;

revoke update on table public.song_role_slots from authenticated;
grant update (instrument_id, position) on table public.song_role_slots to authenticated;

revoke update on table public.role_assignments from authenticated;

revoke update on table public.song_preparation from authenticated;
grant update (state) on table public.song_preparation to authenticated;

revoke update on table public.setlist_items from authenticated;

create or replace function public.move_setlist_item(target_song_id uuid, direction integer) returns void
language plpgsql security definer set search_path = public, private as $$
declare
  current_item public.setlist_items;
  adjacent_item public.setlist_items;
begin
  if direction not in (-1, 1) then raise exception 'Direction must be -1 or 1'; end if;
  select * into current_item from public.setlist_items where song_id = target_song_id for update;
  if current_item.id is null or not private.can_manage_jam(current_item.jam_id) then raise exception 'Not allowed'; end if;
  select * into adjacent_item
  from public.setlist_items
  where jam_id = current_item.jam_id and position = current_item.position + direction
  for update;
  if adjacent_item.id is null then return; end if;
  set constraints setlist_position_unique deferred;
  update public.setlist_items set position = adjacent_item.position where id = current_item.id;
  update public.setlist_items set position = current_item.position where id = adjacent_item.id;
end;
$$;

create function private.compact_setlist_positions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.setlist_items
  set position = position - 1
  where jam_id = old.jam_id and position > old.position;
  return old;
end;
$$;

create trigger compact_setlist_after_delete
after delete on public.setlist_items
for each row execute function private.compact_setlist_positions();

create or replace function public.make_invite_token() returns text
language plpgsql volatile set search_path = public as $$
declare token text;
begin
  loop
    token := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
    exit when not exists (select 1 from public.jam_invites where jam_invites.token = token);
  end loop;
  return token;
end;
$$;

alter function public.set_updated_at() set search_path = public;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  metadata_name text;
begin
  metadata_name := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'full_name',
    ''
  )), '');
  insert into public.profiles (id, display_name)
  values (new.id, left(metadata_name, 60));
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.initialize_jam() from public, anon, authenticated;
revoke all on function public.make_invite_token() from public, anon, authenticated;

revoke all on function public.get_jam_invite_preview(text) from public, anon, authenticated;
grant execute on function public.get_jam_invite_preview(text) to anon, authenticated;

revoke all on function public.accept_jam_invite(text) from public, anon, authenticated;
grant execute on function public.accept_jam_invite(text) to authenticated;

revoke all on function public.move_setlist_item(uuid, integer) from public, anon, authenticated;
grant execute on function public.move_setlist_item(uuid, integer) to authenticated;

drop function public.can_manage_jam(uuid, uuid);
drop function public.jam_role(uuid, uuid);
drop function public.is_jam_member(uuid, uuid);
drop function public.jam_creator(uuid);
drop function public.shares_jam(uuid);
drop function public.song_jam_id(uuid);
drop function public.slot_jam_id(uuid);
drop function public.user_plays_slot(uuid, uuid);
drop function public.song_is_playable(uuid);

commit;
