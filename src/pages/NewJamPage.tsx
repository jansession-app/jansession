import { Lock, Link2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackControl } from '../components/BackControl'
import { useData } from '../data/DataContext'
import { jamRoutes } from '../navigation'

export function NewJamPage() {
  const { actions } = useData()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [startsAt, setStartsAt] = useState('2026-08-22T20:30')
  const [location, setLocation] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'link'>('link')
  const reduceMotion = useReducedMotion()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const id = actions.addJam({ name: name.trim(), startsAt: new Date(startsAt).toISOString(), location: location.trim() || undefined, visibility })
    navigate(jamRoutes(id).overview)
  }
  return (
      <main className="page form-page new-jam-page app-screen">
        <header className="flow-header"><BackControl to="/jams" label="Torna alle jam" /><h1>Nuova jam</h1></header>
        <form onSubmit={submit}>
          <section className="form-section"><h2>Dettagli</h2>
            <label className="field"><span>Nome</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Jam Session Poggiardo" /></label>
            <label className="field"><span>Data e ora</span><input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
            <label className="field"><span>Luogo <em>opzionale</em></span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Sala prove, città…" /></label>
          </section>
          <section className="form-section"><h2>Accesso</h2><fieldset className="visibility-field"><legend className="sr-only">Accesso</legend>
            <motion.button whileTap={reduceMotion ? undefined : { scale: 0.97 }} type="button" className={visibility === 'private' ? 'active' : ''} onClick={() => setVisibility('private')}><Lock size={19} /><span><strong>Privata</strong><small>Solo membri aggiunti</small></span></motion.button>
            <motion.button whileTap={reduceMotion ? undefined : { scale: 0.97 }} type="button" className={visibility === 'link' ? 'active' : ''} onClick={() => setVisibility('link')}><Link2 size={19} /><span><strong>Con link</strong><small>Accesso dall’invito</small></span></motion.button>
          </fieldset></section>
          <button className="primary-button full-button" type="submit">Crea la jam</button>
        </form>
      </main>
  )
}
