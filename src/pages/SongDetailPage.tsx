import { ExternalLink, Hand, Headphones, Pencil, Trash2, UserPlus } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StatusBadge } from '../components/StatusBadge'
import { useData } from '../data/DataContext'
import { isManager, songDetails } from '../data/selectors'
import { PREPARATION_HELP, PREPARATION_LABELS } from '../domain/labels'
import { statusSummary } from '../domain/songStatus'
import type { PreparationState } from '../domain/types'

const PREPARATION_OPTIONS: PreparationState[] = ['UNKNOWN', 'NEEDS_LISTENING', 'KNOWS_STRUCTURE', 'READY']

export function SongDetailPage() {
  const { jamId = '', songId = '' } = useParams()
  const navigate = useNavigate()
  const { data, actions } = useData()
  const song = data.songs.find((item) => item.id === songId && item.jamId === jamId)
  if (!song) return <main className="page"><p>Brano non trovato.</p></main>
  const { slots, assignments, preparations, details } = songDetails(data, song)
  const me = data.profiles.find((profile) => profile.id === data.currentUserId)
  const mySlots = slots.filter((slot) => assignments.some((assignment) => assignment.slotId === slot.id && assignment.userId === data.currentUserId))
  const myPreparation = preparations.find((item) => item.userId === data.currentUserId)?.state ?? 'UNKNOWN'
  const manager = isManager(data, jamId)
  const jam = data.jams.find((item) => item.id === jamId)
  const canDelete = manager || song.proposerId === data.currentUserId
  return (
    <main className="page detail-page app-screen">
      <section className="song-title-block">
        <h1>{song.title}</h1>
        <p>{song.artist}</p>
        <div className="song-context-row"><span>Proposta di {data.profiles.find((profile) => profile.id === song.proposerId)?.displayName}</span><div>{song.listeningUrl && <a className="listen-link" href={song.listeningUrl} target="_blank" rel="noreferrer"><Headphones size={18} /> Ascolta <ExternalLink size={15} /></a>}{canDelete && <Link className="context-action" to={`/jam/${jamId}/song/${song.id}/edit`}><Pencil size={15} /> Modifica</Link>}</div></div>
      </section>

      <section className={`status-panel status-${details.status.toLowerCase()}`}>
        <StatusBadge status={details.status} large />
        <p key={details.status}>{statusSummary(details)}</p>
        <span>{details.occupiedSlots} di {details.totalSlots} ruoli coperti</span>
      </section>

      <section className="section-block formation-section">
        <div className="section-heading"><div><span className="section-number">01</span><h2>Formazione</h2></div></div>
        <div className="slot-list">
          {slots.map((slot) => {
            const assignment = assignments.find((item) => item.slotId === slot.id)
            const musician = assignment && data.profiles.find((profile) => profile.id === assignment.userId)
            const prep = assignment && preparations.find((item) => item.userId === assignment.userId)?.state
            const matchingSlots = slots.filter((item) => item.instrument === slot.instrument)
            const ordinal = matchingSlots.length > 1 ? matchingSlots.findIndex((item) => item.id === slot.id) + 1 : null
            const canPlay = me?.instruments.includes(slot.instrument) && (jam?.assignmentsOpen || manager)
            const volunteered = data.volunteers.some((item) => item.songId === song.id && item.instrument === slot.instrument && item.userId === data.currentUserId)
            const candidates = data.profiles.filter((profile) => profile.instruments.includes(slot.instrument) && data.members.some((member) => member.jamId === jamId && member.userId === profile.id))
            return (
              <div className={`slot-card ${assignment ? 'occupied' : 'empty'}`} key={slot.id}>
                <p className="slot-role">{slot.instrument}{ordinal ? ` ${ordinal}` : ''}</p>
                <div className="slot-person">
                  <strong>{musician?.displayName ?? 'Nessuno'}</strong>
                  {!musician && <small>{candidates.length ? `${candidates.map((profile) => profile.displayName).join(', ')} disponibili` : 'Nessun musicista compatibile'}</small>}
                </div>
                {musician && <span className="slot-state">{prep ? PREPARATION_LABELS[prep] : PREPARATION_LABELS.UNKNOWN}</span>}
                {assignment?.userId === data.currentUserId || (assignment && manager) ? (
                  <button type="button" className="row-action" aria-label={assignment.userId === data.currentUserId ? `Lascia il ruolo ${slot.instrument}` : `Rimuovi ${musician?.displayName} dal ruolo ${slot.instrument}`} onClick={() => assignment.userId === data.currentUserId ? actions.leaveSlot(slot.id) : actions.removeAssignment(slot.id)}>{assignment.userId === data.currentUserId ? 'Lascia' : 'Rimuovi'}</button>
                ) : !assignment && canPlay ? (
                  <button className="small-button" onClick={() => actions.claimSlot(slot.id)}><Hand size={16} /> Suono io</button>
                ) : !assignment && (
                  <button className={`small-button ghost ${volunteered ? 'selected' : ''}`} onClick={() => actions.toggleVolunteer(song.id, slot.instrument)}>
                    <UserPlus size={16} /> {volunteered ? 'Disponibile' : 'Mi rendo disponibile'}
                  </button>
                )}
                {!assignment && manager && candidates.length > 0 && (
                  <label className="manual-assignment"><span>Assegna</span><select defaultValue="" onChange={(event) => event.target.value && actions.assignSlot(slot.id, event.target.value)}><option value="" disabled>Scegli musicista</option>{candidates.map((profile) => <option value={profile.id} key={profile.id}>{profile.displayName}</option>)}</select></label>
                )}
              </div>
            )
          })}
        </div>
        <p className="microcopy">La disponibilità non occupa un ruolo. Ogni posto può avere un solo musicista assegnato.</p>
      </section>

      {mySlots.length > 0 && (
        <section className="section-block prep-section">
          <div className="section-heading"><div><span className="section-number">02</span><h2>Il tuo stato</h2></div></div>
          <p className="section-intro">Suoni {mySlots.map((slot) => slot.instrument).join(', ')}. Quanto conosci il brano?</p>
          <div className="prep-options" role="radiogroup" aria-label="Il tuo stato di preparazione">
            {PREPARATION_OPTIONS.map((state) => (
              <button type="button" key={state} role="radio" aria-checked={myPreparation === state} className={myPreparation === state ? 'active' : ''} onClick={() => actions.setPreparation(song.id, state)}>
                <span className="radio-dot" aria-hidden="true" />
                <span><strong>{PREPARATION_LABELS[state]}</strong><small>{PREPARATION_HELP[state]}</small></span>
              </button>
            ))}
          </div>
        </section>
      )}
      {canDelete && <section className="danger-zone"><div><strong>Rimuovi proposta</strong><span>Il brano verrà tolto anche dalla scaletta.</span></div><button onClick={() => { if (window.confirm(`Rimuovere “${song.title}”?`)) { actions.removeSong(song.id); navigate(`/jam/${jamId}/songs`) } }}><Trash2 size={17} /> Rimuovi</button></section>}
      <div className="bottom-spacer" />
    </main>
  )
}
