export type GeocodeLocale = 'it' | 'en'

export type PublicGeocodeCandidate = {
  candidate_id: string
  display_name: string
}

export type NominatimResult = {
  osm_type?: unknown
  osm_id?: unknown
  display_name?: unknown
  lat?: unknown
  lon?: unknown
}

export type StoredGeocodeCandidate = {
  provider_result_key: string
  display_name: string
  latitude: number
  longitude: number
}

export function normalizePlaceQuery(value: string, locale: GeocodeLocale): string {
  const languageTag = locale === 'it' ? 'it-IT' : 'en-GB'
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase(languageTag)
}

export function isValidPlaceQuery(value: string): boolean {
  return value.length >= 2 && value.length <= 80 && !/(?:https?:\/\/|www\.)/iu.test(value)
}

export function sanitizeNominatimResults(value: unknown): StoredGeocodeCandidate[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const candidates: StoredGeocodeCandidate[] = []

  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const result = item as NominatimResult
    const osmType = typeof result.osm_type === 'string' ? result.osm_type.trim() : ''
    const osmId = typeof result.osm_id === 'number' || typeof result.osm_id === 'string' ? String(result.osm_id).trim() : ''
    const displayName = typeof result.display_name === 'string' ? result.display_name.trim() : ''
    const latitude = typeof result.lat === 'string' || typeof result.lat === 'number' ? Number(result.lat) : Number.NaN
    const longitude = typeof result.lon === 'string' || typeof result.lon === 'number' ? Number(result.lon) : Number.NaN
    const providerResultKey = `${osmType}:${osmId}`
    if (!osmType || !osmId || !displayName || displayName.length > 300 || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || seen.has(providerResultKey)) continue
    seen.add(providerResultKey)
    candidates.push({ provider_result_key: providerResultKey, display_name: displayName, latitude, longitude })
    if (candidates.length === 5) break
  }

  return candidates
}

export function publicCandidates(rows: unknown): PublicGeocodeCandidate[] {
  if (!Array.isArray(rows)) return []
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const candidate = row as Record<string, unknown>
    return typeof candidate.candidate_id === 'string' && typeof candidate.display_name === 'string'
      ? [{ candidate_id: candidate.candidate_id, display_name: candidate.display_name }]
      : []
  })
}
