begin;

drop policy if exists "Members leave or managers remove non-owner" on public.jam_members;
revoke delete on table public.jam_members from authenticated;

create function public.remove_jam_participant(target_jam_id uuid, target_user_id uuid)
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

commit;
