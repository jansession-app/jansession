import { describe, expect, it, vi } from 'vitest'
import { canCompleteOnboarding, completeOnboarding, isProfileComplete, isValidDisplayName } from './profileOnboarding'

describe('profile onboarding validation', () => {
  it.each(['', '   ', 'Musicista', ' musicista ', 'Musician', 'MUSICIAN'])('rejects the incomplete name %j', (name) => {
    expect(isValidDisplayName(name)).toBe(false)
  })

  it('requires at least one instrument', () => {
    expect(canCompleteOnboarding('Gian', [])).toBe(false)
  })

  it('accepts a real name and one instrument regardless of the legacy onboarded flag', () => {
    expect(isProfileComplete({ id: 'me', displayName: 'Gian', instruments: ['Chitarra'], onboarded: false })).toBe(true)
  })

  it.each(['Musicista', 'Musician'])('requires onboarding for an existing onboarded placeholder %s', (displayName) => {
    expect(isProfileComplete({ id: 'me', displayName, instruments: ['Chitarra'], onboarded: true })).toBe(false)
  })

  it('does not complete or call save when the input is invalid', async () => {
    const save = vi.fn(async () => true)
    expect(await completeOnboarding('Musicista', ['Chitarra'], save)).toBe(false)
    expect(save).not.toHaveBeenCalled()
  })

  it('returns failure and keeps onboarding incomplete when persistence fails', async () => {
    const save = vi.fn(async () => false)
    expect(await completeOnboarding('Gian', ['Chitarra'], save)).toBe(false)
    expect(save).toHaveBeenCalledWith('Gian', ['Chitarra'])
  })
})
