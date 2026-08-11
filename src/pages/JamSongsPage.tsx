import { Music2, Plus } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { JamOverviewLink } from '../components/JamOverviewLink'
import { SongCard } from '../components/SongCard'
import { useData } from '../data/DataContext'
import { jamSongs } from '../data/selectors'
import type { SongStatus } from '../domain/types'

const MotionLink = motion.create(Link)

const GROUPS: { status: SongStatus; title: string }[] = [
  { status: 'READY', title: 'Pronti' },
  { status: 'PLAYABLE', title: 'Suonabili' },
  { status: 'TO_PREPARE', title: 'Da preparare' },
  { status: 'INCOMPLETE', title: 'Incompleti' },
]

export function JamSongsPage() {
  const { jamId = '' } = useParams()
  const { data } = useData()
  const reduceMotion = useReducedMotion()
  const jam = data.jams.find((item) => item.id === jamId)
  if (!jam) return null
  const songs = jamSongs(data, jamId)
  const playableCount = songs.filter(({ details }) => details.status === 'READY' || details.status === 'PLAYABLE').length

  return (
    <main className="page jam-page app-screen">
      <motion.header className="tab-header jam-hero jam-section-header" layoutId={`jam-section-${jamId}-songs`} transition={{ type: 'spring', stiffness: 370, damping: 34 }}>
        <JamOverviewLink jamId={jamId} jamName={jam.name} />
        <div className="section-title-row"><h1>Brani</h1><span>{songs.length}</span></div>
        {playableCount > 0 && <p className="section-compact-meta">{playableCount} {playableCount === 1 ? 'suonabile' : 'suonabili'}</p>}
      </motion.header>

      <div className="jam-content">
        {songs.length ? <AnimatePresence initial={false}>{GROUPS.map((group) => {
          const grouped = songs.filter(({ details }) => details.status === group.status)
          if (!grouped.length) return null
          return (
            <motion.section className="song-group" key={group.status} layout transition={{ type: 'spring', stiffness: 390, damping: 35 }}>
              <div className="group-heading">
                <div className={`group-mark status-${group.status.toLowerCase()}`} aria-hidden="true" />
                <h2>{group.title} <span>· {grouped.length}</span></h2>
              </div>
              <div className="card-list">
                <AnimatePresence initial={false}>{grouped.map(({ song, details }) => <SongCard key={song.id} jamId={jamId} song={song} details={details} />)}</AnimatePresence>
              </div>
            </motion.section>
          )
        })}</AnimatePresence> : <EmptyState icon={Music2} title="Nessun brano" body="Proponi il primo brano per iniziare." />}
      </div>
      {jam.proposalsOpen && <MotionLink className="floating-action" to={`/jam/${jamId}/propose`} whileTap={reduceMotion ? undefined : { scale: 0.965 }}><Plus size={21} /> Proponi brano</MotionLink>}
    </main>
  )
}
