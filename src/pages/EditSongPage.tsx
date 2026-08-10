import { ArrowLeft } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'

export function EditSongPage() {
  const { jamId = '', songId = '' } = useParams()
  const { data, actions } = useData()
  const navigate = useNavigate()
  const song = data.songs.find((item) => item.id === songId && item.jamId === jamId)
  const [title, setTitle] = useState(song?.title ?? '')
  const [artist, setArtist] = useState(song?.artist ?? '')
  const [listeningUrl, setListeningUrl] = useState(song?.listeningUrl ?? '')
  if (!song) return null
  const submit = (event: FormEvent) => {
    event.preventDefault()
    actions.updateSong(songId, { title: title.trim(), artist: artist.trim(), listeningUrl: listeningUrl.trim() || undefined })
    navigate(`/jam/${jamId}/song/${songId}`)
  }
  return <main className="page form-page app-screen"><div className="screen-bar"><Link className="back-link" to={`/jam/${jamId}/song/${songId}`}><ArrowLeft size={18} /> Annulla</Link></div><header><p className="eyebrow">Correggi proposta</p><h1>Modifica brano</h1><p>Aggiorna le informazioni. La formazione e la preparazione restano intatte.</p></header><form onSubmit={submit}><label className="field"><span>Titolo</span><input required value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="field"><span>Artista</span><input required value={artist} onChange={(event) => setArtist(event.target.value)} /></label><label className="field"><span>Link per ascoltarla</span><input type="url" value={listeningUrl} onChange={(event) => setListeningUrl(event.target.value)} /></label><button className="primary-button full-button">Salva proposta</button></form></main>
}
