import { Check, Copy, Crown, LogOut, MapPin, Settings2, Share2, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { JamOverviewLink } from '../components/JamOverviewLink'
import { formatJamDate, isManager } from '../data/selectors'
import { buildInviteUrl } from '../invites/inviteFlow'
import { canLeaveJam, canRemoveJamMember } from '../data/jamMembership'

export function MusiciansPage() {
  const { jamId = '' } = useParams()
  const { data, actions } = useData()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [membershipError, setMembershipError] = useState('')
  const [actingMemberId, setActingMemberId] = useState('')
  const jam = data.jams.find((item) => item.id === jamId)
  if (!jam) return null
  const members = data.members.filter((member) => member.jamId === jamId)
  const manager = isManager(data, jamId)
  const creator = jam.creatorId === data.currentUserId
  const canLeave = canLeaveJam(data, jamId)
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
  const changeRole = async (userId: string, role: 'musician' | 'co-organizer') => {
    setActingMemberId(userId)
    setMembershipError('')
    const updated = await actions.updateMemberRole(jamId, userId, role)
    setActingMemberId('')
    if (!updated) setMembershipError('Non è stato possibile modificare il ruolo. Riprova.')
  }
  const removeMember = async (userId: string, displayName: string) => {
    if (!window.confirm(`Rimuovere ${displayName} dalla jam?\n\nLe sue assegnazioni, disponibilità e stati di preparazione per questa jam verranno rimossi.`)) return
    setActingMemberId(userId)
    setMembershipError('')
    const removed = await actions.removeMember(jamId, userId)
    setActingMemberId('')
    if (!removed) setMembershipError('Non è stato possibile rimuovere il partecipante. Riprova.')
  }
  const leaveJam = async () => {
    if (!window.confirm('Abbandonare questa jam?\n\nLe tue assegnazioni, disponibilità e stati di preparazione per questa jam verranno rimossi.')) return
    setActingMemberId(data.currentUserId)
    setMembershipError('')
    const left = await actions.leaveJam(jamId)
    setActingMemberId('')
    if (left) {
      navigate('/jams', { replace: true })
      return
    }
    setMembershipError('Non è stato possibile abbandonare la jam. Riprova.')
  }

  return (
    <main className="page tab-page app-screen">
      <header className="tab-header">
        <JamOverviewLink jamId={jamId} jamName={jam.name} />
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
              {creator && canRemoveJamMember(data, jamId, data.currentUserId, member.userId) && <div className="member-controls">
                <button disabled={actingMemberId === member.userId} onClick={() => { void changeRole(member.userId, member.role === 'musician' ? 'co-organizer' : 'musician') }}>{member.role === 'musician' ? 'Promuovi a co-organizzatore' : 'Rendi musicista'}</button>
                <button className="remove-member-action" disabled={actingMemberId === member.userId} onClick={() => { void removeMember(member.userId, profile.displayName) }}><Trash2 size={14} /> Rimuovi dalla jam</button>
              </div>}
            </article>
          )
        })}
      </div>

      {membershipError && <p className="form-error membership-error" role="alert">{membershipError}</p>}

      <section className="location-card"><MapPin size={21} /><div><strong>Dove ci troviamo</strong><span>{jam.location || 'Luogo da definire'}</span></div></section>
      {canLeave && <section className="leave-jam-section"><div><strong>La tua partecipazione</strong><span>Uscendo verranno liberati i tuoi ruoli in questa jam.</span></div><button type="button" disabled={actingMemberId === data.currentUserId} onClick={() => { void leaveJam() }}><LogOut size={15} /> {actingMemberId === data.currentUserId ? 'Uscita…' : 'Abbandona jam'}</button></section>}
      <div className="bottom-spacer" />
    </main>
  )
}
