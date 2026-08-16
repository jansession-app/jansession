import type { AppData, Assignment, Preparation, RoleSlot, SetlistItem, Song } from '../domain/types'

const now = '2026-08-10T10:00:00.000Z'
const jamId = 'jam-poggiardo'

const song = (id: string, title: string, artist: string, proposerId = 'gian', listeningUrl?: string): Song => ({
  id, jamId, proposerId, title, artist, listeningUrl, createdAt: now, updatedAt: now,
})

const makeSlots = (songId: string, instruments: string[]): RoleSlot[] => instruments.map((instrument, index) => ({
  id: `${songId}-slot-${index + 1}`, songId, instrument, position: index + 1,
}))

const makeAssignment = (songId: string, slot: number, userId: string): Assignment => ({
  slotId: `${songId}-slot-${slot}`, userId, assignedBy: userId, createdAt: now,
})

const makePreparation = (songId: string, userId: string, state: Preparation['state']): Preparation => ({
  songId, userId, state, updatedAt: now,
})

const standardFormation = ['Voce', 'Chitarra', 'Basso', 'Batteria']
const songIds = ['smells', 'song-2', 'come-together', 'killing', 'everlong']

export function createDemoData(): AppData {
  const slots = songIds.flatMap((id) => makeSlots(id, standardFormation))
  const assignments: Assignment[] = [
    ...['smells', 'song-2', 'come-together', 'killing'].flatMap((id) => [
      makeAssignment(id, 1, 'marco'),
      makeAssignment(id, 2, 'luca'),
      makeAssignment(id, 3, 'andrea'),
      makeAssignment(id, 4, 'gian'),
    ]),
    makeAssignment('everlong', 1, 'marco'),
    makeAssignment('everlong', 2, 'luca'),
    makeAssignment('everlong', 4, 'gian'),
  ]

  const preparations: Preparation[] = [
    makePreparation('smells', 'marco', 'KNOWS_STRUCTURE'),
    makePreparation('smells', 'luca', 'READY'),
    makePreparation('smells', 'andrea', 'KNOWS_STRUCTURE'),
    makePreparation('smells', 'gian', 'KNOWS_STRUCTURE'),
    makePreparation('song-2', 'marco', 'READY'),
    makePreparation('song-2', 'luca', 'READY'),
    makePreparation('song-2', 'andrea', 'READY'),
    makePreparation('song-2', 'gian', 'NEEDS_LISTENING'),
    ...['come-together', 'killing'].flatMap((id) => ['marco', 'luca', 'andrea', 'gian'].map((userId) => makePreparation(id, userId, 'READY'))),
    makePreparation('everlong', 'marco', 'KNOWS_STRUCTURE'),
    makePreparation('everlong', 'luca', 'KNOWS_STRUCTURE'),
    makePreparation('everlong', 'gian', 'NEEDS_LISTENING'),
  ]

  const setlist: SetlistItem[] = [
    { id: 'set-1', jamId, songId: 'come-together', position: 1, createdAt: now },
    { id: 'set-2', jamId, songId: 'smells', position: 2, createdAt: now },
    { id: 'set-3', jamId, songId: 'killing', position: 3, createdAt: now },
    { id: 'set-4', jamId, songId: 'everlong', position: 4, createdAt: now },
  ]

  return {
    currentUserId: 'gian',
    profiles: [
      { id: 'gian', displayName: 'Gian', instruments: ['Batteria', 'Chitarra'], onboarded: true },
      { id: 'marco', displayName: 'Marco', instruments: ['Voce', 'Chitarra'], onboarded: true },
      { id: 'andrea', displayName: 'Andrea', instruments: ['Basso'], onboarded: true },
      { id: 'luca', displayName: 'Luca', instruments: ['Chitarra', 'Tastiere'], onboarded: true },
      { id: 'paolo', displayName: 'Paolo', instruments: ['Batteria', 'Percussioni'], onboarded: true },
    ],
    jams: [
      {
        id: jamId, name: 'Jam Session Poggiardo', startsAt: '2026-08-22T20:30:00+02:00',
        location: 'Casa Giovanni', locationAddress: 'Via delle Rose 14, Poggiardo LE', creatorId: 'gian', visibility: 'link',
        acceptingMembers: true, wantedInstruments: [],
        proposalsOpen: true, assignmentsOpen: true, inviteCode: 'X7KD92', createdAt: now,
      },
      {
        id: 'jam-blues-lecce', name: 'Jam Blues Lecce', startsAt: '2026-08-30T21:00:00+02:00',
        location: 'Bar Sport Avigliano', creatorId: 'gian', visibility: 'private', proposalsOpen: true,
        acceptingMembers: true, wantedInstruments: [], assignmentsOpen: true, inviteCode: 'BLUES30', createdAt: now,
      },
    ],
    members: [
      { jamId, userId: 'gian', role: 'organizer', joinedAt: now },
      { jamId, userId: 'marco', role: 'musician', joinedAt: now },
      { jamId, userId: 'andrea', role: 'musician', joinedAt: now },
      { jamId, userId: 'luca', role: 'co-organizer', joinedAt: now },
      { jamId: 'jam-blues-lecce', userId: 'gian', role: 'organizer', joinedAt: now },
      { jamId: 'jam-blues-lecce', userId: 'paolo', role: 'musician', joinedAt: now },
    ],
    songs: [
      song('smells', 'Smells Like Teen Spirit', 'Nirvana', 'marco', 'https://www.youtube.com/results?search_query=Smells+Like+Teen+Spirit'),
      song('song-2', 'Song 2', 'Blur', 'luca', 'https://www.youtube.com/results?search_query=Blur+Song+2'),
      song('come-together', 'Come Together', 'The Beatles', 'andrea', 'https://www.youtube.com/results?search_query=The+Beatles+Come+Together'),
      song('killing', 'Killing in the Name', 'Rage Against the Machine', 'gian', 'https://www.youtube.com/results?search_query=Killing+in+the+Name'),
      song('everlong', 'Everlong', 'Foo Fighters', 'gian', 'https://www.youtube.com/results?search_query=Foo+Fighters+Everlong'),
    ],
    slots,
    assignments,
    volunteers: [
      { songId: 'smells', instrument: 'Chitarra', userId: 'marco' },
      { songId: 'everlong', instrument: 'Basso', userId: 'andrea' },
    ],
    preparations,
    setlist,
  }
}
