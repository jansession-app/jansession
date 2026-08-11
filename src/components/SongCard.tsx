import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import type { Song, StatusDetails } from '../domain/types'
import { StatusBadge } from './StatusBadge'
import { useI18n } from '../i18n/LanguageContext'

const MotionLink = motion.create(Link)

export function SongCard({ jamId, song, details, assignmentLabel }: { jamId: string; song: Song; details: StatusDetails; assignmentLabel?: string }) {
  const { t } = useI18n()
  return (
    <MotionLink
      className="song-card"
      to={`/jam/${jamId}/song/${song.id}`}
      aria-label={t('songs.cardAria', { title: song.title, artist: song.artist })}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -18 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
    >
      <div className="song-copy">
        <motion.h3 layoutId={`song-title-${song.id}`}>{song.title}</motion.h3>
        <p>{song.artist}</p>
      </div>
      <div className="song-card-meta" key={details.status}>
        <StatusBadge status={details.status} />
        {assignmentLabel && <span>{assignmentLabel}</span>}
      </div>
    </MotionLink>
  )
}
