import { ChevronRight, ListMusic, MapPin, Music2, Settings2, UsersRound, type LucideIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { formatCompactJamDate, jamSongs } from '../data/selectors'
import type { JamRole } from '../domain/types'
import { jamRoutes } from '../navigation'

const MotionLink = motion.create(Link)

const ROLE_LABELS: Record<JamRole, string> = {
  organizer: 'Proprietario',
  'co-organizer': 'Co-organizzatore',
  musician: 'Musicista',
}

export function JamOverviewPage() {
  const { jamId = '' } = useParams()
  const { data } = useData()
  const reduceMotion = useReducedMotion()
  const jam = data.jams.find((item) => item.id === jamId)
  if (!jam) return null

  const routes = jamRoutes(jamId)
  const songs = jamSongs(data, jamId)
  const playableCount = songs.filter(({ details }) => details.status === 'READY' || details.status === 'PLAYABLE').length
  const setlistCount = data.setlist.filter((item) => item.jamId === jamId).length
  const participantCount = data.members.filter((member) => member.jamId === jamId).length
  const role = data.members.find((member) => member.jamId === jamId && member.userId === data.currentUserId)?.role
  const sections: { key: string; label: string; metric?: number; summary?: string; to: string; icon: LucideIcon; kind: string }[] = [
    { key: 'songs', label: 'Brani', metric: songs.length, summary: playableCount ? `${playableCount} suonabili` : undefined, to: routes.songs, icon: Music2, kind: 'feature' },
    { key: 'setlist', label: 'Scaletta', metric: setlistCount, summary: 'in scaletta', to: routes.setlist, icon: ListMusic, kind: 'compact' },
    { key: 'musicians', label: 'Musicisti', metric: participantCount, summary: participantCount === 1 ? 'partecipante' : 'partecipanti', to: routes.musicians, icon: UsersRound, kind: 'compact' },
    { key: 'settings', label: 'Impostazioni', to: routes.settings, icon: Settings2, kind: 'plain' },
  ]

  return (
    <main className="page jam-overview-page app-screen">
      <motion.header className="jam-overview-header" layoutId={`jam-surface-${jam.id}`} transition={{ type: 'spring', stiffness: 360, damping: 34 }}>
        <motion.h1 layoutId={`jam-title-${jam.id}`}>{jam.name}</motion.h1>
        <div className="jam-overview-meta">
          <p className="jam-overview-date">{formatCompactJamDate(jam.startsAt)}</p>
          {jam.location && <p className="jam-overview-location"><MapPin size={16} aria-hidden="true" /> {jam.location}</p>}
          {role && <span className="jam-role-label">{ROLE_LABELS[role]}</span>}
        </div>
      </motion.header>

      <nav className="jam-overview-sections" aria-label={`Sezioni di ${jam.name}`}>
        {sections.map((section) => {
          const Icon = section.icon
          return (
          <MotionLink
            key={section.key}
            className={`jam-section-link jam-section-${section.kind}`}
            to={section.to}
            layoutId={`jam-section-${jamId}-${section.key}`}
            whileTap={reduceMotion ? undefined : { scale: 0.975, x: section.kind === 'plain' ? 2 : 0 }}
            transition={{ type: 'spring', stiffness: 430, damping: 33 }}
          >
            <span className="jam-section-icon"><Icon size={20} aria-hidden="true" /></span>
            <span className="jam-section-copy"><strong>{section.label}</strong>{section.metric !== undefined && <span className="jam-section-metric">{section.metric}</span>}{section.summary && <small>{section.summary}</small>}</span>
            <ChevronRight className="jam-section-arrow" size={18} aria-hidden="true" />
          </MotionLink>
          )
        })}
      </nav>
    </main>
  )
}
