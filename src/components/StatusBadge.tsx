import { STATUS_META } from '../domain/labels'
import type { SongStatus } from '../domain/types'

export function StatusBadge({ status, large = false }: { status: SongStatus; large?: boolean }) {
  const meta = STATUS_META[status]
  return (
    <span className={`status-badge status-${status.toLowerCase()} ${large ? 'status-large' : ''}`}>
      <span className="status-label" key={status}>{meta.label}</span>
    </span>
  )
}
