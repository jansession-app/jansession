import type { AppData, JamRole } from '../domain/types'

export function canLeaveJam(data: AppData, jamId: string, userId = data.currentUserId): boolean {
  const jam = data.jams.find((item) => item.id === jamId)
  const member = data.members.some((item) => item.jamId === jamId && item.userId === userId)
  return Boolean(jam && member && jam.creatorId !== userId)
}

export function canRemoveJamMember(data: AppData, jamId: string, actorId: string, targetUserId: string): boolean {
  const jam = data.jams.find((item) => item.id === jamId)
  const targetIsMember = data.members.some((item) => item.jamId === jamId && item.userId === targetUserId)
  return Boolean(jam && targetIsMember && jam.creatorId === actorId && targetUserId !== jam.creatorId)
}

export function canChangeJamMemberRole(data: AppData, jamId: string, actorId: string, targetUserId: string, role: JamRole): boolean {
  const jam = data.jams.find((item) => item.id === jamId)
  const target = data.members.find((item) => item.jamId === jamId && item.userId === targetUserId)
  return Boolean(
    jam
    && target
    && jam.creatorId === actorId
    && targetUserId !== jam.creatorId
    && target.role !== 'organizer'
    && (role === 'musician' || role === 'co-organizer'),
  )
}

export function removeJamMemberFromData(data: AppData, jamId: string, userId: string): AppData {
  const songIds = new Set(data.songs.filter((song) => song.jamId === jamId).map((song) => song.id))
  const slotIds = new Set(data.slots.filter((slot) => songIds.has(slot.songId)).map((slot) => slot.id))

  return {
    ...data,
    members: data.members.filter((member) => !(member.jamId === jamId && member.userId === userId)),
    assignments: data.assignments.filter((assignment) => assignment.userId !== userId || !slotIds.has(assignment.slotId)),
    volunteers: data.volunteers.filter((volunteer) => volunteer.userId !== userId || !songIds.has(volunteer.songId)),
    preparations: data.preparations.filter((preparation) => preparation.userId !== userId || !songIds.has(preparation.songId)),
  }
}

export function changeJamMemberRoleInData(data: AppData, jamId: string, userId: string, role: JamRole): AppData {
  return {
    ...data,
    members: data.members.map((member) => member.jamId === jamId && member.userId === userId ? { ...member, role } : member),
  }
}
