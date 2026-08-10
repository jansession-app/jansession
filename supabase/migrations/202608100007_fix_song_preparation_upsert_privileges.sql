begin;

drop policy "Members read preparation" on public.song_preparation;
create policy "Users read own preparation" on public.song_preparation
for select to authenticated using (
  user_id = auth.uid()
  and private.is_jam_member(private.song_jam_id(song_id))
);

revoke update on table public.song_preparation from authenticated;
grant update (song_id, user_id, state) on table public.song_preparation to authenticated;

commit;
