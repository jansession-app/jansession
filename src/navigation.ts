export const GLOBAL_NAVIGATION = [
  { key: 'jams', to: '/jams' },
  { key: 'profile', to: '/profile' },
] as const

export type GlobalNavigationKey = (typeof GLOBAL_NAVIGATION)[number]['key']

export function jamRoutes(jamId: string) {
  const base = `/jam/${encodeURIComponent(jamId)}`
  return {
    overview: base,
    songs: `${base}/songs`,
    setlist: `${base}/setlist`,
    musicians: `${base}/musicians`,
    settings: `${base}/settings`,
  }
}

export function joinedJamRoute(jamId: string) {
  return jamRoutes(jamId).overview
}

export function jamIdFromRoute(pathname: string): string | null {
  const encodedJamId = pathname.match(/^\/jam\/([^/]+)(?:\/|$)/)?.[1]
  if (!encodedJamId) return null
  try {
    return decodeURIComponent(encodedJamId)
  } catch {
    return null
  }
}

export function activeGlobalNavigation(pathname: string): GlobalNavigationKey {
  return pathname === '/profile' ? 'profile' : 'jams'
}
