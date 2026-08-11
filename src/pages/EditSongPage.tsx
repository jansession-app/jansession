import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BackControl } from '../components/BackControl'
import { useData } from '../data/DataContext'
import { useI18n } from '../i18n/LanguageContext'

export function EditSongPage() {
  const { jamId = '', songId = '' } = useParams()
  const { data, actions } = useData()
  const navigate = useNavigate()
  const song = data.songs.find((item) => item.id === songId && item.jamId === jamId)
  const [title, setTitle] = useState(song?.title ?? '')
  const [artist, setArtist] = useState(song?.artist ?? '')
  const [listeningUrl, setListeningUrl] = useState(song?.listeningUrl ?? '')
  const { t } = useI18n()
  if (!song) return null
  const submit = (event: FormEvent) => {
    event.preventDefault()
    actions.updateSong(songId, { title: title.trim(), artist: artist.trim(), listeningUrl: listeningUrl.trim() || undefined })
    navigate(`/jam/${jamId}/song/${songId}`)
  }
  return <main className="page form-page song-form-page app-screen">
    <header className="flow-header"><BackControl to={`/jam/${jamId}/song/${songId}`} label={t('navigation.backToSong')} /><h1>{t('songForm.editTitle')}</h1></header>
    <form onSubmit={submit}><section className="form-section"><h2>{t('songForm.song')}</h2>
      <label className="field"><span>{t('songForm.title')}</span><input required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label className="field"><span>{t('songForm.artist')}</span><input required value={artist} onChange={(event) => setArtist(event.target.value)} /></label>
      <label className="field"><span>{t('songForm.listeningLink')}</span><input type="url" value={listeningUrl} onChange={(event) => setListeningUrl(event.target.value)} /></label>
    </section><button className="primary-button full-button">{t('songForm.save')}</button></form>
  </main>
}
