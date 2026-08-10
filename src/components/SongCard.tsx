import { Link } from 'react-router-dom'
import { statusSummary } from '../domain/songStatus'
import type { Song, StatusDetails } from '../domain/types'
import { StatusBadge } from './StatusBadge'

export function SongCard({ jamId, song, details, assignmentLabel }: { jamId: string; song: Song; details: StatusDetails; assignmentLabel?: string }) {
  return (
    <Link className="song-card" to={`/jam/${jamId}/song/${song.id}`} aria-label={`${song.title} di ${song.artist}`}>
      <div className="song-copy">
        <h3>{song.title}</h3>
        <p>{song.artist}</p>
      </div>
      <div className="song-card-meta" key={details.status}>
        <StatusBadge status={details.status} />
        <span>{assignmentLabel ?? statusSummary(details)}</span>
      </div>
    </Link>
  )
}
