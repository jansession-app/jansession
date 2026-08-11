begin;

alter table public.jams
  add column location_address text null;

grant update (location_address) on table public.jams to authenticated;

commit;
