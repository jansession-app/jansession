import type { GeocodeCandidate } from './types'

export function uniqueCandidate(candidates: GeocodeCandidate[]): GeocodeCandidate | null {
  return candidates.length === 1 ? candidates[0]! : null
}

export function formatDiscoverDistance(distanceMeters: number, locale: 'it' | 'en'): string {
  if (distanceMeters < 1000) return '<1 km'
  const formatter = new Intl.NumberFormat(locale === 'it' ? 'it-IT' : 'en-GB', { maximumFractionDigits: 0 })
  return `${formatter.format(Math.round(distanceMeters / 1000))} km`
}
