import { ArrowDown, ArrowUp, ListMusic, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/StatusBadge'
import { useData } from '../data/DataContext'
import { formatJamDate, isManager, jamSongs, songDetails } from '../data/selectors'
import { canAddToSetlist, statusSummary } from '../domain/songStatus'
import { useFlipList } from '../hooks/useFlipList'

export function SetlistPage() {
  const { jamId = '' } = useParams()
  const { data, actions } = useData()
  const jam = data.jams.find((item) => item.id === jamId)
  const manager = isManager(data, jamId)
  const items = data.setlist.filter((item) => item.jamId === jamId).sort((a, b) => a.position - b.position)
  const available = jamSongs(data, jamId).filter(({ song, details }) => canAddToSetlist(details.status) && !items.some((item) => item.songId === song.id))
  const setlistRef = useFlipList(items.map((item) => item.id).join('|'))

  return (
    <main className="page tab-page app-screen">
      <header className="tab-header">
        {jam && <div className="jam-context"><strong>{jam.name}</strong><span>{formatJamDate(jam.startsAt, true)}</span></div>}
        <h1>Scaletta</h1>
        <p>I brani restano in posizione anche se la formazione cambia.</p>
      </header>
      {items.length ? (
        <ol className="setlist-list" ref={setlistRef}>
          {items.map((item, index) => {
            const song = data.songs.find((candidate) => candidate.id === item.songId)
            if (!song) return null
            const details = songDetails(data, song).details
            const invalid = !canAddToSetlist(details.status)
            return (
              <li key={item.id} data-flip-key={item.id} className={invalid ? 'invalid' : ''}>
                <span className="setlist-number">{String(item.position).padStart(2, '0')}</span>
                <Link to={`/jam/${jamId}/song/${song.id}`} className="setlist-song">
                  <h3>{song.title}</h3><p>{song.artist}</p>
                  {invalid ? <span className="setlist-warning"><TriangleAlert size={15} /> {statusSummary(details)}</span> : <StatusBadge status={details.status} />}
                </Link>
                {manager && <div className="order-controls">
                  <button onClick={() => actions.moveSetlist(song.id, -1)} disabled={index === 0} aria-label={`Sposta ${song.title} su`}><ArrowUp size={17} /></button>
                  <button onClick={() => actions.moveSetlist(song.id, 1)} disabled={index === items.length - 1} aria-label={`Sposta ${song.title} giù`}><ArrowDown size={17} /></button>
                  <button onClick={() => actions.removeFromSetlist(song.id)} aria-label={`Rimuovi ${song.title} dalla scaletta`}><Trash2 size={17} /></button>
                </div>}
              </li>
            )
          })}
        </ol>
      ) : <EmptyState icon={ListMusic} title="La scaletta è vuota" body="I brani suonabili e pronti possono essere aggiunti qui." />}

      {manager && available.length > 0 && <section className="section-block add-setlist">
        <div className="section-heading"><div><span className="section-number">+</span><h2>Aggiungi</h2></div></div>
        {available.map(({ song, details }) => (
          <button key={song.id} className="add-song-row" onClick={() => actions.addToSetlist(jamId, song.id)}>
            <span><strong>{song.title}</strong><small>{song.artist}</small></span>
            <StatusBadge status={details.status} /><Plus size={18} />
          </button>
        ))}
      </section>}
      {!manager && <p className="permission-note">La scaletta è gestita dagli organizzatori.</p>}
      <div className="bottom-spacer" />
    </main>
  )
}
