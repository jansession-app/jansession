import type { TranslationKey } from '../i18n/translations'
import type { SongStatus } from './types'

export const STATUS_LABEL_KEYS: Record<SongStatus, TranslationKey> = {
  READY: 'status.ready',
  PLAYABLE: 'status.toPrepare',
  TO_PREPARE: 'status.toPrepare',
  INCOMPLETE: 'status.incomplete',
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
