import { ExternalLink, Hand, Headphones, Pencil, Trash2, UserPlus } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BackControl } from '../components/BackControl'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { StatusBadge } from '../components/StatusBadge'
import { useData } from '../data/DataContext'
import { isManager, songDetails } from '../data/selectors'
import { PREPARATION_HELP, PREPARATION_LABELS } from '../domain/labels'
import { statusSummary } from '../domain/songStatus'
import type { PreparationState } from '../domain/types'
import { jamRoutes } from '../navigation'

const PREPARATION_OPTIONS: PreparationState[] = ['UNKNOWN', 'NEEDS_LISTENING', 'KNOWS_STRUCTURE', 'READY']

export function SongDetailPage() {
  const { jamId = '', songId = '' } = useParams()
  const navigate = useNavigate()
  const { data, actions } = useData()
  const [removeSheetOpen, setRemoveSheetOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const song = data.songs.find((item) => item.id === songId && item.jamId === jamId)
  if (!song) return <main className="page"><p>Brano non trovato.</p></main>
  const { slots, assignments, preparations, details } = songDetails(data, song)
  const me = data.profiles.find((profile) => profile.id === data.currentUserId)
  const mySlots = slots.filter((slot) => assignments.some((assignment) => assignment.slotId === slot.id && assignment.userId === data.currentUserId))
  const myPreparation = preparations.find((item) => item.userId === data.currentUserId)?.state ?? 'UNKNOWN'
  const manager = isManager(data, jamId)
  const jam = data.jams.find((item) => item.id === jamId)
  const canDelete = manager || song.proposerId === data.currentUserId
  const statusDetail = details.status === 'INCOMPLETE' || details.status === 'TO_PREPARE' ? statusSummary(details) : null
  return (
    <main className="page detail-page app-screen">
      <div className="screen-bar song-detail-bar"><BackControl to={jamRoutes(jamId).songs} label="Torna a Brani" /></div>
      <section className="song-title-block">
        <motion.h1 layoutId={`song-title-${song.id}`}>{song.title}</motion.h1>
        <p>{song.artist}</p>
        <div className="song-context-row"><span>Proposta di {data.profiles.find((profile) => profile.id === song.proposerId)?.displayName}</span><div>{song.listeningUrl && <a className="listen-link" href={song.listeningUrl} target="_blank" rel="noreferrer"><Headphones size={18} /> Ascolta <ExternalLink size={15} /></a>}{canDelete && <Link className="context-action" to={`/jam/${jamId}/song/${song.id}/edit`}><Pencil size={15} /> Modifica</Link>}</div></div>
      </section>

      <motion.section className={`status-panel status-${details.status.toLowerCase()}`} layout transition={{ type: 'spring', stiffness: 420, damping: 36 }}>
        <div className="status-panel-heading"><StatusBadge status={details.status} large /><span>{details.occupiedSlots}/{details.totalSlots} ruoli</span></div>
        <AnimatePresence mode="wait" initial={false}>{statusDetail && <motion.p key={statusDetail} initial={reduceMotion ? false : { x: 10 }} animate={{ x: 0 }} exit={reduceMotion ? undefined : { x: -10 }} transition={{ type: 'spring', stiffness: 440, damping: 34 }}>{statusDetail}</motion.p>}</AnimatePresence>
      </motion.section>

      <section className="section-block formation-section">
        <div className="section-heading"><div><h2>Formazione</h2></div></div>
        <motion.div className="slot-list" layout>
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
              <motion.div className={`slot-card ${assignment ? 'occupied' : 'empty'}`} key={slot.id} layout transition={{ type: 'spring', stiffness: 410, damping: 36 }}>
                <p className="slot-role">{slot.instrument}{ordinal ? ` ${ordinal}` : ''}</p>
                <div className="slot-person">
                  <AnimatePresence mode="popLayout" initial={false}><motion.span key={musician?.id ?? 'empty'} initial={reduceMotion ? false : { x: 10, scale: 0.98 }} animate={{ x: 0, scale: 1 }} exit={reduceMotion ? undefined : { x: -10, scale: 0.98 }} transition={{ type: 'spring', stiffness: 440, damping: 34 }}><strong>{musician?.displayName ?? 'Nessuno'}</strong>{!musician && <small>{candidates.length ? `${candidates.map((profile) => profile.displayName).join(', ')} disponibili` : 'Nessun musicista compatibile'}</small>}</motion.span></AnimatePresence>
                </div>
                {musician && <span className="slot-state">{prep ? PREPARATION_LABELS[prep] : PREPARATION_LABELS.UNKNOWN}</span>}
                {assignment?.userId === data.currentUserId || (assignment && manager) ? (
                  <motion.button whileTap={reduceMotion ? undefined : { scale: 0.9 }} type="button" className="row-action" aria-label={assignment.userId === data.currentUserId ? `Lascia il ruolo ${slot.instrument}` : `Rimuovi ${musician?.displayName} dal ruolo ${slot.instrument}`} onClick={() => assignment.userId === data.currentUserId ? actions.leaveSlot(slot.id) : actions.removeAssignment(slot.id)}>{assignment.userId === data.currentUserId ? 'Lascia' : 'Rimuovi'}</motion.button>
                ) : !assignment && canPlay ? (
                  <motion.button whileTap={reduceMotion ? undefined : { scale: 0.94 }} className="small-button" onClick={() => actions.claimSlot(slot.id)}><Hand size={16} /> Suono io</motion.button>
                ) : !assignment && (
                  <motion.button whileTap={reduceMotion ? undefined : { scale: 0.94 }} layout className={`small-button ghost ${volunteered ? 'selected' : ''}`} onClick={() => actions.toggleVolunteer(song.id, slot.instrument)}>
                    <UserPlus size={16} /> {volunteered ? 'Disponibile' : 'Mi rendo disponibile'}
                  </motion.button>
                )}
                {!assignment && manager && candidates.length > 0 && (
                  <label className="manual-assignment"><span>Assegna</span><select defaultValue="" onChange={(event) => event.target.value && actions.assignSlot(slot.id, event.target.value)}><option value="" disabled>Scegli musicista</option>{candidates.map((profile) => <option value={profile.id} key={profile.id}>{profile.displayName}</option>)}</select></label>
                )}
              </motion.div>
            )
          })}
        </motion.div>
      </section>

      {mySlots.length > 0 && (
        <section className="section-block prep-section">
          <div className="section-heading"><div><h2>Il tuo stato</h2></div></div>
          <p className="section-intro">Suoni {mySlots.map((slot) => slot.instrument).join(', ')}</p>
          <motion.div className="prep-options" role="radiogroup" aria-label="Il tuo stato di preparazione" layout>
            {PREPARATION_OPTIONS.map((state) => (
              <motion.button layout whileTap={reduceMotion ? undefined : { scale: 0.985 }} type="button" key={state} role="radio" aria-checked={myPreparation === state} className={myPreparation === state ? 'active' : ''} onClick={() => actions.setPreparation(song.id, state)}>
                {myPreparation === state && <motion.span className="prep-selected-surface" layoutId={`prep-selection-${song.id}`} transition={{ type: 'spring', stiffness: 470, damping: 36 }} />}
                <span className="radio-dot" aria-hidden="true" />
                <span><strong>{PREPARATION_LABELS[state]}</strong><small>{PREPARATION_HELP[state]}</small></span>
              </motion.button>
            ))}
          </motion.div>
        </section>
      )}
      {canDelete && <section className="danger-zone"><strong>Proposta</strong><button onClick={() => setRemoveSheetOpen(true)}><Trash2 size={17} /> Rimuovi</button></section>}
      <div className="bottom-spacer" />
      <ConfirmSheet open={removeSheetOpen} title={`Rimuovere “${song.title}”?`} description="Il brano verrà rimosso anche dalla scaletta." confirmLabel="Rimuovi brano" danger onClose={() => setRemoveSheetOpen(false)} onConfirm={() => { actions.removeSong(song.id); navigate(`/jam/${jamId}/songs`) }} />
    </main>
  )
}
