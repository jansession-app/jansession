import type { TranslationKey } from '../i18n/translations'
import type { PreparationState, SongStatus } from './types'

export const STATUS_LABEL_KEYS: Record<SongStatus, TranslationKey> = {
  READY: 'status.ready',
  PLAYABLE: 'status.playable',
  TO_PREPARE: 'status.toPrepare',
  INCOMPLETE: 'status.incomplete',
}

export const PREPARATION_LABEL_KEYS: Record<PreparationState, TranslationKey> = {
  UNKNOWN: 'preparation.unknown',
  NEEDS_LISTENING: 'preparation.needsListening',
  KNOWS_STRUCTURE: 'preparation.knowsStructure',
  READY: 'preparation.ready',
}

export const PREPARATION_HELP_KEYS: Record<PreparationState, TranslationKey> = {
  UNKNOWN: 'preparation.help.unknown',
  NEEDS_LISTENING: 'preparation.help.needsListening',
  KNOWS_STRUCTURE: 'preparation.help.knowsStructure',
  READY: 'preparation.help.ready',
}

export const JAM_ROLE_LABEL_KEYS = {
  organizer: 'jam.role.organizer',
  'co-organizer': 'jam.role.coOrganizer',
  musician: 'jam.role.musician',
} as const satisfies Record<import('./types').JamRole, TranslationKey>

export const INSTRUMENT_LABEL_KEYS: Partial<Record<string, TranslationKey>> = {
  Voce: 'instrument.voice',
  Chitarra: 'instrument.guitar',
  Basso: 'instrument.bass',
  Batteria: 'instrument.drums',
  Tastiere: 'instrument.keys',
  Percussioni: 'instrument.percussion',
}
