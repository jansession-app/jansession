import { describe, expect, it } from 'vitest'
import type { AppData } from '../domain/types'
import { jamPreparationTasks, personalSongAssignments } from './personalPreparation'

const data: AppData = {
  currentUserId: 'me',
  profiles: [],
  jams: [],
  members: [],
  songs: [
    { id: 'song-a', jamId: 'jam-a', proposerId: 'other', title: 'Everlong', artist: 'Foo Fighters', createdAt: '', updatedAt: '' },
    { id: 'song-b', jamId: 'jam-b', proposerId: 'other', title: 'Other jam', artist: 'Artist', createdAt: '', updatedAt: '' },
    { id: 'song-c', jamId: 'jam-a', proposerId: 'other', title: 'Other user', artist: 'Artist', createdAt: '', updatedAt: '' },
  ],
  slots: [
    { id: 'slot-guitar', songId: 'song-a', instrument: 'Chitarra', position: 1 },
    { id: 'slot-voice', songId: 'song-a', instrument: 'Voce', position: 2 },
    { id: 'slot-other-jam', songId: 'song-b', instrument: 'Basso', position: 1 },
    { id: 'slot-other-user', songId: 'song-c', instrument: 'Batteria', position: 1 },
  ],
  assignments: [
    { slotId: 'slot-guitar', userId: 'me', assignedBy: 'owner', createdAt: '' },
    { slotId: 'slot-voice', userId: 'me', assignedBy: 'owner', createdAt: '' },
    { slotId: 'slot-other-jam', userId: 'me', assignedBy: 'owner', createdAt: '' },
    { slotId: 'slot-other-user', userId: 'other', assignedBy: 'owner', createdAt: '' },
  ],
  volunteers: [],
  preparations: [
    { songId: 'song-a', userId: 'me', state: 'KNOWS_STRUCTURE', updatedAt: '' },
    { songId: 'song-b', userId: 'me', state: 'READY', updatedAt: '' },
  ],
  setlist: [],
}

describe('personal jam preparation', () => {
  it('is limited to the current jam and current user', () => {
    expect(jamPreparationTasks(data, 'jam-a').map((item) => item.song.id)).toEqual(['song-a'])
  })

  it('groups multiple roles for the same song', () => {
    const [assignment] = personalSongAssignments(data, 'jam-a')
    expect(assignment?.instruments).toEqual(['Chitarra', 'Voce'])
  })

  it('includes KNOWS_STRUCTURE as a task and excludes READY', () => {
    expect(jamPreparationTasks(data, 'jam-a')).toHaveLength(1)
    expect(jamPreparationTasks(data, 'jam-b')).toHaveLength(0)
  })
})
