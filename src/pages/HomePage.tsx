import { CalendarDays, ChevronDown, MapPin, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { SongCard } from '../components/SongCard'
import { useData } from '../data/DataContext'
import { formatJamDate, jamsForUser, songDetails } from '../data/selectors'
import { PRODUCT_NAME } from '../config/brand'
import { PREPARATION_LABELS } from '../domain/labels'

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

  return (
    <main className="page page-home app-screen">
      <header className="home-appbar">
        <span className="home-brand">{PRODUCT_NAME}</span>
      </header>
      <section className="home-hero">
        <h1>Ciao {me?.displayName ?? 'musicista'}</h1>
        <p className="lead">Ecco cosa richiede attenzione prima della prossima jam.</p>
      </section>

      <section className="section-block">
          <div className="section-heading">
            <div><span className="section-number">01</span><h2>Da preparare</h2></div>
            <span className="count-pill">{workload.length}</span>
          </div>
          {workload.length ? (
            <div className="card-list">
              {workload.map(({ song, slot, details, state }) => <SongCard key={`${song.id}-${slot.id}`} jamId={song.jamId} song={song} details={details} assignmentLabel={`${slot.instrument} · ${PREPARATION_LABELS[state]}`} />)}
            </div>
          ) : <EmptyState icon={CalendarDays} title="Sei in pari" body="Nessun brano assegnato richiede il tuo ascolto." />}
      </section>

      <section className="section-block">
          <div className="section-heading">
            <div><span className="section-number">02</span><h2>Le tue jam</h2></div>
          </div>
          <div className="jam-grid">
            {myJams.map((jam) => {
              const participants = data.members.filter((member) => member.jamId === jam.id).length
              return (
                <Link className="jam-card" to={`/jam/${jam.id}/songs`} key={jam.id}>
                  <div className="jam-card-date"><strong>{new Date(jam.startsAt).getDate()}</strong><span>{new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(new Date(jam.startsAt))}</span></div>
                  <div>
                    <h3>{jam.name}</h3>
                    <p><CalendarDays size={15} /> {formatJamDate(jam.startsAt, true)}</p>
                    {jam.location && <p><MapPin size={15} /> {jam.location}</p>}
                    <span className="quiet-label">{participants} {participants === 1 ? 'partecipante' : 'partecipanti'}</span>
                  </div>
                </Link>
              )
            })}
          </div>
          <Link className="primary-button full-button" to="/jam/new"><Plus size={19} /> Nuova jam</Link>
      </section>

      {prepared.length > 0 && <details className="prepared-details">
        <summary>Brani già preparati <span>{prepared.length}</span><ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="prepared-disclosure"><div className="prepared-content">{prepared.map(({ song, slot, state }) => <Link key={`${song.id}-${slot.id}`} to={`/jam/${song.jamId}/song/${song.id}`} className="prepared-row"><span><strong>{song.title}</strong><small>{song.artist}</small></span><span>{slot.instrument}</span><em>{PREPARATION_LABELS[state]}</em></Link>)}</div></div>
      </details>}
    </main>
  )
}
