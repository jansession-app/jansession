import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { canDeleteJam } from '../data/jamDeletion'

export const DELETE_JAM_CONFIRMATION = 'Eliminare definitivamente questa jam?\n\nVerranno eliminati anche brani, scaletta, assegnazioni e dati collegati.'

export function JamSettingsPage() {
  const { jamId = '' } = useParams()
  const { data, actions } = useData()
  const navigate = useNavigate()
  const jam = data.jams.find((item) => item.id === jamId)
  const [name, setName] = useState(jam?.name ?? '')
  const [startsAt, setStartsAt] = useState(jam ? new Date(new Date(jam.startsAt).getTime() - new Date(jam.startsAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')
  const [location, setLocation] = useState(jam?.location ?? '')
  const [proposalsOpen, setProposalsOpen] = useState(jam?.proposalsOpen ?? true)
  const [assignmentsOpen, setAssignmentsOpen] = useState(jam?.assignmentsOpen ?? true)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  if (!jam) return null
  const owner = canDeleteJam(jam, data.currentUserId)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    actions.updateJam(jamId, { name: name.trim(), startsAt: new Date(startsAt).toISOString(), location: location.trim() || undefined, proposalsOpen, assignmentsOpen })
    navigate(`/jam/${jamId}/musicians`)
  }
  const removeJam = async () => {
    if (!window.confirm(DELETE_JAM_CONFIRMATION)) return
    setDeleting(true)
    setDeleteError('')
    const deleted = await actions.deleteJam(jamId)
    setDeleting(false)
    if (deleted) {
      navigate('/home', { replace: true })
      return
    }
    setDeleteError('Non è stato possibile eliminare la jam. Riprova.')
  }
  return <main className="page form-page app-screen"><header><p className="eyebrow">Organizzazione</p><h1>Gestisci la jam</h1><p>Modifica i dettagli e decidi quando i musicisti possono proporre o assegnarsi.</p></header><form onSubmit={submit}>
    <label className="field"><span>Nome</span><input required value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label className="field"><span>Data e ora</span><input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
    <label className="field"><span>Luogo</span><input value={location} onChange={(event) => setLocation(event.target.value)} /></label>
    <fieldset className="switch-list"><legend>Permessi della jam</legend><label><span><strong>Proposte brani</strong><small>I musicisti possono pubblicare e modificare proposte.</small></span><input type="checkbox" checked={proposalsOpen} onChange={(event) => setProposalsOpen(event.target.checked)} /></label><label><span><strong>Assegnazioni</strong><small>I musicisti possono occupare autonomamente i ruoli.</small></span><input type="checkbox" checked={assignmentsOpen} onChange={(event) => setAssignmentsOpen(event.target.checked)} /></label></fieldset>
    <button className="primary-button full-button">Salva modifiche</button>
  </form>
  {owner && <section className="jam-delete-section">
    <h2>Impostazioni jam</h2>
    <p>Eliminando la jam verranno rimossi anche brani, scaletta, assegnazioni e tutti i dati collegati.</p>
    <button className="delete-jam-action" type="button" disabled={deleting} onClick={() => { void removeJam() }}><Trash2 size={16} /> {deleting ? 'Eliminazione…' : 'Elimina jam'}</button>
    {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
  </section>}
  </main>
}
