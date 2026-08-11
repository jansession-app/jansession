import { Check, Copy, Crown, MapPin, Settings2, Share2, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { formatJamDate, isManager } from '../data/selectors'
import { buildInviteUrl } from '../invites/inviteFlow'

export function MusiciansPage() {
  const { jamId = '' } = useParams()
  const { data, actions } = useData()
  const [copied, setCopied] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const jam = data.jams.find((item) => item.id === jamId)
  if (!jam) return null
  const members = data.members.filter((member) => member.jamId === jamId)
  const manager = isManager(data, jamId)
  const organizer = members.find((member) => member.userId === data.currentUserId)?.role === 'organizer'
  const inviteUrl = buildInviteUrl(window.location.origin, window.location.pathname, jam.inviteCode)
  const copyInvite = async () => {
    if (!inviteUrl) {
      setInviteError('Link di invito non disponibile. Riprova tra poco.')
      return
    }
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setInviteError('')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setInviteError('Non è stato possibile copiare il link. Riprova.')
    }
  }

  return (
    <main className="page tab-page app-screen">
      <header className="tab-header">
        <div className="jam-context"><strong>{jam.name}</strong><span>{formatJamDate(jam.startsAt, true)}</span></div>
        <h1>Musicisti</h1>
        <p>{members.length} partecipanti · strumenti disponibili nella jam.</p>
      </header>

      {jam.visibility === 'link' && <section className="invite-card">
        <span className="invite-icon"><Share2 size={22} /></span>
        <div><h2>Invita alla jam</h2><p>Condividi il link su WhatsApp. Chi lo apre potrà entrare in autonomia.</p></div>
        <button className="secondary-button" onClick={copyInvite}>{copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Copiato' : 'Copia link'}</button>
        {inviteError && <p className="form-error invite-error" role="alert">{inviteError}</p>}
      </section>}

      {manager && <section className="management-card"><div><Settings2 size={20} /><span><strong>Gestione jam</strong><small>Proposte {jam.proposalsOpen ? 'aperte' : 'chiuse'} · assegnazioni {jam.assignmentsOpen ? 'aperte' : 'chiuse'}</small></span></div><Link className="secondary-button" to={`/jam/${jamId}/settings`}>Modifica</Link></section>}

      <div className="musician-list">
        {members.map((member) => {
          const profile = data.profiles.find((item) => item.id === member.userId)
          if (!profile) return null
          return (
            <article className="musician-card" key={member.userId}>
              <span className="avatar" aria-hidden="true">{profile.displayName.slice(0, 2).toUpperCase()}</span>
              <div><h3>{profile.displayName}{profile.id === data.currentUserId && <em>Tu</em>}</h3><p>{profile.instruments.join(' · ')}</p></div>
              {member.role !== 'musician' && <span className="role-badge">{member.role === 'organizer' ? <Crown size={14} /> : <ShieldCheck size={14} />}{member.role === 'organizer' ? 'Organizzatore' : 'Co-organizzatore'}</span>}
              {member.role !== 'organizer' && (organizer || (manager && member.role === 'musician')) && <div className="member-controls">
                {organizer && <select aria-label={`Ruolo di ${profile.displayName}`} value={member.role} onChange={(event) => actions.updateMemberRole(jamId, member.userId, event.target.value as 'musician' | 'co-organizer')}><option value="musician">Musicista</option><option value="co-organizer">Co-organizzatore</option></select>}
                <button aria-label={`Rimuovi ${profile.displayName}`} onClick={() => { if (window.confirm(`Rimuovere ${profile.displayName} dalla jam?`)) actions.removeMember(jamId, member.userId) }}><Trash2 size={16} /></button>
              </div>}
            </article>
          )
        })}
      </div>

      <section className="location-card"><MapPin size={21} /><div><strong>Dove ci troviamo</strong><span>{jam.location || 'Luogo da definire'}</span></div></section>
      <div className="bottom-spacer" />
    </main>
  )
}
