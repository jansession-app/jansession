import { Lock, Link2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext'

export function NewJamPage() {
  const { actions } = useData()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [startsAt, setStartsAt] = useState('2026-08-22T20:30')
  const [location, setLocation] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'link'>('link')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const id = actions.addJam({ name: name.trim(), startsAt: new Date(startsAt).toISOString(), location: location.trim() || undefined, visibility })
    navigate(`/jam/${id}/songs`)
  }
  return (
      <main className="page form-page new-jam-page app-screen">
        <header><p className="eyebrow">Organizza</p><h1>Nuova jam</h1><p>Crea lo spazio di lavoro e condividi l’invito con i musicisti.</p></header>
        <form onSubmit={submit}>
          <label className="field"><span>Nome</span><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="es. Jam Session Poggiardo" /></label>
          <label className="field"><span>Data e ora</span><input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
          <label className="field"><span>Luogo <em>opzionale</em></span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Sala prove, città…" /></label>
          <fieldset className="visibility-field"><legend>Accesso</legend>
            <button type="button" className={visibility === 'private' ? 'active' : ''} onClick={() => setVisibility('private')}><Lock size={19} /><span><strong>Privata</strong><small>Solo membri aggiunti</small></span></button>
            <button type="button" className={visibility === 'link' ? 'active' : ''} onClick={() => setVisibility('link')}><Link2 size={19} /><span><strong>Con link</strong><small>Chi ha il link può entrare</small></span></button>
          </fieldset>
          <button className="primary-button full-button" type="submit">Crea la jam</button>
        </form>
      </main>
  )
}
