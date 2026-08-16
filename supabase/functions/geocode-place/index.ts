import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { isValidPlaceQuery, normalizePlaceQuery, publicCandidates, sanitizeNominatimResults, type GeocodeLocale } from './domain.ts'

const PROVIDER = 'nominatim'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'JanSession/1.0 (+https://jansession-app.github.io/jansession/)'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type CacheRow = { cache_status: string; candidate_id: string | null; display_name: string | null }
type LeaseRow = { outcome: string; lease_token: string | null; retry_after_ms: number }

function jsonResponse(body: Record<string, unknown>, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, ...extraHeaders, 'Content-Type': 'application/json' },
  })
}

function requiredEnvironmentValue(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function serviceRoleKey() {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (legacyKey) return legacyKey
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
  const secretKey = Object.values(keys).find((value) => value.trim())?.trim()
  if (!secretKey) throw new Error('Missing Supabase server key')
  return secretKey
}

function requestBody(value: unknown): { query: string; locale: GeocodeLocale } | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.query !== 'string' || (record.locale !== 'it' && record.locale !== 'en')) return null
  return { query: record.query, locale: record.locale }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const authorization = request.headers.get('Authorization')?.trim()
    if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'Authentication required' }, 401)

    const supabaseUrl = requiredEnvironmentValue('SUPABASE_URL')
    const userClient = createClient(supabaseUrl, requiredEnvironmentValue('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser(authorization.slice(7))
    if (userError || !userData.user) return jsonResponse({ error: 'Authentication required' }, 401)

    const body = requestBody(await request.json().catch(() => null))
    if (!body) return jsonResponse({ error: 'Invalid request' }, 400)
    const normalizedQuery = normalizePlaceQuery(body.query, body.locale)
    if (!isValidPlaceQuery(normalizedQuery)) return jsonResponse({ error: 'Invalid place query' }, 400)

    const admin = createClient(supabaseUrl, serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const cacheArguments = {
      target_provider: PROVIDER,
      target_normalized_query: normalizedQuery,
      target_locale: body.locale,
    }
    const { data: cached, error: cacheError } = await admin.rpc('geocoding_cache_lookup', cacheArguments)
    if (cacheError) throw cacheError
    if ((cached as CacheRow[] | null)?.length) {
      return jsonResponse({ candidates: publicCandidates(cached) })
    }

    const { data: leaseData, error: leaseError } = await admin.rpc('acquire_geocoding_lease', {
      ...cacheArguments,
      target_user_id: userData.user.id,
    })
    if (leaseError) throw leaseError
    const lease = (leaseData as LeaseRow[] | null)?.[0]
    if (!lease) throw new Error('Geocoding lease response is missing')

    if (lease.outcome === 'cache_hit') {
      const { data: racedCache, error: racedCacheError } = await admin.rpc('geocoding_cache_lookup', cacheArguments)
      if (racedCacheError) throw racedCacheError
      return jsonResponse({ candidates: publicCandidates(racedCache) })
    }
    if (lease.outcome !== 'acquired' || !lease.lease_token) {
      const retryAfterSeconds = Math.max(1, Math.ceil((lease.retry_after_ms || 1000) / 1000))
      return jsonResponse({ error: 'Geocoding temporarily unavailable', retry_after_ms: lease.retry_after_ms }, 429, {
        'Retry-After': String(retryAfterSeconds),
      })
    }

    const params = new URLSearchParams({
      q: body.query.normalize('NFKC').trim().replace(/\s+/gu, ' '),
      format: 'jsonv2',
      addressdetails: '1',
      limit: '5',
      'accept-language': body.locale,
    })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    try {
      const providerResponse = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
        headers: { 'User-Agent': USER_AGENT, Referer: 'https://jansession-app.github.io/jansession/' },
        signal: controller.signal,
      })
      if (!providerResponse.ok) throw new Error(`Nominatim returned ${providerResponse.status}`)
      const sanitized = sanitizeNominatimResults(await providerResponse.json())
      const { data: completed, error: completeError } = await admin.rpc('complete_geocoding_request', {
        ...cacheArguments,
        target_lease_token: lease.lease_token,
        target_candidates: sanitized,
      })
      if (completeError) throw completeError
      return jsonResponse({ candidates: publicCandidates(completed) })
    } catch (error: unknown) {
      await admin.rpc('release_geocoding_lease', {
        target_provider: PROVIDER,
        target_normalized_query: normalizedQuery,
        target_locale: body.locale,
        target_lease_token: lease.lease_token,
      })
      throw error
    } finally {
      clearTimeout(timeout)
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown geocoding failure'
    console.error('[geocode-place] Request failed', message)
    return jsonResponse({ error: 'Unable to geocode place' }, 503)
  }
})
