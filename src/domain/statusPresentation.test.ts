import { describe, expect, it } from 'vitest'
import type { PreparationState, SongStatus } from './types'
import { preparationStateForAction, visiblePreparationState, visibleSongStatus } from './statusPresentation'

describe('simplified status presentation', () => {
  it.each<PreparationState>(['UNKNOWN', 'NEEDS_LISTENING', 'KNOWS_STRUCTURE'])('maps %s to TO_PREPARE without changing the stored value', (state) => {
    expect(visiblePreparationState(state)).toBe('TO_PREPARE')
    expect(state).not.toBe('TO_PREPARE')
  })

  it('keeps READY visible as READY', () => {
    expect(visiblePreparationState('READY')).toBe('READY')
  })

  it.each<[SongStatus, string]>([
    ['INCOMPLETE', 'INCOMPLETE'],
    ['TO_PREPARE', 'TO_PREPARE'],
    ['PLAYABLE', 'TO_PREPARE'],
    ['READY', 'READY'],
  ])('maps visible song status %s to %s', (status, visible) => {
    expect(visibleSongStatus(status)).toBe(visible)
  })

  it('uses READY for the ready action and NEEDS_LISTENING to undo it', () => {
    expect(preparationStateForAction('READY')).toBe('READY')
    expect(preparationStateForAction('TO_PREPARE')).toBe('NEEDS_LISTENING')
  })
})
