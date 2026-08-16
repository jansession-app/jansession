import type { SongStatus } from '../domain/types'
import { visibleSongStatus, visibleSongStatusLabelKey } from '../domain/statusPresentation'
import { useI18n } from '../i18n/LanguageContext'

export function StatusBadge({ status, large = false }: { status: SongStatus; large?: boolean }) {
  const { t } = useI18n()
  const visibleStatus = visibleSongStatus(status)
  return (
    <span className={`status-badge status-${visibleStatus.toLowerCase()} ${large ? 'status-large' : ''}`}>
      <span className="status-label" key={visibleStatus}>{t(visibleSongStatusLabelKey(status))}</span>
    </span>
  )
}
