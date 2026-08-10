begin;

create function public.is_jam_member(target_jam_id uuid, target_user_id uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.jam_members where jam_id = target_jam_id and user_id = target_user_id);
$$;

create function public.jam_role(target_jam_id uuid, target_user_id uuid default auth.uid()) returns public.jam_member_role
language sql stable security definer set search_path = public as $$
  select role from public.jam_members where jam_id = target_jam_id and user_id = target_user_id;
$$;

create function public.can_manage_jam(target_jam_id uuid, target_user_id uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.jam_role(target_jam_id, target_user_id) in ('organizer', 'co-organizer'), false);
$$;

create function public.jam_creator(target_jam_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select creator_id from public.jams where id = target_jam_id;
$$;

create function public.shares_jam(other_user_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select other_user_id = auth.uid() or exists (
    select 1 from public.jam_members mine join public.jam_members theirs using (jam_id)
    where mine.user_id = auth.uid() and theirs.user_id = other_user_id
  );
$$;

create function public.song_jam_id(target_song_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select jam_id from public.songs where id = target_song_id;
$$;

create function public.slot_jam_id(target_slot_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select s.jam_id from public.song_role_slots slot join public.songs s on s.id = slot.song_id where slot.id = target_slot_id;
$$;

create function public.user_plays_slot(target_user_id uuid, target_slot_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.song_role_slots slot join public.profile_instruments pi on pi.instrument_id = slot.instrument_id
    where slot.id = target_slot_id and pi.profile_id = target_user_id
  );
$$;

create function public.song_is_playable(target_song_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from public.song_role_slots where song_id = target_song_id)
    and not exists (
      select 1 from public.song_role_slots slot left join public.role_assignments assignment on assignment.slot_id = slot.id
      where slot.song_id = target_song_id and assignment.slot_id is null
    )
    and not exists (
      select 1 from public.role_assignments assignment
      join public.song_role_slots slot on slot.id = assignment.slot_id
      left join public.song_preparation prep on prep.song_id = slot.song_id and prep.user_id = assignment.user_id
      where slot.song_id = target_song_id and coalesce(prep.state::text, 'UNKNOWN') not in ('KNOWS_STRUCTURE', 'READY')
    );
$$;

create function public.get_jam_invite_preview(invite_token text)
returns table (id uuid, name text, starts_at timestamptz, location text, token text)
language sql stable security definer set search_path = public as $$
  select j.id, j.name, j.starts_at, j.location, i.token
  from public.jam_invites i join public.jams j on j.id = i.jam_id
  where i.token = upper(invite_token) and i.revoked_at is null and (i.expires_at is null or i.expires_at > now());
$$;

create function public.accept_jam_invite(invite_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare target_jam_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select jam_id into target_jam_id from public.jam_invites
  where token = upper(invite_token) and revoked_at is null and (expires_at is null or expires_at > now());
  if target_jam_id is null then raise exception 'Invalid or expired invite'; end if;
  insert into public.jam_members (jam_id, user_id, role) values (target_jam_id, auth.uid(), 'musician') on conflict do nothing;
  return target_jam_id;
end;
$$;

create function public.move_setlist_item(target_song_id uuid, direction integer) returns void
language plpgsql security definer set search_path = public as $$
declare current_item public.setlist_items; adjacent_item public.setlist_items;
begin
  if direction not in (-1, 1) then raise exception 'Direction must be -1 or 1'; end if;
  select * into current_item from public.setlist_items where song_id = target_song_id;
  if current_item.id is null or not public.can_manage_jam(current_item.jam_id) then raise exception 'Not allowed'; end if;
  select * into adjacent_item from public.setlist_items where jam_id = current_item.jam_id and position = current_item.position + direction;
  if adjacent_item.id is null then return; end if;
  set constraints setlist_position_unique deferred;
  update public.setlist_items set position = adjacent_item.position where id = current_item.id;
  update public.setlist_items set position = current_item.position where id = adjacent_item.id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.instruments enable row level security;
alter table public.profile_instruments enable row level security;
alter table public.jams enable row level security;
alter table public.jam_members enable row level security;
alter table public.jam_invites enable row level security;
alter table public.songs enable row level security;
alter table public.song_role_slots enable row level security;
alter table public.role_assignments enable row level security;
alter table public.role_volunteers enable row level security;
alter table public.song_preparation enable row level security;
alter table public.setlist_items enable row level security;

create policy "Profiles visible to self and jam peers" on public.profiles for select to authenticated using (public.shares_jam(id));
create policy "Users update their profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Authenticated users read instruments" on public.instruments for select to authenticated using (true);
create policy "Authenticated users add custom instruments" on public.instruments for insert to authenticated with check (is_standard = false);
create policy "Profile instruments visible to jam peers" on public.profile_instruments for select to authenticated using (public.shares_jam(profile_id));
create policy "Users add their instruments" on public.profile_instruments for insert to authenticated with check (profile_id = auth.uid());
create policy "Users remove their instruments" on public.profile_instruments for delete to authenticated using (profile_id = auth.uid());

create policy "Members read jams" on public.jams for select to authenticated using (public.is_jam_member(id));
create policy "Authenticated users create jams" on public.jams for insert to authenticated with check (creator_id = auth.uid());
create policy "Managers update jams" on public.jams for update to authenticated using (public.can_manage_jam(id)) with check (creator_id = public.jam_creator(id));
create policy "Organizer deletes jam" on public.jams for delete to authenticated using (creator_id = auth.uid());

create policy "Members read membership" on public.jam_members for select to authenticated using (public.is_jam_member(jam_id));
create policy "Managers add members" on public.jam_members for insert to authenticated with check (public.can_manage_jam(jam_id));
create policy "Organizer updates non-owner membership" on public.jam_members for update to authenticated using (public.jam_role(jam_id) = 'organizer' and role <> 'organizer') with check (role <> 'organizer');
create policy "Members leave or managers remove non-owner" on public.jam_members for delete to authenticated using ((user_id = auth.uid() and role <> 'organizer') or (public.can_manage_jam(jam_id) and role <> 'organizer'));

create policy "Managers read invites" on public.jam_invites for select to authenticated using (public.can_manage_jam(jam_id));
create policy "Organizer manages invites" on public.jam_invites for all to authenticated using (public.jam_creator(jam_id) = auth.uid()) with check (public.jam_creator(jam_id) = auth.uid());

create policy "Members read songs" on public.songs for select to authenticated using (public.is_jam_member(jam_id));
create policy "Members propose while open" on public.songs for insert to authenticated with check (proposer_id = auth.uid() and public.is_jam_member(jam_id) and (select proposals_open from public.jams where id = jam_id));
create policy "Proposers or managers update songs" on public.songs for update to authenticated using ((proposer_id = auth.uid() and (select proposals_open from public.jams where id = jam_id)) or public.can_manage_jam(jam_id)) with check (public.is_jam_member(jam_id));
create policy "Proposers or managers delete songs" on public.songs for delete to authenticated using ((proposer_id = auth.uid() and (select proposals_open from public.jams where id = jam_id)) or public.can_manage_jam(jam_id));

create policy "Members read role slots" on public.song_role_slots for select to authenticated using (public.is_jam_member(public.song_jam_id(song_id)));
create policy "Proposers or managers add role slots" on public.song_role_slots for insert to authenticated with check (exists (select 1 from public.songs s join public.jams j on j.id = s.jam_id where s.id = song_id and ((s.proposer_id = auth.uid() and j.proposals_open) or public.can_manage_jam(s.jam_id))));
create policy "Proposers or managers update role slots" on public.song_role_slots for update to authenticated using (exists (select 1 from public.songs s join public.jams j on j.id = s.jam_id where s.id = song_id and ((s.proposer_id = auth.uid() and j.proposals_open) or public.can_manage_jam(s.jam_id))));
create policy "Proposers or managers delete role slots" on public.song_role_slots for delete to authenticated using (exists (select 1 from public.songs s join public.jams j on j.id = s.jam_id where s.id = song_id and ((s.proposer_id = auth.uid() and j.proposals_open) or public.can_manage_jam(s.jam_id))));

create policy "Members read assignments" on public.role_assignments for select to authenticated using (public.is_jam_member(public.slot_jam_id(slot_id)));
create policy "Self assignment or manager assignment" on public.role_assignments for insert to authenticated with check (public.is_jam_member(public.slot_jam_id(slot_id)) and (((select assignments_open from public.jams where id = public.slot_jam_id(slot_id)) and user_id = auth.uid() and assigned_by = auth.uid() and public.user_plays_slot(auth.uid(), slot_id)) or (public.can_manage_jam(public.slot_jam_id(slot_id)) and assigned_by = auth.uid())));
create policy "Managers update assignments" on public.role_assignments for update to authenticated using (public.can_manage_jam(public.slot_jam_id(slot_id))) with check (public.can_manage_jam(public.slot_jam_id(slot_id)));
create policy "Self leaves or manager removes" on public.role_assignments for delete to authenticated using (user_id = auth.uid() or public.can_manage_jam(public.slot_jam_id(slot_id)));

create policy "Members read volunteers" on public.role_volunteers for select to authenticated using (public.is_jam_member(public.song_jam_id(song_id)));
create policy "Members volunteer themselves" on public.role_volunteers for insert to authenticated with check (user_id = auth.uid() and public.is_jam_member(public.song_jam_id(song_id)));
create policy "Users remove own volunteer state" on public.role_volunteers for delete to authenticated using (user_id = auth.uid());

create policy "Members read preparation" on public.song_preparation for select to authenticated using (public.is_jam_member(public.song_jam_id(song_id)));
create policy "Users create own preparation" on public.song_preparation for insert to authenticated with check (user_id = auth.uid() and public.is_jam_member(public.song_jam_id(song_id)));
create policy "Users update only own preparation" on public.song_preparation for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users delete only own preparation" on public.song_preparation for delete to authenticated using (user_id = auth.uid());

create policy "Members read setlist" on public.setlist_items for select to authenticated using (public.is_jam_member(jam_id));
create policy "Managers add playable songs" on public.setlist_items for insert to authenticated with check (public.can_manage_jam(jam_id) and public.song_jam_id(song_id) = jam_id and public.song_is_playable(song_id));
create policy "Managers update setlist" on public.setlist_items for update to authenticated using (public.can_manage_jam(jam_id)) with check (public.can_manage_jam(jam_id) and public.song_jam_id(song_id) = jam_id);
create policy "Managers remove setlist items" on public.setlist_items for delete to authenticated using (public.can_manage_jam(jam_id));

grant execute on function public.get_jam_invite_preview(text) to anon, authenticated;
grant execute on function public.accept_jam_invite(text) to authenticated;
grant execute on function public.move_setlist_item(uuid, integer) to authenticated;

commit;
