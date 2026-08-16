import { describe, expect, it } from 'vitest'
import { mapDiscoverJamRow, mapPublicJamRow } from './discoverMappers'

const publicRow = {
  jam_id: 'jam-london',
  name: 'Sunday Jam',
  starts_at: '2026-08-23T19:30:00+01:00',
  public_area: 'Camden, London',
  accepting_members: true,
  participant_count: '4',
  song_count: 5,
  wanted_instruments: ['Batteria', 'Basso'],
  request_status: 'pending',
}

describe('Discover DTO mapping', () => {
  it('maps only the approved public summary fields', () => {
    const networkRow = {
      ...publicRow,
      location: 'Casa Giovanni',
      location_address: 'Private address',
      invite_token: 'PRIVATE123',
      member_identity: 'Private member',
      assignments: ['private'],
      preparation: ['private'],
    }
    const mapped = mapDiscoverJamRow(networkRow)
    expect(mapped).toEqual({
      jamId: 'jam-london',
      name: 'Sunday Jam',
      startsAt: '2026-08-23T19:30:00+01:00',
      publicArea: 'Camden, London',
      acceptingMembers: true,
      participantCount: 4,
      songCount: 5,
      wantedInstruments: ['Batteria', 'Basso'],
      requestStatus: 'pending',
    })
    expect(mapped).not.toHaveProperty('location')
    expect(mapped).not.toHaveProperty('locationAddress')
    expect(mapped).not.toHaveProperty('inviteToken')
  })

  it('maps only public song title, artist and required roles', () => {
    const mapped = mapPublicJamRow({
      ...publicRow,
      public_songs: [{ title: 'Song 2', artist: 'Blur', roles: ['Batteria'], proposer: 'private', listeningUrl: 'private' }],
    })
    expect(mapped.songs).toEqual([{ title: 'Song 2', artist: 'Blur', roles: ['Batteria'] }])
    expect(mapped.songs[0]).not.toHaveProperty('proposer')
    expect(mapped.songs[0]).not.toHaveProperty('listeningUrl')
  })

  it('keeps database request values unchanged and rejects unknown states', () => {
    expect(mapDiscoverJamRow(publicRow).requestStatus).toBe('pending')
    expect(mapDiscoverJamRow({ ...publicRow, request_status: 'UNKNOWN' }).requestStatus).toBeNull()
  })
})
