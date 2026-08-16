drop policy "Managers add playable songs" on public.setlist_items;

create policy "Managers add jam songs" on public.setlist_items
for insert to authenticated
with check (
  private.can_manage_jam(jam_id)
  and private.song_jam_id(song_id) = jam_id
);
