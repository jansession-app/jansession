import { MapPin, Plus, UsersRound } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { SongCard } from '../components/SongCard'
import { useData } from '../data/DataContext'
import { formatJamDate, jamSongs } from '../data/selectors'
import type { SongStatus } from '../domain/types'

const GROUPS: { status: SongStatus; title: string; note: string }[] = [
  { status: 'READY', title: 'Pronti', note: 'Tutti sono pronti' },
  { status: 'PLAYABLE', title: 'Suonabili', note: 'La formazione conosce la struttura' },
  { status: 'TO_PREPARE', title: 'Da preparare', note: 'Formazione completa, serve ascolto' },
  { status: 'INCOMPLETE', title: 'Incompleti', note: 'Manca almeno un ruolo' },
]

export function JamSongsPage() {
  const { jamId = '' } = useParams()
  const { data } = useData()
  const jam = data.jams.find((item) => item.id === jamId)
  if (!jam) return null
  const songs = jamSongs(data, jamId)
  const playableCount = songs.filter(({ details }) => details.status === 'READY' || details.status === 'PLAYABLE').length
  const participantCount = data.members.filter((member) => member.jamId === jamId).length

  return (
    <main className="page jam-page app-screen">
      <header className="tab-header jam-hero">
        <div className="jam-context"><strong>{jam.name}</strong><span>{formatJamDate(jam.startsAt, true)}</span></div>
        <h1>Brani</h1>
        <div className="jam-facts">
          <span><UsersRound size={16} /> {participantCount} partecipanti</span>
          {jam.location && <span><MapPin size={16} /> {jam.location}</span>}
        </div>
        <div className="playable-summary"><strong>{playableCount}</strong><span>{playableCount === 1 ? 'brano suonabile' : 'brani suonabili'}</span></div>
      </header>

      <div className="jam-content">
        {songs.length ? GROUPS.map((group) => {
          const grouped = songs.filter(({ details }) => details.status === group.status)
          if (!grouped.length) return null
          return (
            <section className="song-group" key={group.status}>
              <div className="group-heading">
                <div className={`group-mark status-${group.status.toLowerCase()}`} aria-hidden="true" />
                <div><h2>{group.title}</h2><p>{group.note}</p></div>
                <span>{grouped.length}</span>
              </div>
              <div className="card-list">
                {grouped.map(({ song, details }) => <SongCard key={song.id} jamId={jamId} song={song} details={details} />)}
              </div>
            </section>
          )
        }) : <EmptyState icon={UsersRound} title="Nessun brano proposto" body="Proponi il primo brano e indica la formazione che serve." />}
      </div>
      {jam.proposalsOpen && <Link className="floating-action" to={`/jam/${jamId}/propose`}><Plus size={22} /> Proponi brano</Link>}
    </main>
  )
}
