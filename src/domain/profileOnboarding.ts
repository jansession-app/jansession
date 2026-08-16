import type { Profile } from './types'

const DEFAULT_PROFILE_NAMES = new Set(['musicista', 'musician'])

export function normalizedDisplayName(displayName: string): string {
  return displayName.trim().toLocaleLowerCase()
}

export function isValidDisplayName(displayName: string): boolean {
  const normalized = normalizedDisplayName(displayName)
  return normalized.length > 0 && !DEFAULT_PROFILE_NAMES.has(normalized)
}

export function isProfileComplete(profile: Profile | null | undefined): boolean {
  return Boolean(profile && isValidDisplayName(profile.displayName) && profile.instruments.length > 0)
}

export function canCompleteOnboarding(displayName: string, instruments: string[]): boolean {
  return isValidDisplayName(displayName) && instruments.length > 0
}

export async function completeOnboarding(
  displayName: string,
  instruments: string[],
  save: (validDisplayName: string, selectedInstruments: string[]) => Promise<boolean>,
): Promise<boolean> {
  if (!canCompleteOnboarding(displayName, instruments)) return false
  try {
    return await save(displayName.trim(), instruments)
  } catch {
    return false
  }
}
