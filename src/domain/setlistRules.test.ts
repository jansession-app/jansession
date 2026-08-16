import { describe, expect, it } from 'vitest'
import type { AppData, Assignment, PreparationState } from './types'
import { deriveSongStatus } from './songStatus'
import { canAddSongToSetlist, setlistWarning } from './setlistRules'
import { translate } from '../i18n/LanguageContext'

function dataFor(role: 'organizer' | 'co-organizer' | 'musician', preparation?: PreparationState, assigned = true): AppData {
  return {
    currentUserId: 'me',
    profiles: [],
    jams: [{ id: 'jam', name: 'Jam', startsAt: '', creatorId: 'me', visibility: 'private', acceptingMembers: true, wantedInstruments: [], proposalsOpen: true, assignmentsOpen: true, inviteCode: '', createdAt: '' }],
    members: [{ jamId: 'jam', userId: 'me', role, joinedAt: '' }],
    songs: [{ id: 'song', jamId: 'jam', proposerId: 'me', title: 'Song', artist: 'Artist', createdAt: '', updatedAt: '' }],
    slots: [{ id: 'slot', songId: 'song', instrument: 'Chitarra', position: 1 }],
    assignments: assigned ? [{ slotId: 'slot', userId: 'me', assignedBy: 'me', createdAt: '' }] : [],
    volunteers: [],
    preparations: preparation ? [{ songId: 'song', userId: 'me', state: preparation, updatedAt: '' }] : [],
    setlist: [],
  }
}

describe('setlist rules', () => {
  it.each([
    [undefined, false, 'INCOMPLETE'],
    ['UNKNOWN', true, 'TO_PREPARE'],
    ['KNOWS_STRUCTURE', true, 'PLAYABLE'],
    ['READY', true, 'READY'],
  ] as const)('allows a manager to add internal status %s', (preparation, assigned, expectedStatus) => {
    const data = dataFor('organizer', preparation, assigned)
    const assignments = data.assignments as Assignment[]
    expect(deriveSongStatus(data.slots, assignments, data.preparations).status).toBe(expectedStatus)
    expect(canAddSongToSetlist(data, 'jam', 'song')).toBe(true)
  })

  it('allows a co-organizer but not a musician', () => {
    expect(canAddSongToSetlist(dataFor('co-organizer', 'READY'), 'jam', 'song')).toBe(true)
    expect(canAddSongToSetlist(dataFor('musician', 'READY'), 'jam', 'song')).toBe(false)
  })

  it('preserves an existing setlist item and prevents a duplicate', () => {
    const data = dataFor('organizer', 'READY')
    data.setlist.push({ id: 'item', jamId: 'jam', songId: 'song', position: 1, createdAt: '' })
    expect(canAddSongToSetlist(data, 'jam', 'song')).toBe(false)
    expect(data.setlist).toHaveLength(1)
  })

  it('keeps warnings for incomplete and not-ready songs, including PLAYABLE', () => {
    const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate('it', key, params)
    const incomplete = dataFor('organizer', undefined, false)
    const toPrepare = dataFor('organizer', 'UNKNOWN')
    const playable = dataFor('organizer', 'KNOWS_STRUCTURE')
    const ready = dataFor('organizer', 'READY')
    expect(setlistWarning(deriveSongStatus(incomplete.slots, incomplete.assignments, incomplete.preparations), t)).toContain('Manca')
    expect(setlistWarning(deriveSongStatus(toPrepare.slots, toPrepare.assignments, toPrepare.preparations), t)).toBe('Da preparare')
    expect(setlistWarning(deriveSongStatus(playable.slots, playable.assignments, playable.preparations), t)).toBe('Da preparare')
    expect(setlistWarning(deriveSongStatus(ready.slots, ready.assignments, ready.preparations), t)).toBeNull()
  })
})
