import { STATUS_LABEL_KEYS } from '../domain/labels'
import type { SongStatus } from '../domain/types'
import { useI18n } from '../i18n/LanguageContext'

export function StatusBadge({ status, large = false }: { status: SongStatus; large?: boolean }) {
  const { t } = useI18n()
  return (
    <span className={`status-badge status-${status.toLowerCase()} ${large ? 'status-large' : ''}`}>
      <span className="status-label" key={status}>{t(STATUS_LABEL_KEYS[status])}</span>
    </span>
  )
}
