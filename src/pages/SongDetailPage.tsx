import { ExternalLink, Hand, Headphones, Pencil, Trash2, UserPlus } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BackControl } from '../components/BackControl'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { StatusBadge } from '../components/StatusBadge'
import { useData } from '../data/DataContext'
import { isManager, songDetails } from '../data/selectors'
import { PREPARATION_HELP_KEYS, PREPARATION_LABEL_KEYS } from '../domain/labels'
import { displayInstrument, statusSummary } from '../domain/songStatus'
import type { PreparationState } from '../domain/types'
import { jamRoutes } from '../navigation'
import { useI18n } from '../i18n/LanguageContext'

const PREPARATION_OPTIONS: PreparationState[] = ['UNKNOWN', 'NEEDS_LISTENING', 'KNOWS_STRUCTURE', 'READY']

export function SongDetailPage() {
  const { jamId = '', songId = '' } = useParams()
  const navigate = useNavigate()
  const { data, actions } = useData()
  const [removeSheetOpen, setRemoveSheetOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const { t } = useI18n()
  const song = data.songs.find((item) => item.id === songId && item.jamId === jamId)
  if (!song) return <main className="page"><p>{t('song.notFound')}</p></main>
  const { slots, assignments, preparations, details } = songDetails(data, song)
  const me = data.profiles.find((profile) => profile.id === data.currentUserId)
  const mySlots = slots.filter((slot) => assignments.some((assignment) => assignment.slotId === slot.id && assignment.userId === data.currentUserId))
  const myPreparation = preparations.find((item) => item.userId === data.currentUserId)?.state ?? 'UNKNOWN'
  const manager = isManager(data, jamId)
  const jam = data.jams.find((item) => item.id === jamId)
  const canDelete = manager || song.proposerId === data.currentUserId
  const statusDetail = details.status === 'INCOMPLETE' || details.status === 'TO_PREPARE' ? statusSummary(details, t) : null
  return (
    <main className="page detail-page app-screen">
      <div className="screen-bar song-detail-bar"><BackControl to={jamRoutes(jamId).songs} label={t('navigation.backToSongs')} /></div>
      <section className="song-title-block">
        <motion.h1 layoutId={`song-title-${song.id}`}>{song.title}</motion.h1>
        <p>{song.artist}</p>
        <div className="song-context-row"><span>{t('song.proposedBy', { name: data.profiles.find((profile) => profile.id === song.proposerId)?.displayName ?? '' })}</span><div>{song.listeningUrl && <a className="listen-link" href={song.listeningUrl} target="_blank" rel="noreferrer"><Headphones size={18} /> {t('song.listen')} <ExternalLink size={15} /></a>}{canDelete && <Link className="context-action" to={`/jam/${jamId}/song/${song.id}/edit`}><Pencil size={15} /> {t('common.edit')}</Link>}</div></div>
      </section>

      <motion.section className={`status-panel status-${details.status.toLowerCase()}`} layout transition={{ type: 'spring', stiffness: 420, damping: 36 }}>
        <div className="status-panel-heading"><StatusBadge status={details.status} large /><span>{t('song.rolesCount', { occupied: details.occupiedSlots, total: details.totalSlots })}</span></div>
        <AnimatePresence mode="wait" initial={false}>{statusDetail && <motion.p key={statusDetail} initial={reduceMotion ? false : { x: 10 }} animate={{ x: 0 }} exit={reduceMotion ? undefined : { x: -10 }} transition={{ type: 'spring', stiffness: 440, damping: 34 }}>{statusDetail}</motion.p>}</AnimatePresence>
      </motion.section>

      <section className="section-block formation-section">
        <div className="section-heading"><div><h2>{t('song.formation')}</h2></div></div>
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
                <p className="slot-role">{displayInstrument(slot.instrument, t)}{ordinal ? ` ${ordinal}` : ''}</p>
                <div className="slot-person">
                  <AnimatePresence mode="popLayout" initial={false}><motion.span key={musician?.id ?? 'empty'} initial={reduceMotion ? false : { x: 10, scale: 0.98 }} animate={{ x: 0, scale: 1 }} exit={reduceMotion ? undefined : { x: -10, scale: 0.98 }} transition={{ type: 'spring', stiffness: 440, damping: 34 }}><strong>{musician?.displayName ?? t('song.nobody')}</strong>{!musician && <small>{candidates.length ? t('song.compatibleAvailable', { names: candidates.map((profile) => profile.displayName).join(', ') }) : t('song.noCompatibleMusician')}</small>}</motion.span></AnimatePresence>
                </div>
                {musician && <span className="slot-state">{t(PREPARATION_LABEL_KEYS[prep ?? 'UNKNOWN'])}</span>}
                {assignment?.userId === data.currentUserId || (assignment && manager) ? (
                  <motion.button whileTap={reduceMotion ? undefined : { scale: 0.9 }} type="button" className="row-action" aria-label={assignment.userId === data.currentUserId ? t('song.leaveRoleAria', { instrument: displayInstrument(slot.instrument, t) }) : t('song.removeAssignmentAria', { name: musician?.displayName ?? '', instrument: displayInstrument(slot.instrument, t) })} onClick={() => assignment.userId === data.currentUserId ? actions.leaveSlot(slot.id) : actions.removeAssignment(slot.id)}>{t(assignment.userId === data.currentUserId ? 'song.leaveRole' : 'song.removeAssignment')}</motion.button>
                ) : !assignment && canPlay ? (
                  <motion.button whileTap={reduceMotion ? undefined : { scale: 0.94 }} className="small-button" onClick={() => actions.claimSlot(slot.id)}><Hand size={16} /> {t('song.iWillPlay')}</motion.button>
                ) : !assignment && (
                  <motion.button whileTap={reduceMotion ? undefined : { scale: 0.94 }} layout className={`small-button ghost ${volunteered ? 'selected' : ''}`} onClick={() => actions.toggleVolunteer(song.id, slot.instrument)}>
                    <UserPlus size={16} /> {t(volunteered ? 'song.available' : 'song.volunteer')}
                  </motion.button>
                )}
                {!assignment && manager && candidates.length > 0 && (
                  <label className="manual-assignment"><span>{t('song.assign')}</span><select defaultValue="" onChange={(event) => event.target.value && actions.assignSlot(slot.id, event.target.value)}><option value="" disabled>{t('song.chooseMusician')}</option>{candidates.map((profile) => <option value={profile.id} key={profile.id}>{profile.displayName}</option>)}</select></label>
                )}
              </motion.div>
            )
          })}
        </motion.div>
      </section>

      {mySlots.length > 0 && (
        <section className="section-block prep-section">
          <div className="section-heading"><div><h2>{t('song.yourStatus')}</h2></div></div>
          <p className="section-intro">{t('song.youPlay', { instruments: mySlots.map((slot) => displayInstrument(slot.instrument, t)).join(', ') })}</p>
          <motion.div className="prep-options" role="radiogroup" aria-label={t('song.preparationAria')} layout>
            {PREPARATION_OPTIONS.map((state) => (
              <motion.button layout whileTap={reduceMotion ? undefined : { scale: 0.985 }} type="button" key={state} role="radio" aria-checked={myPreparation === state} className={myPreparation === state ? 'active' : ''} onClick={() => actions.setPreparation(song.id, state)}>
                {myPreparation === state && <motion.span className="prep-selected-surface" layoutId={`prep-selection-${song.id}`} transition={{ type: 'spring', stiffness: 470, damping: 36 }} />}
                <span className="radio-dot" aria-hidden="true" />
                <span><strong>{t(PREPARATION_LABEL_KEYS[state])}</strong><small>{t(PREPARATION_HELP_KEYS[state])}</small></span>
              </motion.button>
            ))}
          </motion.div>
        </section>
      )}
      {canDelete && <section className="danger-zone"><strong>{t('song.proposal')}</strong><button onClick={() => setRemoveSheetOpen(true)}><Trash2 size={17} /> {t('common.remove')}</button></section>}
      <div className="bottom-spacer" />
      <ConfirmSheet open={removeSheetOpen} title={t('song.removeTitle', { title: song.title })} description={t('song.removeDescription')} confirmLabel={t('song.removeConfirm')} danger onClose={() => setRemoveSheetOpen(false)} onConfirm={() => { actions.removeSong(song.id); navigate(`/jam/${jamId}/songs`) }} />
    </main>
  )
}
