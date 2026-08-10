import { describe, expect, it } from 'vitest'
import { canAddToSetlist, deriveSongStatus } from './songStatus'
import type { Assignment, Preparation, RoleSlot } from './types'

const slots: RoleSlot[] = ['Voce', 'Chitarra', 'Basso', 'Batteria'].map((instrument, index) => ({
  id: `slot-${index}`,
  songId: 'song',
  instrument,
  position: index,
}))

const assignment = (slotIndex: number, userId: string): Assignment => ({
  slotId: `slot-${slotIndex}`,
  userId,
  assignedBy: userId,
  createdAt: '2026-01-01',
})

const preparation = (userId: string, state: Preparation['state']): Preparation => ({
  songId: 'song', userId, state, updatedAt: '2026-01-01',
})

describe('deriveSongStatus', () => {
  it('is INCOMPLETE when a required drummer is missing', () => {
    const result = deriveSongStatus(slots, [assignment(0, 'a'), assignment(1, 'b'), assignment(2, 'c')], [])
    expect(result.status).toBe('INCOMPLETE')
    expect(result.missingInstruments).toEqual(['Batteria'])
  })

  it('is INCOMPLETE when four musicians exist but the required roles are not all occupied', () => {
    const invalidAssignments = [assignment(0, 'a'), assignment(1, 'b'), assignment(2, 'c'), { ...assignment(1, 'd'), slotId: 'extra-guitar' }]
    expect(deriveSongStatus(slots, invalidAssignments, []).status).toBe('INCOMPLETE')
  })

  it('is TO_PREPARE when every role is filled but one musician needs listening', () => {
    const assignments = slots.map((_, index) => assignment(index, `u${index}`))
    const preparations = assignments.map(({ userId }) => preparation(userId, userId === 'u3' ? 'NEEDS_LISTENING' : 'READY'))
    expect(deriveSongStatus(slots, assignments, preparations).status).toBe('TO_PREPARE')
  })

  it('is PLAYABLE when all assigned musicians know the structure', () => {
    const assignments = slots.map((_, index) => assignment(index, `u${index}`))
    expect(deriveSongStatus(slots, assignments, assignments.map(({ userId }) => preparation(userId, 'KNOWS_STRUCTURE'))).status).toBe('PLAYABLE')
  })

  it('is PLAYABLE for a mixture of structure-known and ready musicians', () => {
    const assignments = slots.map((_, index) => assignment(index, `u${index}`))
    const preparations = assignments.map(({ userId }, index) => preparation(userId, index % 2 ? 'READY' : 'KNOWS_STRUCTURE'))
    expect(deriveSongStatus(slots, assignments, preparations).status).toBe('PLAYABLE')
  })

  it('is READY when every assigned musician is ready', () => {
    const assignments = slots.map((_, index) => assignment(index, `u${index}`))
    expect(deriveSongStatus(slots, assignments, assignments.map(({ userId }) => preparation(userId, 'READY'))).status).toBe('READY')
  })

  it('keeps an invalidated song in the setlist and exposes its warning state', () => {
    const setlistSongIds = ['song']
    const status = deriveSongStatus(slots, [assignment(0, 'a'), assignment(1, 'b'), assignment(2, 'c')], [])
    expect(setlistSongIds).toContain('song')
    expect(canAddToSetlist(status.status)).toBe(false)
    expect(status.missingInstruments).toContain('Batteria')
  })
})
