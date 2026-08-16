import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const repository = readFileSync(new URL('./discoverRepository.ts', import.meta.url), 'utf8')
const discoverPage = readFileSync(new URL('../pages/DiscoverPage.tsx', import.meta.url), 'utf8')
const detailPage = readFileSync(new URL('../pages/PublicJamPage.tsx', import.meta.url), 'utf8')
const musiciansPage = readFileSync(new URL('../pages/MusiciansPage.tsx', import.meta.url), 'utf8')

describe('Discover UI architecture', () => {
  it('keeps the public repository separate from AppData and direct table reads', () => {
    expect(repository).not.toMatch(/AppData|loadSupabaseData|\.from\(/)
    expect(repository).toContain("rpc('discover_jams'")
    expect(repository).toContain("rpc('get_public_jam'")
  })

  it('provides search, a distinct public detail and join request states', () => {
    expect(discoverPage).toContain("discoverRepository.search")
    expect(discoverPage).toContain('geocodePlace(query, language)')
    expect(repository).toContain('geocode_candidate_id: candidateId')
    expect(detailPage).toContain('discoverRepository.getPublicJam')
    expect(detailPage).toContain('discoverRepository.requestToJoin')
    expect(detailPage).toContain("requestStatus === 'accepted'")
    expect(detailPage).toContain("requestStatus === 'pending'")
  })

  it('shows manager requests in Musicians without widening profile reads', () => {
    expect(musiciansPage).toContain('<JoinRequestsSection jamId={jamId} />')
    expect(repository).toContain("rpc('list_jam_join_requests'")
    expect(repository).not.toMatch(/from\('profiles'\)|from\('profile_instruments'\)/)
  })
})
