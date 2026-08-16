import { supabase } from '../lib/supabase'
import type { GeocodeCandidate } from './types'
export { formatDiscoverDistance, uniqueCandidate } from './geocodingDomain'

type GeocodeResponse = {
  candidates?: Array<{ candidate_id?: unknown; display_name?: unknown }>
}

export async function geocodePlace(query: string, locale: 'it' | 'en'): Promise<GeocodeCandidate[]> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.functions.invoke<GeocodeResponse>('geocode-place', {
    body: { query: query.trim(), locale },
  })
  if (error) throw error
  return (data?.candidates ?? []).flatMap((candidate) => (
    typeof candidate.candidate_id === 'string' && typeof candidate.display_name === 'string'
      ? [{ candidateId: candidate.candidate_id, displayName: candidate.display_name }]
      : []
  ))
}
