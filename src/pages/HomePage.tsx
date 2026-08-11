import { ArrowUpRight, CalendarDays, ChevronDown, MapPin, Plus } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { SongCard } from '../components/SongCard'
import { useData } from '../data/DataContext'
import { formatCompactJamDate, jamsForUser, songDetails } from '../data/selectors'
import { PRODUCT_NAME } from '../config/brand'
import { PREPARATION_LABELS } from '../domain/labels'
import { jamRoutes } from '../navigation'

const MotionLink = motion.create(Link)

export function HomePage() {
  const { data } = useData()
  const me = data.profiles.find((profile) => profile.id === data.currentUserId)
  const myJams = jamsForUser(data)
  const myAssignments = data.assignments
    .filter((assignment) => assignment.userId === data.currentUserId)
    .flatMap((assignment) => {
      const slot = data.slots.find((item) => item.id === assignment.slotId)
      const song = slot && data.songs.find((item) => item.id === slot.songId)
      if (!slot || !song) return []
      const state = data.preparations.find((item) => item.songId === song.id && item.userId === data.currentUserId)?.state ?? 'UNKNOWN'
      return [{ song, slot, state, details: songDetails(data, song).details }]
    })
  const workload = myAssignments.filter(({ state }) => state === 'UNKNOWN' || state === 'NEEDS_LISTENING')
  const prepared = myAssignments.filter(({ state }) => state === 'KNOWS_STRUCTURE' || state === 'READY')
  const reduceMotion = useReducedMotion()

  return (
    <main className="page page-home app-screen">
      <header className="home-appbar">
        <span className="home-brand">{PRODUCT_NAME}</span>
        <MotionLink className="create-jam-action" to="/jam/new" whileTap={reduceMotion ? undefined : { scale: 0.96 }}><Plus size={17} aria-hidden="true" /> Nuova jam</MotionLink>
      </header>
      <section className="home-hero">
        <h1>Ciao {me?.displayName ?? 'musicista'}</h1>
      </section>

      <section className="section-block jams-dashboard-section">
          <div className="section-heading">
            <div><h2>Le tue jam</h2></div>
            <span className="count-label">{myJams.length}</span>
          </div>
          <motion.div className="jam-grid" layout>
            <AnimatePresence initial={false}>
            {myJams.map((jam) => {
              const participants = data.members.filter((member) => member.jamId === jam.id).length
              return (
                <MotionLink
                  className="jam-card"
                  to={jamRoutes(jam.id).overview}
                  key={jam.id}
                  layout
                  layoutId={`jam-surface-${jam.id}`}
                  whileTap={reduceMotion ? undefined : { scale: 0.978 }}
                  transition={{ type: 'spring', stiffness: 390, damping: 31 }}
                >
                  <div className="jam-card-copy">
                    <motion.h3 layoutId={`jam-title-${jam.id}`}>{jam.name}</motion.h3>
                    <p className="jam-card-date">{formatCompactJamDate(jam.startsAt)}</p>
                    {jam.location && <p><MapPin size={15} aria-hidden="true" /> {jam.location}</p>}
                  </div>
                  <div className="jam-card-aside"><span className="quiet-label">{participants} {participants === 1 ? 'persona' : 'persone'}</span><span className="jam-card-open" aria-hidden="true"><ArrowUpRight size={17} /></span></div>
                </MotionLink>
              )
            })}
            </AnimatePresence>
          </motion.div>
          {!myJams.length && <Link className="primary-button full-button" to="/jam/new"><Plus size={19} /> Crea la prima jam</Link>}
      </section>

      <section className="section-block preparation-dashboard-section">
          <div className="section-heading">
            <div><h2>Da preparare</h2></div>
            <span className="count-label">{workload.length}</span>
          </div>
          {workload.length ? (
            <div className="card-list">
              <AnimatePresence initial={false}>{workload.map(({ song, slot, details, state }) => <SongCard key={`${song.id}-${slot.id}`} jamId={song.jamId} song={song} details={details} assignmentLabel={`${slot.instrument} · ${PREPARATION_LABELS[state]}`} />)}</AnimatePresence>
            </div>
          ) : <EmptyState icon={CalendarDays} title="Sei in pari" body="Nessun brano assegnato richiede il tuo ascolto." />}
      </section>

      {prepared.length > 0 && <details className="prepared-details">
        <summary>Brani già preparati <span>{prepared.length}</span><ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="prepared-disclosure"><div className="prepared-content">{prepared.map(({ song, slot, state }) => <Link key={`${song.id}-${slot.id}`} to={`/jam/${song.jamId}/song/${song.id}`} className="prepared-row"><span><strong>{song.title}</strong><small>{song.artist}</small></span><span>{slot.instrument}</span><em>{PREPARATION_LABELS[state]}</em></Link>)}</div></div>
      </details>}
    </main>
  )
}
