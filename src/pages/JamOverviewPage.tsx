import { ChevronRight, MapPin } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { formatJamDate, jamSongs } from '../data/selectors'
import type { JamRole } from '../domain/types'
import { jamRoutes } from '../navigation'

const ROLE_LABELS: Record<JamRole, string> = {
  organizer: 'Proprietario',
  'co-organizer': 'Co-organizzatore',
  musician: 'Musicista',
}

export function JamOverviewPage() {
  const { jamId = '' } = useParams()
  const { data } = useData()
  const jam = data.jams.find((item) => item.id === jamId)
  if (!jam) return null

  const routes = jamRoutes(jamId)
  const songs = jamSongs(data, jamId)
  const playableCount = songs.filter(({ details }) => details.status === 'READY' || details.status === 'PLAYABLE').length
  const setlistCount = data.setlist.filter((item) => item.jamId === jamId).length
  const participantCount = data.members.filter((member) => member.jamId === jamId).length
  const role = data.members.find((member) => member.jamId === jamId && member.userId === data.currentUserId)?.role
  const sections = [
    { label: 'Brani', summary: songs.length ? `${songs.length} proposte · ${playableCount} suonabili` : 'Nessuna proposta', to: routes.songs },
    { label: 'Scaletta', summary: setlistCount === 1 ? '1 brano in scaletta' : `${setlistCount} brani in scaletta`, to: routes.setlist },
    { label: 'Musicisti', summary: participantCount === 1 ? '1 partecipante' : `${participantCount} partecipanti`, to: routes.musicians },
    { label: 'Impostazioni', summary: 'Dettagli e gestione della jam', to: routes.settings },
  ]

  return (
    <main className="page jam-overview-page app-screen">
      <header className="jam-overview-header">
        <p className="eyebrow">Jam</p>
        <h1>{jam.name}</h1>
        <p className="jam-overview-date">{formatJamDate(jam.startsAt, true)}</p>
        {jam.location && <p className="jam-overview-location"><MapPin size={16} aria-hidden="true" /> {jam.location}</p>}
        {role && <span className="jam-role-label">{ROLE_LABELS[role]}</span>}
      </header>

      <nav className="jam-overview-sections" aria-label={`Sezioni di ${jam.name}`}>
        {sections.map((section) => (
          <Link key={section.label} to={section.to}>
            <span><strong>{section.label}</strong><small>{section.summary}</small></span>
            <ChevronRight size={19} aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </main>
  )
}
