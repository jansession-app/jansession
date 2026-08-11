import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '../config/brand'
import {
  buildInviteUrl,
  preserveAfterOnboardingRoute,
  preservePendingInviteRoute,
  readInviteToken,
  takeAfterOnboardingRoute,
  takePendingRoute,
} from './inviteFlow'

function createStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

describe('invite URL', () => {
  it('uses the real token returned by the one-to-one Supabase relation', () => {
    const token = readInviteToken({ token: 'ABC123456' })
    expect(buildInviteUrl('https://jansession-app.github.io', '/jansession/', token))
      .toBe('https://jansession-app.github.io/jansession/#/join/ABC123456')
  })

  it('encodes the token as an URL path segment', () => {
    expect(buildInviteUrl('https://example.test', '/jansession/', 'ABC 123'))
      .toBe('https://example.test/jansession/#/join/ABC%20123')
  })

  it('never creates an URL ending with an empty /join/', () => {
    const url = buildInviteUrl('https://jansession-app.github.io', '/jansession/', '   ')
    expect(url).toBeNull()
    expect(url ?? '').not.toMatch(/\/join\/$/)
  })
})

describe('invite route persistence', () => {
  it.each(['login', 'registration'])('keeps the complete token through %s and onboarding', () => {
    const storage = createStorage()
    const inviteHash = '#/join/ABC123456'

    preservePendingInviteRoute(inviteHash, storage)
    const routeAfterAuth = takePendingRoute(storage)
    expect(routeAfterAuth).toBe(inviteHash)

    preserveAfterOnboardingRoute(routeAfterAuth!.slice(1), storage)
    expect(takeAfterOnboardingRoute(storage)).toBe('/join/ABC123456')
  })

  it('does not preserve an invite route without a token', () => {
    const storage = createStorage()
    preservePendingInviteRoute('#/join/', storage)
    expect(storage.getItem(STORAGE_KEYS.pendingRoute)).toBeNull()
  })
})
