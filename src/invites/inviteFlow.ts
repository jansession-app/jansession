import { STORAGE_KEYS } from '../config/brand'

type RouteStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type InviteTokenRelation = { token: string } | { token: string }[] | null

export function readInviteToken(relation: InviteTokenRelation): string {
  const invite = Array.isArray(relation) ? relation[0] : relation
  return invite?.token.trim() ?? ''
}

export function buildInviteUrl(origin: string, pathname: string, inviteToken: string): string | null {
  const token = inviteToken.trim()
  if (!token) return null
  const appPath = pathname.endsWith('/') ? pathname : `${pathname}/`
  return `${origin}${appPath}#/join/${encodeURIComponent(token)}`
}

function isCompleteInviteHash(hash: string): boolean {
  const prefix = '#/join/'
  if (!hash.startsWith(prefix)) return false
  const encodedToken = hash.slice(prefix.length).split(/[/?#]/, 1)[0]
  if (!encodedToken) return false
  try {
    return decodeURIComponent(encodedToken).trim().length > 0
  } catch {
    return false
  }
}

export function preservePendingInviteRoute(hash: string, storage: RouteStorage): void {
  if (isCompleteInviteHash(hash)) storage.setItem(STORAGE_KEYS.pendingRoute, hash)
}

export function takePendingRoute(storage: RouteStorage): string | null {
  const route = storage.getItem(STORAGE_KEYS.pendingRoute)
  if (!route) return null
  storage.removeItem(STORAGE_KEYS.pendingRoute)
  return route
}

export function preserveAfterOnboardingRoute(pathname: string, storage: RouteStorage): void {
  storage.setItem(STORAGE_KEYS.afterOnboarding, pathname)
}

export function takeAfterOnboardingRoute(storage: RouteStorage): string {
  const route = storage.getItem(STORAGE_KEYS.afterOnboarding) ?? '/jams'
  storage.removeItem(STORAGE_KEYS.afterOnboarding)
  return route
}
