import type { PreparationState, SongStatus } from './types'
import type { TranslationKey } from '../i18n/translations'

export type VisiblePreparationState = 'TO_PREPARE' | 'READY'
export type VisibleSongStatus = 'INCOMPLETE' | 'TO_PREPARE' | 'READY'

export function visiblePreparationState(state: PreparationState): VisiblePreparationState {
  return state === 'READY' ? 'READY' : 'TO_PREPARE'
}

export function preparationStateForAction(state: VisiblePreparationState): PreparationState {
  return state === 'READY' ? 'READY' : 'NEEDS_LISTENING'
}

export function visibleSongStatus(status: SongStatus): VisibleSongStatus {
  if (status === 'INCOMPLETE') return 'INCOMPLETE'
  return status === 'READY' ? 'READY' : 'TO_PREPARE'
}

export const VISIBLE_PREPARATION_LABEL_KEYS: Record<VisiblePreparationState, TranslationKey> = {
  TO_PREPARE: 'status.toPrepare',
  READY: 'status.ready',
}

export const VISIBLE_SONG_STATUS_LABEL_KEYS: Record<VisibleSongStatus, TranslationKey> = {
  INCOMPLETE: 'status.incomplete',
  TO_PREPARE: 'status.toPrepare',
  READY: 'status.ready',
}

export function visiblePreparationLabelKey(state: PreparationState): TranslationKey {
  return VISIBLE_PREPARATION_LABEL_KEYS[visiblePreparationState(state)]
}

export function visibleSongStatusLabelKey(status: SongStatus): TranslationKey {
  return VISIBLE_SONG_STATUS_LABEL_KEYS[visibleSongStatus(status)]
}
