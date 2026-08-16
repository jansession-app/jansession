import { describe, expect, it } from 'vitest'
import type { AppData } from '../domain/types'
import { applyPreparationState, rollbackPreparationState } from './preparationState'

const base: AppData = {
  currentUserId: 'me', profiles: [], jams: [], members: [], songs: [], slots: [], assignments: [], volunteers: [], setlist: [],
  preparations: [{ songId: 'song', userId: 'me', state: 'NEEDS_LISTENING', updatedAt: 'before' }],
}

describe('optimistic preparation updates', () => {
  it('updates immediately to READY', () => {
    expect(applyPreparationState(base, 'song', 'me', 'READY').preparations[0]?.state).toBe('READY')
  })

  it('restores the previous value after the matching remote update fails', () => {
    const previous = base.preparations[0]
    const optimistic = applyPreparationState(base, 'song', 'me', 'READY')
    expect(rollbackPreparationState(optimistic, 'song', 'me', 'READY', previous).preparations[0]).toEqual(previous)
  })

  it('does not overwrite a newer user choice during rollback', () => {
    const previous = base.preparations[0]
    const newer = applyPreparationState(base, 'song', 'me', 'UNKNOWN')
    expect(rollbackPreparationState(newer, 'song', 'me', 'READY', previous).preparations[0]?.state).toBe('UNKNOWN')
  })
})
