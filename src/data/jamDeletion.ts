import type { AppData, Jam } from '../domain/types'

export function canDeleteJam(jam: Pick<Jam, 'creatorId'> | undefined, userId: string): boolean {
  return jam?.creatorId === userId
}

export function removeJamFromData(data: AppData, jamId: string): AppData {
  const songIds = new Set(data.songs.filter((song) => song.jamId === jamId).map((song) => song.id))
  const slotIds = new Set(data.slots.filter((slot) => songIds.has(slot.songId)).map((slot) => slot.id))

  return {
    ...data,
    jams: data.jams.filter((jam) => jam.id !== jamId),
    members: data.members.filter((member) => member.jamId !== jamId),
    songs: data.songs.filter((song) => song.jamId !== jamId),
    slots: data.slots.filter((slot) => !songIds.has(slot.songId)),
    assignments: data.assignments.filter((assignment) => !slotIds.has(assignment.slotId)),
    volunteers: data.volunteers.filter((volunteer) => !songIds.has(volunteer.songId)),
    preparations: data.preparations.filter((preparation) => !songIds.has(preparation.songId)),
    setlist: data.setlist.filter((item) => item.jamId !== jamId && !songIds.has(item.songId)),
  }
}
