import { Minus, Plus, Trash2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BackControl } from '../components/BackControl'
import { useData } from '../data/DataContext'
import { INSTRUMENTS } from '../domain/types'
import { jamRoutes } from '../navigation'
import { useI18n } from '../i18n/LanguageContext'
import { displayInstrument } from '../domain/songStatus'

interface RoleInput { instrument: string; quantity: number }

const defaultRoles: RoleInput[] = [
  { instrument: 'Voce', quantity: 1 },
  { instrument: 'Chitarra', quantity: 1 },
  { instrument: 'Basso', quantity: 1 },
  { instrument: 'Batteria', quantity: 1 },
]

export function ProposeSongPage() {
  const { jamId = '' } = useParams()
  const navigate = useNavigate()
  const { actions } = useData()
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [listeningUrl, setListeningUrl] = useState('')
  const [roles, setRoles] = useState<RoleInput[]>(defaultRoles)
  const [newRole, setNewRole] = useState('Tastiere')
  const reduceMotion = useReducedMotion()
  const { t } = useI18n()

  const updateQuantity = (instrument: string, delta: number) => setRoles((current) => current.map((role) => role.instrument === instrument ? { ...role, quantity: Math.max(1, role.quantity + delta) } : role))
  const addRole = () => {
    const instrument = newRole.trim()
    if (!instrument) return
    setRoles((current) => current.some((role) => role.instrument.toLowerCase() === instrument.toLowerCase()) ? current : [...current, { instrument, quantity: 1 }])
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !artist.trim() || !roles.length) return
    const songId = actions.addSong({ jamId, title: title.trim(), artist: artist.trim(), listeningUrl: listeningUrl.trim() || undefined, roles })
    navigate(`/jam/${jamId}/song/${songId}`)
  }

  return (
    <main className="page form-page song-form-page app-screen">
      <header className="flow-header"><BackControl to={jamRoutes(jamId).songs} label={t('navigation.backToSongs')} /><h1>{t('songForm.proposeTitle')}</h1></header>
      <form onSubmit={submit}>
        <section className="form-section"><h2>{t('songForm.song')}</h2>
          <label className="field"><span>{t('songForm.title')}</span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Reptilia" /></label>
          <label className="field"><span>{t('songForm.artist')}</span><input required value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="The Strokes" /></label>
          <label className="field"><span>{t('songForm.listeningLink')} <em>{t('common.optional')}</em></span><input type="url" value={listeningUrl} onChange={(event) => setListeningUrl(event.target.value)} placeholder="https://…" /></label>
        </section>

        <section className="form-section"><h2>{t('songForm.formation')}</h2><fieldset className="roles-fieldset"><legend className="sr-only">{t('songForm.requiredFormation')}</legend>
          <motion.div className="role-editor" layout>
            <AnimatePresence initial={false}>{roles.map((role) => <motion.div className="role-row" key={role.instrument} layout initial={reduceMotion ? false : { x: 12, scale: 0.98 }} animate={{ x: 0, scale: 1 }} exit={reduceMotion ? undefined : { x: -16, scale: 0.97 }} transition={{ type: 'spring', stiffness: 440, damping: 35 }}>
              <strong>{displayInstrument(role.instrument, t)}</strong>
              <div className="quantity-control"><motion.button whileTap={reduceMotion ? undefined : { scale: 0.86 }} type="button" onClick={() => updateQuantity(role.instrument, -1)} disabled={role.quantity === 1} aria-label={t('songForm.decreaseAria', { instrument: displayInstrument(role.instrument, t) })}><Minus size={17} /></motion.button><motion.span key={role.quantity} initial={reduceMotion ? false : { scale: 0.72 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 28 }}>{role.quantity}</motion.span><motion.button whileTap={reduceMotion ? undefined : { scale: 0.86 }} type="button" onClick={() => updateQuantity(role.instrument, 1)} aria-label={t('songForm.increaseAria', { instrument: displayInstrument(role.instrument, t) })}><Plus size={17} /></motion.button></div>
              <motion.button whileTap={reduceMotion ? undefined : { scale: 0.86 }} className="trash-button" type="button" onClick={() => setRoles((current) => current.filter((item) => item.instrument !== role.instrument))} aria-label={t('songForm.removeRoleAria', { instrument: displayInstrument(role.instrument, t) })}><Trash2 size={18} /></motion.button>
            </motion.div>)}</AnimatePresence>
          </motion.div>
          <div className="add-role-row">
            <label><span className="sr-only">{t('songForm.otherInstrument')}</span><input list="instruments" value={newRole} onChange={(event) => setNewRole(event.target.value)} /></label>
            <datalist id="instruments">{INSTRUMENTS.map((instrument) => <option key={instrument} value={instrument}>{displayInstrument(instrument, t)}</option>)}</datalist>
            <button type="button" className="secondary-button" onClick={addRole}><Plus size={18} /> {t('songForm.addRole')}</button>
          </div>
        </fieldset></section>
        <button className="primary-button full-button" type="submit" disabled={!roles.length}>{t('songForm.publish')}</button>
      </form>
    </main>
  )
}
