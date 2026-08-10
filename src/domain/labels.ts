import type { PreparationState, SongStatus } from './types'

export const STATUS_META: Record<SongStatus, { label: string }> = {
  READY: { label: 'Pronto' },
  PLAYABLE: { label: 'Suonabile' },
  TO_PREPARE: { label: 'Da preparare' },
  INCOMPLETE: { label: 'Incompleto' },
}

export const PREPARATION_LABELS: Record<PreparationState, string> = {
  UNKNOWN: 'Non la conosco',
  NEEDS_LISTENING: 'Da ascoltare',
  KNOWS_STRUCTURE: 'Conosco la struttura',
  READY: 'Pronto',
}

export const PREPARATION_HELP: Record<PreparationState, string> = {
  UNKNOWN: 'Non hai ancora indicato una preparazione.',
  NEEDS_LISTENING: 'Ascoltala prima della jam.',
  KNOWS_STRUCTURE: 'Conosci intro, strofe, ritornelli, passaggi e finale.',
  READY: 'Ti senti pronto a suonarla.',
}
