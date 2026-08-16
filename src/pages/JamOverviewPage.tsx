import { ChevronRight, ExternalLink, ListMusic, MapPin, Music2, Navigation, Settings2, UsersRound, type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet'
import { useData } from '../data/DataContext'
import { formatCompactJamDate, jamSongs } from '../data/selectors'
import { jamPreparationTasks } from '../data/personalPreparation'
import { jamLocationDetails } from '../domain/jamLocation'
import type { JamRole } from '../domain/types'
import { displayInstrument } from '../domain/songStatus'
import { jamRoutes } from '../navigation'
import { useI18n } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'

const MotionLink = motion.create(Link)

const ROLE_LABELS: Record<JamRole, TranslationKey> = {
  organizer: 'jam.role.owner',
  'co-organizer': 'jam.role.coOrganizer',
  musician: 'jam.role.musician',
}

export function JamOverviewPage() {
  const { jamId = '' } = useParams()
  const { data, actions } = useData()
  const reduceMotion = useReducedMotion()
  const [directionsOpen, setDirectionsOpen] = useState(false)
  const { language, t } = useI18n()
  const jam = data.jams.find((item) => item.id === jamId)
  if (!jam) return null

  const routes = jamRoutes(jamId)
  const songs = jamSongs(data, jamId)
  const readyCount = songs.filter(({ details }) => details.status === 'READY').length
  const tasks = jamPreparationTasks(data, jamId)
  const setlistCount = data.setlist.filter((item) => item.jamId === jamId).length
  const participantCount = data.members.filter((member) => member.jamId === jamId).length
  const role = data.members.find((member) => member.jamId === jamId && member.userId === data.currentUserId)?.role
  const location = jamLocationDetails(jam)
  const sections: { key: string; label: string; metric?: number; summary?: string; to: string; icon: LucideIcon; kind: string }[] = [
    { key: 'songs', label: t('jam.overview.songs'), metric: songs.length, summary: readyCount ? t(readyCount === 1 ? 'jam.overview.readyOne' : 'jam.overview.readyMany', { count: readyCount }) : undefined, to: routes.songs, icon: Music2, kind: 'feature' },
    { key: 'setlist', label: t('jam.overview.setlist'), metric: setlistCount, summary: t('jam.overview.inSetlist'), to: routes.setlist, icon: ListMusic, kind: 'compact' },
    { key: 'musicians', label: t('jam.overview.musicians'), metric: participantCount, summary: t(participantCount === 1 ? 'jam.overview.participant' : 'jam.overview.participants'), to: routes.musicians, icon: UsersRound, kind: 'compact' },
    { key: 'settings', label: t('jam.overview.settings'), to: routes.settings, icon: Settings2, kind: 'plain' },
  ]

  return (
    <main className="page jam-overview-page app-screen">
      <motion.header className="jam-overview-header" layoutId={`jam-surface-${jam.id}`} transition={{ type: 'spring', stiffness: 360, damping: 34 }}>
        <motion.h1 layoutId={`jam-title-${jam.id}`}>{jam.name}</motion.h1>
        <div className="jam-overview-meta">
          <p className="jam-overview-date">{formatCompactJamDate(jam.startsAt, language)}</p>
          {role && <span className="jam-role-label">{t(ROLE_LABELS[role])}</span>}
          {(location.name || location.address) && <div className="jam-overview-location"><MapPin size={16} aria-hidden="true" /><span className="jam-location-copy">{location.name && <strong>{location.name}</strong>}{location.address && <small>{location.address}</small>}</span>{location.mapLinks && <motion.button type="button" className="location-directions-action" whileTap={reduceMotion ? undefined : { scale: 0.96 }} onClick={() => setDirectionsOpen(true)}><Navigation size={15} aria-hidden="true" /> {t('jam.location.directions')}</motion.button>}</div>}
        </div>
      </motion.header>

      <motion.section className="jam-todo-section" layout>
        <div className="section-heading"><div><h2>{t('jam.todo.title')}</h2></div>{tasks.length > 0 && <span className="count-label">{tasks.length}</span>}</div>
        <AnimatePresence initial={false} mode="popLayout">
          {tasks.length ? tasks.map(({ song, instruments }) => (
            <motion.div
              className="jam-todo-row"
              key={song.id}
              layout
              initial={reduceMotion ? false : { x: 16, scale: 0.985 }}
              animate={{ x: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { x: -18, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 430, damping: 35 }}
            >
              <Link className="jam-todo-song" to={`/jam/${jamId}/song/${song.id}`}><strong>{song.title}</strong><small>{instruments.map((instrument) => displayInstrument(instrument, t)).join(' · ')}</small></Link>
              <motion.button type="button" whileTap={reduceMotion ? undefined : { scale: 0.95 }} onClick={() => actions.setPreparation(song.id, 'READY')}>{t('preparation.markReady')}</motion.button>
            </motion.div>
          )) : <motion.p className="jam-todo-empty" key="ready" initial={reduceMotion ? false : { y: 6 }} animate={{ y: 0 }}>{t('jam.todo.ready')}</motion.p>}
        </AnimatePresence>
      </motion.section>

      <nav className="jam-overview-sections" aria-label={t('navigation.jamSectionsAria', { jamName: jam.name })}>
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
      <BottomSheet open={directionsOpen && Boolean(location.mapLinks)} title={t('jam.location.directions')} onClose={() => setDirectionsOpen(false)}>
        {location.mapLinks && <div className="map-sheet-actions"><a href={location.mapLinks.appleMaps} target="_blank" rel="noreferrer">{t('jam.location.openAppleMaps')} <ExternalLink size={17} aria-hidden="true" /></a><a href={location.mapLinks.googleMaps} target="_blank" rel="noreferrer">{t('jam.location.openGoogleMaps')} <ExternalLink size={17} aria-hidden="true" /></a></div>}
      </BottomSheet>
    </main>
  )
}
