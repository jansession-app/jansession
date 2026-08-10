begin;

alter table public.role_assignments replica identity full;
alter table public.role_volunteers replica identity full;
alter table public.song_preparation replica identity full;
alter table public.jam_members replica identity full;
alter table public.songs replica identity full;
alter table public.song_role_slots replica identity full;
alter table public.setlist_items replica identity full;

do $$
declare table_name text;
begin
  foreach table_name in array array['role_assignments','role_volunteers','song_preparation','jam_members','songs','song_role_slots','setlist_items']
  loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

commit;
