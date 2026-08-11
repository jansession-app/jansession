import { deriveSongStatus } from '../domain/songStatus'
import type { AppData, Song } from '../domain/types'

export function songDetails(data: AppData, song: Song) {
  const slots = data.slots.filter((slot) => slot.songId === song.id)
  const assignments = data.assignments.filter((assignment) => slots.some((slot) => slot.id === assignment.slotId))
  const preparations = data.preparations.filter((preparation) => preparation.songId === song.id)
  return { slots, assignments, preparations, details: deriveSongStatus(slots, assignments, preparations, data.profiles) }
}

export function jamSongs(data: AppData, jamId: string) {
  return data.songs.filter((song) => song.jamId === jamId).map((song) => ({ song, ...songDetails(data, song) }))
}

export function jamsForUser(data: AppData, userId = data.currentUserId) {
  const jamIds = new Set(data.members.filter((member) => member.userId === userId).map((member) => member.jamId))
  return data.jams.filter((jam) => jamIds.has(jam.id))
}

export function isManager(data: AppData, jamId: string, userId = data.currentUserId) {
  const role = data.members.find((member) => member.jamId === jamId && member.userId === userId)?.role
  return role === 'organizer' || role === 'co-organizer'
}

export function formatJamDate(startsAt: string, withTime = false) {
  const date = new Date(startsAt)
  return new Intl.DateTimeFormat('it-IT', withTime
    ? { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'long' }).format(date)
}

export function formatCompactJamDate(startsAt: string) {
  const formatted = new Intl.DateTimeFormat('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(startsAt)).replaceAll('.', '')

  return formatted.charAt(0).toUpperCase() + formatted.slice(1).replace(/,\s*/, ' · ')
}
