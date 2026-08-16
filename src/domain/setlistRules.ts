import type { AppData, StatusDetails } from './types'
import type { Translate } from '../i18n/LanguageContext'
import { statusSummary } from './songStatus'
import { visibleSongStatus } from './statusPresentation'

export function canAddSongToSetlist(data: AppData, jamId: string, songId: string, userId = data.currentUserId): boolean {
  const role = data.members.find((member) => member.jamId === jamId && member.userId === userId)?.role
  const songBelongsToJam = data.songs.some((song) => song.id === songId && song.jamId === jamId)
  const alreadyIncluded = data.setlist.some((item) => item.jamId === jamId && item.songId === songId)
  return (role === 'organizer' || role === 'co-organizer') && songBelongsToJam && !alreadyIncluded
}

export function setlistWarning(details: StatusDetails, t: Translate): string | null {
  const visibleStatus = visibleSongStatus(details.status)
  if (visibleStatus === 'READY') return null
  if (visibleStatus === 'INCOMPLETE') return statusSummary(details, t)
  return t('status.toPrepare')
}
