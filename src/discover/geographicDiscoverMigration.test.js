import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/202608160016_add_geographic_discover.sql', import.meta.url), 'utf8')
const edge = readFileSync(new URL('../../supabase/functions/geocode-place/index.ts', import.meta.url), 'utf8')
const domain = readFileSync(new URL('../../supabase/functions/geocode-place/domain.ts', import.meta.url), 'utf8')
const config = readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8')
const discoverPage = readFileSync(new URL('../pages/DiscoverPage.tsx', import.meta.url), 'utf8')
const newJamPage = readFileSync(new URL('../pages/NewJamPage.tsx', import.meta.url), 'utf8')
const settingsPage = readFileSync(new URL('../pages/JamSettingsPage.tsx', import.meta.url), 'utf8')

function functionSql(name, signatureStart = `create function public.${name}`) {
  const start = migration.indexOf(signatureStart)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = migration.indexOf('\n$$;', start)
  return migration.slice(start, end + 4)
}

describe('geographic Discover migration and boundary', () => {
  it('installs PostGIS in extensions and stores jam coordinates only in private', () => {
    expect(migration).toContain('create extension if not exists postgis with schema extensions')
    expect(migration).toContain('create table private.jam_public_positions')
    expect(migration).toContain('position extensions.geography(Point, 4326) not null')
    expect(migration).not.toMatch(/alter table public\.jams[\s\S]{0,200}(?:position|latitude|longitude)/i)
  })

  it('never grants browser roles access to coordinates or private cache state', () => {
    for (const table of ['geocoding_cache', 'geocoding_cache_candidates', 'geocoding_provider_state', 'geocoding_cache_misses', 'jam_public_positions']) {
      expect(migration).toContain(`revoke all on table private.${table} from public, anon, authenticated`)
    }
    expect(migration).not.toMatch(/grant (?:select|insert|update|delete|all)[^;]+private\./i)
  })

  it('invalidates the previous position whenever public_area changes', () => {
    const sql = functionSql('invalidate_jam_public_position', 'create function private.invalidate_jam_public_position')
    expect(sql).toContain('old.public_area is distinct from new.public_area')
    expect(sql).toContain('delete from private.jam_public_positions')
    expect(migration).toContain('after update of public_area, visibility on public.jams')
  })

  it('normalizes cache keys and keeps positive and negative TTLs separate', () => {
    expect(functionSql('normalize_place_query', 'create function private.normalize_place_query')).toMatch(/normalize\(value, NFKC\)/)
    expect(migration).toContain('unique (provider, normalized_query, locale)')
    expect(functionSql('complete_geocoding_request')).toContain("interval '24 hours'")
    expect(functionSql('complete_geocoding_request')).toContain("interval '30 days'")
  })

  it('keeps Italian and English cache entries separate for the same query', () => {
    expect(migration).toContain('unique (provider, normalized_query, locale)')
    expect(functionSql('geocoding_cache_lookup')).toContain('cache.locale = target_locale')
    expect(functionSql('acquire_geocoding_lease')).toContain('cache.locale = target_locale')
  })

  it('serializes global provider misses and enforces one external start per second', () => {
    const sql = functionSql('acquire_geocoding_lease')
    expect(sql).toContain('from private.geocoding_provider_state as state')
    expect(sql).toContain('for update')
    expect(sql).toContain("next_request_at = pg_catalog.now() + interval '1 second'")
    expect(sql).toContain("lease_expires_at = pg_catalog.now() + interval '15 seconds'")
    expect(sql).toContain('lease_cache_id = current_cache.id')
    expect(sql.indexOf("current_cache.status in ('ready', 'not_found')")).toBeLessThan(sql.indexOf('geocoding_cache_misses as miss'))
  })

  it('recovers an expired lease instead of blocking indefinitely', () => {
    const sql = functionSql('acquire_geocoding_lease')
    expect(sql).toContain('provider_state.lease_expires_at > pg_catalog.now()')
    expect(sql).toContain("lease_expires_at = pg_catalog.now() + interval '15 seconds'")
    expect(sql).not.toMatch(/pg_sleep|setTimeout|sleep\s*\(/i)
    expect(sql).not.toMatch(/pg_catalog\.extract\s*\(/i)
    expect(sql).toContain('extract(epoch from')
  })

  it('limits provider cache misses per user while leaving cache hits unlimited', () => {
    const sql = functionSql('acquire_geocoding_lease')
    expect(sql).toContain("miss.occurred_at > pg_catalog.now() - interval '1 minute'")
    expect(sql).toContain('if recent_misses >= 10')
    expect(sql).toContain("select 'user_limited'::text")
    expect(sql.indexOf("select 'cache_hit'::text")).toBeLessThan(sql.indexOf('if recent_misses >= 10'))
  })

  it('binds completion and release to the exact cache entry that owns the lease', () => {
    expect(functionSql('complete_geocoding_request')).toContain('active_lease_cache_id is distinct from target_cache_id')
    expect(functionSql('complete_geocoding_request')).toContain('for update')
    expect(functionSql('release_geocoding_lease')).toContain('state.lease_cache_id = (')
  })

  it('lets only service_role execute cache orchestration RPCs', () => {
    for (const name of ['geocoding_cache_lookup', 'acquire_geocoding_lease', 'complete_geocoding_request', 'release_geocoding_lease']) {
      expect(migration).toMatch(new RegExp(`revoke all on function public\\.${name}\\([^;]+ from public, anon, authenticated`))
      expect(migration).toMatch(new RegExp(`grant execute on function public\\.${name}\\([^;]+ to service_role`))
    }
  })

  it('saves public_area and a server-derived candidate position atomically for managers', () => {
    const sql = functionSql('set_jam_public_place')
    expect(sql).toContain('actor_id uuid := auth.uid()')
    expect(sql).toContain('private.can_manage_jam(target_jam_id, actor_id)')
    expect(sql).toContain('cache.normalized_query = normalized_area')
    expect(sql).toContain('set public_area = pg_catalog.btrim(target_public_area)')
    expect(sql).toContain('selected_candidate.position')
    expect(sql).not.toMatch(/latitude|longitude|location_address|\blocation\b/i)
    expect(migration).toContain('grant execute on function public.set_jam_public_place(uuid, text, uuid) to authenticated')
  })

  it('searches within an inclusive 73000m boundary and returns stable nearest-first results', () => {
    const sql = functionSql('discover_jams')
    expect(sql).toContain('extensions.st_dwithin(position.position, search_position, 73000)')
    expect(sql).not.toMatch(/extensions\.st_distance\(position\.position, search_position\)\s*(?:<|<=|>|>=)\s*73000/i)
    expect(sql).toContain('distance_meters bigint')
    expect(sql).toMatch(/order by extensions\.st_distance\(position\.position, search_position\) asc,[\s\S]*jam\.starts_at asc,[\s\S]*jam\.id asc/)
  })

  it('excludes private, link, past and unpositioned jams while public positioned jams remain eligible', () => {
    const sql = functionSql('discover_jams')
    expect(sql).toContain("jam.visibility = 'public'::public.jam_visibility")
    expect(sql).toContain('jam.starts_at > pg_catalog.now()')
    expect(sql).toContain('join private.jam_public_positions as position on position.jam_id = jam.id')
    expect(sql).not.toContain('left join private.jam_public_positions')
  })

  it('does not require or retain a position for private and link jams', () => {
    const invalidation = functionSql('invalidate_jam_public_position', 'create function private.invalidate_jam_public_position')
    expect(invalidation).toContain("new.visibility <> 'public'::public.jam_visibility")
    expect(functionSql('set_jam_public_place')).not.toMatch(/visibility\s*=\s*'public'/i)
  })

  it('includes 72999m and 73000m while excluding values beyond the boundary', () => {
    const withinRadius = (distance) => distance <= 73000
    expect(withinRadius(72999)).toBe(true)
    expect(withinRadius(73000)).toBe(true)
    expect(withinRadius(73000.001)).toBe(false)
  })

  it('preserves the approved public projection and never returns coordinates', () => {
    const sql = functionSql('discover_jams')
    for (const field of ['jam_id uuid', 'name text', 'starts_at timestamptz', 'public_area text', 'accepting_members boolean', 'participant_count bigint', 'song_count bigint', 'wanted_instruments text[]', 'request_status text', 'distance_meters bigint']) {
      expect(sql).toContain(field)
    }
    const returnSignature = sql.slice(sql.indexOf('returns table'), sql.indexOf('\nlanguage plpgsql'))
    expect(returnSignature).not.toMatch(/latitude|longitude|position/i)
    expect(sql).not.toMatch(/location_address|jam_invites|listening_url|role_assignments|song_preparation/i)
  })

  it('leaves legacy text search and existing public jams untouched for rollback', () => {
    expect(migration).toContain('create function public.discover_jams(\n  geocode_candidate_id uuid')
    expect(migration).not.toContain('drop function public.discover_jams(text')
    expect(migration).not.toMatch(/insert into private\.jam_public_positions[\s\S]{0,700}select[\s\S]{0,300}from public\.jams/i)
  })

  it('does not touch push or replace existing join-request and visibility lifecycle functions', () => {
    expect(migration).not.toMatch(/push_events|push_deliveries|dispatch-push|create (?:or replace )?function public\.(?:request_to_join_jam|accept_jam_join_request|reject_jam_join_request)|create (?:or replace )?function private\.sync_jam_visibility/i)
  })
})

describe('geocode-place Edge Function and UI', () => {
  it('requires an authenticated user at gateway and inside the function', () => {
    expect(config).toMatch(/\[functions\.geocode-place\]\nverify_jwt = true/)
    expect(edge).toContain("authorization?.startsWith('Bearer ')")
    expect(edge).toContain('userClient.auth.getUser')
  })

  it('uses only the fixed Nominatim endpoint and approved parameters', () => {
    expect(edge).toContain("https://nominatim.openstreetmap.org/search")
    for (const value of ["format: 'jsonv2'", "addressdetails: '1'", "limit: '5'", "'accept-language': body.locale", "'User-Agent': USER_AGENT"]) expect(edge).toContain(value)
    expect(edge).not.toMatch(/photon|mapbox|googleapis|geolocation|getCurrentPosition/i)
  })

  it('checks private cache and lease before making the external request', () => {
    expect(edge.indexOf("rpc('geocoding_cache_lookup'")).toBeLessThan(edge.indexOf("rpc('acquire_geocoding_lease'"))
    expect(edge.indexOf("rpc('acquire_geocoding_lease'")).toBeLessThan(edge.indexOf('await fetch('))
    expect(edge).toContain('return jsonResponse({ error: \'Geocoding temporarily unavailable\'')
    expect(edge).toContain('429')
  })

  it('never returns coordinates or a raw Nominatim payload to the browser', () => {
    expect(domain).toContain('publicCandidates')
    expect(domain).toContain('{ candidate_id: candidate.candidate_id, display_name: candidate.display_name }')
    expect(edge).not.toMatch(/jsonResponse\([^\n]*(?:latitude|longitude|providerResponse)/i)
  })

  it('uses only candidate ids in geographic search and server-side publication', () => {
    expect(discoverPage).toContain('discoverRepository.search(candidate.candidateId')
    expect(discoverPage).not.toMatch(/navigator\.geolocation|latitude|longitude|radius/i)
    for (const page of [newJamPage, settingsPage]) {
      expect(page).toContain('geocodePlace(publicArea, language)')
      expect(page).toContain('publicPlaceCandidateId')
      expect(page).not.toMatch(/latitude|longitude/)
    }
  })

  it('invalidates an ambiguous selection when the query text changes', () => {
    expect(discoverPage).toContain('setSelectedCandidate(null)')
    expect(discoverPage).toContain('setCandidates([])')
    for (const page of [newJamPage, settingsPage]) {
      expect(page).toContain('setPlaceCandidates([])')
      expect(page).toContain('setPlaceSheetOpen(false)')
    }
  })

  it('shows the required OpenStreetMap attribution under searched results', () => {
    expect(discoverPage).toContain('discover.attributionPrefix')
    expect(discoverPage).toContain('https://www.openstreetmap.org/copyright')
    expect(discoverPage).toContain('OpenStreetMap contributors')
  })
})
