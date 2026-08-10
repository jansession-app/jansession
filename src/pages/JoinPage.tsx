import { ArrowRight, CalendarDays, CheckCircle2, Link2, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { formatJamDate } from '../data/selectors'
import { PRODUCT_NAME } from '../domain/types'
import { supabase } from '../lib/supabase'
import { remoteMutations } from '../data/supabaseRepository'

interface InvitePreview { id: string; name: string; startsAt: string; location?: string }

export function JoinPage() {
  const { inviteCode = '' } = useParams()
  const navigate = useNavigate()
  const { data, actions, mode } = useData()
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(mode === 'supabase')
  const jam = data.jams.find((item) => item.inviteCode.toLowerCase() === inviteCode.toLowerCase())
  const alreadyMember = jam && data.members.some((item) => item.jamId === jam.id && item.userId === data.currentUserId)

  useEffect(() => {
    if (jam || !supabase || mode !== 'supabase') { setPreviewLoading(false); return }
    void supabase.rpc('get_jam_invite_preview', { invite_token: inviteCode }).then(({ data: rows }) => {
      const row = (rows as { id: string; name: string; starts_at: string; location: string | null }[] | null)?.[0]
      if (row) setPreview({ id: row.id, name: row.name, startsAt: row.starts_at, location: row.location ?? undefined })
      setPreviewLoading(false)
    })
  }, [inviteCode, jam, mode])

  const displayJam = jam ?? preview

  if (previewLoading) return <div className="auth-loading"><span>Controlliamo l’invito…</span></div>
  if (!displayJam) return (
    <main className="join-page">
      <div className="join-brand"><strong>{PRODUCT_NAME}</strong></div>
      <section className="join-card"><span className="join-code">Invito non valido</span><h1>Questa jam non è disponibile.</h1><p>Controlla che il link ricevuto sia completo.</p><button className="primary-button" onClick={() => navigate('/home')}>Vai alla home</button></section>
    </main>
  )

  const accept = async () => {
    if (jam) {
      const id = actions.acceptInvite(inviteCode)
      if (id) navigate(`/jam/${id}/songs`)
      return
    }
    const id = await remoteMutations.acceptInvite(inviteCode)
    navigate(`/jam/${id}/songs`)
  }
  return (
    <main className="join-page">
      <div className="join-brand"><strong>{PRODUCT_NAME}</strong></div>
      <section className="join-card">
        <span className="join-code"><Link2 size={15} /> Invito alla jam</span>
        <h1>{displayJam.name}</h1>
        <div className="join-details"><span><CalendarDays size={18} /> {formatJamDate(displayJam.startsAt, true)}</span>{displayJam.location && <span><MapPin size={18} /> {displayJam.location}</span>}</div>
        <div className="join-promise"><CheckCircle2 size={20} /><p>Entrando potrai proporre brani, scegliere i tuoi ruoli e indicare quanto conosci ogni pezzo.</p></div>
        <button className="primary-button full-button" onClick={accept}>{alreadyMember ? 'Apri la jam' : 'Partecipa alla jam'} <ArrowRight size={19} /></button>
        {mode === 'demo' && <small>Sei in modalità demo: l’invito viene accettato senza autenticazione.</small>}
      </section>
    </main>
  )
}
