import type { Assignment, Preparation, Profile, RoleSlot, SongStatus, StatusDetails } from './types'

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

export function canAddToSetlist(status: SongStatus) {
  return status === 'PLAYABLE' || status === 'READY'
}

export function statusSummary(details: StatusDetails): string {
  if (details.status === 'INCOMPLETE') {
    const prefix = details.missingInstruments.length === 1 ? 'Manca' : 'Mancano'
    return `${prefix}: ${details.missingInstruments.join(', ') || 'formazione'}`
  }
  if (details.status === 'TO_PREPARE') {
    if (details.musiciansToPrepare.length === 1) return `${details.musiciansToPrepare[0]} deve ancora conoscerla`
    return `${details.musiciansToPrepare.length} musicisti devono ancora conoscerla`
  }
  if (details.status === 'PLAYABLE') return 'Tutta la formazione conosce la struttura'
  return 'Tutta la formazione è pronta'
}
