create or replace function public.discover_jams(
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
  safe_offset integer := GREATEST(0, page_offset);
  safe_limit integer := GREATEST(1, LEAST(page_limit, 30));
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

revoke all on function public.discover_jams(text, integer, integer) from public, anon, authenticated;
grant execute on function public.discover_jams(text, integer, integer) to authenticated;
