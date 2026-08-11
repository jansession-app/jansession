import { describe, expect, it } from 'vitest'
import { activeGlobalNavigation, GLOBAL_NAVIGATION, jamIdFromRoute, jamRoutes, joinedJamRoute } from './navigation'

describe('global navigation', () => {
  it('contains only the global jams and profile destinations', () => {
    expect(GLOBAL_NAVIGATION).toEqual([
      { key: 'jams', to: '/jams' },
      { key: 'profile', to: '/profile' },
    ])
  })

  it('keeps Profilo global and never resolves a jam section from prior state', () => {
    expect(activeGlobalNavigation('/profile')).toBe('profile')
    expect(activeGlobalNavigation('/jams')).toBe('jams')
    expect(activeGlobalNavigation('/jam/jam-one/songs')).toBe('jams')
    expect(GLOBAL_NAVIGATION.find((item) => item.key === 'jams')?.to).toBe('/jams')
  })
})

describe('jam navigation', () => {
  it('opens the jam overview when a jam is selected', () => {
    expect(jamRoutes('jam-one').overview).toBe('/jam/jam-one')
  })

  it('builds every overview destination with the same explicit jam id', () => {
    expect(jamRoutes('jam-one')).toEqual({
      overview: '/jam/jam-one',
      songs: '/jam/jam-one/songs',
      setlist: '/jam/jam-one/setlist',
      musicians: '/jam/jam-one/musicians',
      settings: '/jam/jam-one/settings',
    })
  })

  it.each([
    '/jam/jam-one',
    '/jam/jam-one/songs',
    '/jam/jam-one/setlist',
    '/jam/jam-one/musicians',
    '/jam/jam-one/settings',
    '/jam/jam-one/song/song-two',
  ])('reads the jam id from route %s', (route) => {
    expect(jamIdFromRoute(route)).toBe('jam-one')
  })

  it('returns from every primary section to the overview of the same jam', () => {
    const routes = jamRoutes('jam-two')
    for (const section of [routes.songs, routes.setlist, routes.musicians, routes.settings]) {
      expect(jamRoutes(jamIdFromRoute(section)!).overview).toBe('/jam/jam-two')
    }
  })

  it('sends an accepted invite to the joined jam overview', () => {
    expect(joinedJamRoute('joined-jam')).toBe('/jam/joined-jam')
  })
})
