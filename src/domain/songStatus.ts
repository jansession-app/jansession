import type { Assignment, Preparation, Profile, RoleSlot, StatusDetails } from './types'
import type { Translate } from '../i18n/LanguageContext'
import { INSTRUMENT_LABEL_KEYS } from './labels'

const PREPARED_STATES = new Set(['KNOWS_STRUCTURE', 'READY'])

export function deriveSongStatus(
  slots: RoleSlot[],
  assignments: Assignment[],
  preparations: Preparation[],
  profiles: Profile[] = [],
): StatusDetails {
  const assignmentBySlot = new Map(assignments.map((assignment) => [assignment.slotId, assignment]))
  const missingInstruments = slots
    .filter((slot) => !assignmentBySlot.has(slot.id))
    .map((slot) => slot.instrument)

  if (missingInstruments.length > 0 || slots.length === 0) {
    return {
      status: 'INCOMPLETE',
      missingInstruments,
      musiciansToPrepare: [],
      occupiedSlots: slots.length - missingInstruments.length,
      totalSlots: slots.length,
    }
  }

  const preparationByMusician = new Map(preparations.map((preparation) => [preparation.userId, preparation.state]))
  const assignedUserIds = [...new Set(assignments.map((assignment) => assignment.userId))]
  const usersToPrepare = assignedUserIds.filter((userId) => !PREPARED_STATES.has(preparationByMusician.get(userId) ?? 'UNKNOWN'))

  if (usersToPrepare.length > 0) {
    return {
      status: 'TO_PREPARE',
      missingInstruments: [],
      musiciansToPrepare: usersToPrepare.map(
        (userId) => profiles.find((profile) => profile.id === userId)?.displayName ?? userId,
      ),
      occupiedSlots: slots.length,
      totalSlots: slots.length,
    }
  }

  const allReady = assignedUserIds.every((userId) => preparationByMusician.get(userId) === 'READY')
  return {
    status: allReady ? 'READY' : 'PLAYABLE',
    missingInstruments: [],
    musiciansToPrepare: [],
    occupiedSlots: slots.length,
    totalSlots: slots.length,
  }
}

export function displayInstrument(instrument: string, t: Translate): string {
  const key = INSTRUMENT_LABEL_KEYS[instrument]
  return key ? t(key) : instrument
}

export function statusSummary(details: StatusDetails, t: Translate): string {
  if (details.status === 'INCOMPLETE') {
    const instruments = details.missingInstruments.length
      ? details.missingInstruments.map((instrument) => displayInstrument(instrument, t)).join(', ')
      : t('status.summary.missingFormation')
    return t(details.missingInstruments.length === 1 ? 'status.summary.missingOne' : 'status.summary.missingMany', { instruments })
  }
  if (details.status === 'TO_PREPARE') {
    if (details.musiciansToPrepare.length === 1) return t('status.summary.oneToPrepare', { name: details.musiciansToPrepare[0] ?? '' })
    return t('status.summary.manyToPrepare', { count: details.musiciansToPrepare.length })
  }
  if (details.status === 'PLAYABLE') return t('status.toPrepare')
  return t('status.summary.ready')
}
