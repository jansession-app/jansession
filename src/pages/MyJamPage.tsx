import { CheckCircle2, Headphones, Music2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { useData } from '../data/DataContext'
import { PREPARATION_LABELS } from '../domain/labels'
import type { PreparationState } from '../domain/types'
import { JamOverviewLink } from '../components/JamOverviewLink'

const GROUPS: { state: PreparationState; label: string }[] = [
  { state: 'UNKNOWN', label: 'Non conosco' },
  { state: 'NEEDS_LISTENING', label: 'Da ascoltare' },
  { state: 'KNOWS_STRUCTURE', label: 'Conosco la struttura' },
  { state: 'READY', label: 'Pronto' },
]

export function MyJamPage() {
  const { jamId = '' } = useParams()
  const { data } = useData()
  const jam = data.jams.find((item) => item.id === jamId)
  const myAssignments = data.assignments.filter((item) => item.userId === data.currentUserId).flatMap((assignment) => {
    const slot = data.slots.find((item) => item.id === assignment.slotId)
    const song = slot && data.songs.find((item) => item.id === slot.songId && item.jamId === jamId)
    if (!slot || !song) return []
    const state = data.preparations.find((item) => item.songId === song.id && item.userId === data.currentUserId)?.state ?? 'UNKNOWN'
    return [{ song, slot, state }]
  })
  const listeningCount = myAssignments.filter((item) => item.state === 'UNKNOWN' || item.state === 'NEEDS_LISTENING').length

  return (
    <main className="page tab-page app-screen">
      <header className="tab-header my-header">
        {jam && <JamOverviewLink jamId={jamId} jamName={jam.name} />}
        <p className="eyebrow">{jam?.name}</p>
        <h1>Prima della jam</h1>
        <div className="workload-number"><strong>{listeningCount}</strong><span>{listeningCount === 1 ? 'brano da ascoltare' : 'brani da ascoltare'}</span></div>
      </header>
      {myAssignments.length ? GROUPS.map((group) => {
        const items = myAssignments.filter((item) => item.state === group.state)
        if (!items.length) return null
        return (
          <section className="my-group" key={group.state}>
            <div className="my-group-heading">{group.state === 'NEEDS_LISTENING' || group.state === 'UNKNOWN' ? <Headphones size={17} /> : group.state === 'READY' ? <CheckCircle2 size={17} /> : <Music2 size={17} />}<h2>{group.label}</h2><span>{items.length}</span></div>
            {items.map(({ song, slot, state }) => <Link key={`${song.id}-${slot.id}`} className="my-song" to={`/jam/${jamId}/song/${song.id}`}><span><strong>{song.title}</strong><small>{song.artist}</small></span><span className="instrument-tag">{slot.instrument}</span><em>{PREPARATION_LABELS[state]}</em></Link>)}
          </section>
        )
      }) : <EmptyState icon={Music2} title="Nessun brano assegnato" body="Quando occupi un ruolo, il brano comparirà qui." />}
      <div className="bottom-spacer" />
    </main>
  )
}
