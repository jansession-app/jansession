import type { AppData, PreparationState, Song } from '../domain/types'

export interface PersonalSongAssignment {
  song: Song
  instruments: string[]
  state: PreparationState
}

export function personalSongAssignments(
  data: AppData,
  jamId?: string,
  userId = data.currentUserId,
): PersonalSongAssignment[] {
  const bySong = new Map<string, { song: Song; instruments: Set<string> }>()

  for (const assignment of data.assignments) {
    if (assignment.userId !== userId) continue
    const slot = data.slots.find((item) => item.id === assignment.slotId)
    const song = slot && data.songs.find((item) => item.id === slot.songId)
    if (!slot || !song || (jamId && song.jamId !== jamId)) continue
    const current = bySong.get(song.id) ?? { song, instruments: new Set<string>() }
    current.instruments.add(slot.instrument)
    bySong.set(song.id, current)
  }

  return [...bySong.values()].map(({ song, instruments }) => ({
    song,
    instruments: [...instruments],
    state: data.preparations.find((item) => item.songId === song.id && item.userId === userId)?.state ?? 'UNKNOWN',
  }))
}

export function jamPreparationTasks(data: AppData, jamId: string, userId = data.currentUserId) {
  return personalSongAssignments(data, jamId, userId).filter((item) => item.state !== 'READY')
}
