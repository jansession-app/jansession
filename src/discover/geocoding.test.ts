import { describe, expect, it } from 'vitest'
import { formatDiscoverDistance, uniqueCandidate } from './geocodingDomain'
import { isValidPlaceQuery, normalizePlaceQuery, publicCandidates, sanitizeNominatimResults } from '../../supabase/functions/geocode-place/domain'

describe('geographic Discover domain', () => {
  it('normalizes with NFKC, trims, collapses whitespace, lowercases and preserves accents', () => {
    expect(normalizePlaceQuery('  Ｐoggiardo\n  SÀN  ', 'it')).toBe('poggiardo sàn')
  })

  it('accepts place names from 2 to 80 characters and rejects URLs', () => {
    expect(isValidPlaceQuery('le')).toBe(true)
    expect(isValidPlaceQuery('a')).toBe(false)
    expect(isValidPlaceQuery('a'.repeat(81))).toBe(false)
    expect(isValidPlaceQuery('https://example.com')).toBe(false)
    expect(isValidPlaceQuery('www.example.com')).toBe(false)
  })

  it('sanitizes at most five plausible, unique Nominatim candidates', () => {
    const candidates = sanitizeNominatimResults([
      { osm_type: 'relation', osm_id: 1, display_name: 'Lecce, Puglia, Italia', lat: '40.35', lon: '18.17', raw: 'private' },
      { osm_type: 'relation', osm_id: 1, display_name: 'Duplicate', lat: '40.35', lon: '18.17' },
      { osm_type: 'node', osm_id: 2, display_name: 'Bad', lat: '200', lon: '18.17' },
    ])
    expect(candidates).toEqual([{ provider_result_key: 'relation:1', display_name: 'Lecce, Puglia, Italia', latitude: 40.35, longitude: 18.17 }])
    expect(candidates[0]).not.toHaveProperty('raw')
  })

  it('returns only opaque ids and display names to the browser', () => {
    expect(publicCandidates([{ candidate_id: 'opaque', display_name: 'Lecce', latitude: 40, longitude: 18 }])).toEqual([
      { candidate_id: 'opaque', display_name: 'Lecce' },
    ])
  })

  it('requires an explicit choice only when a query is ambiguous', () => {
    const one = [{ candidateId: 'one', displayName: 'Lecce' }]
    expect(uniqueCandidate(one)).toEqual(one[0])
    expect(uniqueCandidate([...one, { candidateId: 'two', displayName: 'Lecce County' }])).toBeNull()
    expect(uniqueCandidate([])).toBeNull()
  })

  it('formats sub-kilometre and rounded whole-kilometre distances', () => {
    expect(formatDiscoverDistance(999, 'it')).toBe('<1 km')
    expect(formatDiscoverDistance(36_600, 'it')).toBe('37 km')
    expect(formatDiscoverDistance(36_400, 'en')).toBe('36 km')
  })
})
