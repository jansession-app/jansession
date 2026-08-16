import { ChevronLeft, Minus, Plus } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BackControl } from '../components/BackControl'
import { useData } from '../data/DataContext'
import { displayInstrument } from '../domain/songStatus'
import {
  DEFAULT_PROPOSAL_ROLES,
  activeProposalRoles,
  addProposalRole,
  buildSongProposalInput,
  canPublishProposal,
  updateProposalRoleQuantity,
  type ProposalRole,
  type SongProposalStep,
} from '../domain/songProposalFlow'
import { INSTRUMENTS } from '../domain/types'
import { useI18n } from '../i18n/LanguageContext'
import { jamRoutes } from '../navigation'

export function ProposeSongPage() {
  const { jamId = '' } = useParams()
  const navigate = useNavigate()
  const { actions } = useData()
  const [step, setStep] = useState<SongProposalStep>('song')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [listeningUrl, setListeningUrl] = useState('')
  const [roles, setRoles] = useState<ProposalRole[]>(DEFAULT_PROPOSAL_ROLES)
  const [newRole, setNewRole] = useState('Tastiere')
  const [editingLineup, setEditingLineup] = useState(false)
  const [lineupError, setLineupError] = useState(false)
  const reduceMotion = useReducedMotion()
  const { t } = useI18n()

  const reviewLineup = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !artist.trim()) return
    setStep('lineup')
  }

  const updateQuantity = (instrument: string, delta: number) => {
    setRoles((current) => updateProposalRoleQuantity(current, instrument, delta))
    setLineupError(false)
  }

  const addRole = () => {
    setRoles((current) => addProposalRole(current, newRole))
    setLineupError(false)
  }

  const publish = (event: FormEvent) => {
    event.preventDefault()
    if (!canPublishProposal(step, roles)) {
      setLineupError(true)
      return
    }
    const songId = actions.addSong(buildSongProposalInput(jamId, { title, artist, listeningUrl, roles }))
    navigate(`/jam/${jamId}/song/${songId}`)
  }

  const stepMotion = reduceMotion ? {} : {
    initial: { x: step === 'lineup' ? 28 : -28 },
    animate: { x: 0 },
    exit: { x: step === 'lineup' ? -28 : 28 },
    transition: { type: 'spring' as const, stiffness: 430, damping: 38 },
  }

  return (
    <main className="page form-page song-form-page app-screen">
      <header className="flow-header">
        {step === 'song'
          ? <BackControl to={jamRoutes(jamId).songs} label={t('navigation.backToSongs')} />
          : <motion.button className="back-control" type="button" onClick={() => setStep('song')} aria-label={t('songForm.backToSongStep')} whileTap={reduceMotion ? undefined : { scale: 0.9, x: -2 }} transition={{ type: 'spring', stiffness: 520, damping: 28 }}><ChevronLeft size={23} strokeWidth={2.25} aria-hidden="true" /></motion.button>}
        <h1>{step === 'song' ? t('songForm.proposeTitle') : t('songForm.checkLineup')}</h1>
      </header>

      <div className="proposal-step-viewport">
        <AnimatePresence initial={false} mode="wait">
          {step === 'song' ? (
            <motion.form key="song" onSubmit={reviewLineup} {...stepMotion}>
              <section className="form-section"><h2>{t('songForm.song')}</h2>
                <label className="field"><span>{t('songForm.title')}</span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Reptilia" /></label>
                <label className="field"><span>{t('songForm.artist')}</span><input required value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="The Strokes" /></label>
                <label className="field"><span>{t('songForm.listeningLink')} <em>{t('common.optional')}</em></span><input type="url" value={listeningUrl} onChange={(event) => setListeningUrl(event.target.value)} placeholder="https://…" /></label>
              </section>
              <button className="primary-button full-button" type="submit">{t('songForm.continue')}</button>
            </motion.form>
          ) : (
            <motion.form key="lineup" onSubmit={publish} {...stepMotion}>
              <section className="form-section lineup-review-section">
                <p className="lineup-purpose">{t('songForm.lineupPurpose')}</p>
                {editingLineup ? (
                  <fieldset className="roles-fieldset"><legend className="sr-only">{t('songForm.requiredFormation')}</legend>
                    <motion.div className="role-editor" layout>
                      {roles.map((role) => <motion.div className="role-row" key={role.instrument} layout transition={{ type: 'spring', stiffness: 440, damping: 35 }}>
                        <strong>{displayInstrument(role.instrument, t)}</strong>
                        <div className="quantity-control"><motion.button whileTap={reduceMotion ? undefined : { scale: 0.86 }} type="button" onClick={() => updateQuantity(role.instrument, -1)} disabled={role.quantity === 0} aria-label={t('songForm.decreaseAria', { instrument: displayInstrument(role.instrument, t) })}><Minus size={17} /></motion.button><motion.span key={role.quantity} initial={reduceMotion ? false : { scale: 0.72 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 28 }}>{role.quantity}</motion.span><motion.button whileTap={reduceMotion ? undefined : { scale: 0.86 }} type="button" onClick={() => updateQuantity(role.instrument, 1)} aria-label={t('songForm.increaseAria', { instrument: displayInstrument(role.instrument, t) })}><Plus size={17} /></motion.button></div>
                      </motion.div>)}
                    </motion.div>
                    <div className="add-role-row">
                      <label><span className="sr-only">{t('songForm.otherInstrument')}</span><input list="instruments" value={newRole} onChange={(event) => setNewRole(event.target.value)} /></label>
                      <datalist id="instruments">{INSTRUMENTS.map((instrument) => <option key={instrument} value={instrument}>{displayInstrument(instrument, t)}</option>)}</datalist>
                      <button type="button" className="secondary-button" onClick={addRole}><Plus size={18} /> {t('songForm.addInstrument')}</button>
                    </div>
                  </fieldset>
                ) : (
                  <motion.ul className="lineup-summary" layout aria-label={t('songForm.requiredFormation')}>
                    {activeProposalRoles(roles).map((role) => <motion.li key={role.instrument} layout><strong>{displayInstrument(role.instrument, t)}</strong><span>×{role.quantity}</span></motion.li>)}
                  </motion.ul>
                )}
                {lineupError && <p className="form-error" role="alert">{t('songForm.emptyLineupError')}</p>}
              </section>
              <div className="proposal-actions">
                {!editingLineup && <button className="secondary-button full-button" type="button" onClick={() => setEditingLineup(true)}>{t('songForm.editLineup')}</button>}
                <button className="primary-button full-button" type="submit">{t('songForm.confirmPublish')}</button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
