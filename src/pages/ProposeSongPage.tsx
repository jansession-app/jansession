import { Minus, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { INSTRUMENTS } from '../domain/types'

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
    <main className="page form-page app-screen">
      <header><p className="eyebrow">Nuova proposta</p><h1>Che cosa suoniamo?</h1><p>Indica il brano e la formazione esatta che serve.</p></header>
      <form onSubmit={submit}>
        <label className="field"><span>Titolo</span><input autoFocus required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="es. Reptilia" /></label>
        <label className="field"><span>Artista</span><input required value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="es. The Strokes" /></label>
        <label className="field"><span>Link per ascoltarla <em>opzionale</em></span><input type="url" value={listeningUrl} onChange={(event) => setListeningUrl(event.target.value)} placeholder="https://…" /></label>

        <fieldset className="roles-fieldset">
          <legend><span className="section-number">02</span><strong>Quali musicisti servono?</strong><small>Ogni quantità crea un posto distinto.</small></legend>
          <div className="role-editor">
            {roles.map((role) => <div className="role-row" key={role.instrument}>
              <strong>{role.instrument}</strong>
              <div className="quantity-control"><button type="button" onClick={() => updateQuantity(role.instrument, -1)} disabled={role.quantity === 1} aria-label={`Riduci ${role.instrument}`}><Minus size={17} /></button><span>{role.quantity}</span><button type="button" onClick={() => updateQuantity(role.instrument, 1)} aria-label={`Aumenta ${role.instrument}`}><Plus size={17} /></button></div>
              <button className="trash-button" type="button" onClick={() => setRoles((current) => current.filter((item) => item.instrument !== role.instrument))} aria-label={`Rimuovi ${role.instrument}`}><Trash2 size={18} /></button>
            </div>)}
          </div>
          <div className="add-role-row">
            <label><span className="sr-only">Altro strumento</span><input list="instruments" value={newRole} onChange={(event) => setNewRole(event.target.value)} /></label>
            <datalist id="instruments">{INSTRUMENTS.map((instrument) => <option key={instrument} value={instrument} />)}</datalist>
            <button type="button" className="secondary-button" onClick={addRole}><Plus size={18} /> Aggiungi ruolo</button>
          </div>
        </fieldset>
        <button className="primary-button full-button" type="submit" disabled={!roles.length}>Pubblica proposta</button>
      </form>
    </main>
  )
}
