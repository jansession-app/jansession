import { Check, Copy, Crown, LogOut, MapPin, MoreHorizontal, Settings2, Share2, ShieldCheck, Trash2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { useData } from '../data/DataContext'
import { JamOverviewLink } from '../components/JamOverviewLink'
import { isManager } from '../data/selectors'
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
  const [memberSheet, setMemberSheet] = useState<{ userId: string; confirmRemove: boolean } | null>(null)
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const jam = data.jams.find((item) => item.id === jamId)
  if (!jam) return null
  const members = data.members.filter((member) => member.jamId === jamId)
  const manager = isManager(data, jamId)
  const creator = jam.creatorId === data.currentUserId
  const canLeave = canLeaveJam(data, jamId)
  const inviteUrl = buildInviteUrl(window.location.origin, window.location.pathname, jam.inviteCode)
  const selectedMember = memberSheet ? members.find((member) => member.userId === memberSheet.userId) : null
  const selectedProfile = selectedMember ? data.profiles.find((profile) => profile.id === selectedMember.userId) : null
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
    if (updated) setMemberSheet(null)
    else setMembershipError('Non è stato possibile modificare il ruolo. Riprova.')
  }
  const removeMember = async (userId: string) => {
    setActingMemberId(userId)
    setMembershipError('')
    const removed = await actions.removeMember(jamId, userId)
    setActingMemberId('')
    if (removed) setMemberSheet(null)
    else setMembershipError('Non è stato possibile rimuovere il partecipante. Riprova.')
  }
  const leaveJam = async () => {
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
      <motion.header className="tab-header jam-section-header" layoutId={`jam-section-${jamId}-musicians`} transition={{ type: 'spring', stiffness: 370, damping: 34 }}>
        <JamOverviewLink jamId={jamId} jamName={jam.name} />
        <div className="section-title-row"><h1>Musicisti</h1><span>{members.length}</span></div>
      </motion.header>

      {jam.visibility === 'link' && <motion.section className="invite-card" layout>
        <span className="invite-icon"><Share2 size={22} /></span>
        <div><h2>Invita alla jam</h2><p>Condividi il link di accesso.</p></div>
        <button className="secondary-button" onClick={copyInvite}>{copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Copiato' : 'Copia link'}</button>
        {inviteError && <p className="form-error invite-error" role="alert">{inviteError}</p>}
      </motion.section>}

      {manager && <section className="management-card"><div><Settings2 size={20} /><span><strong>Gestione jam</strong><small>Proposte {jam.proposalsOpen ? 'aperte' : 'chiuse'} · assegnazioni {jam.assignmentsOpen ? 'aperte' : 'chiuse'}</small></span></div><Link className="secondary-button" to={`/jam/${jamId}/settings`}>Modifica</Link></section>}

      <motion.div className="musician-list" layout>
        <AnimatePresence initial={false}>{members.map((member) => {
          const profile = data.profiles.find((item) => item.id === member.userId)
          if (!profile) return null
          return (
            <motion.article className="musician-card" key={member.userId} layout initial={reduceMotion ? false : { x: 14, scale: 0.99 }} animate={{ x: 0, scale: 1 }} exit={reduceMotion ? undefined : { x: -18, scale: 0.98 }} transition={{ type: 'spring', stiffness: 420, damping: 35 }}>
              <span className="avatar" aria-hidden="true">{profile.displayName.slice(0, 2).toUpperCase()}</span>
              <div className="musician-copy"><h3>{profile.displayName}{profile.id === data.currentUserId && <em>Tu</em>}</h3><p>{profile.instruments.join(' · ')}</p>{member.role !== 'musician' && <span className="role-badge">{member.role === 'organizer' ? <Crown size={13} /> : <ShieldCheck size={13} />}{member.role === 'organizer' ? 'Organizzatore' : 'Co-organizzatore'}</span>}</div>
              {creator && canRemoveJamMember(data, jamId, data.currentUserId, member.userId) && <motion.button className="member-menu-trigger" type="button" whileTap={reduceMotion ? undefined : { scale: 0.88 }} disabled={actingMemberId === member.userId} onClick={() => setMemberSheet({ userId: member.userId, confirmRemove: false })} aria-label={`Azioni per ${profile.displayName}`}><MoreHorizontal size={20} /></motion.button>}
            </motion.article>
          )
        })}</AnimatePresence>
      </motion.div>

      {membershipError && <p className="form-error membership-error" role="alert">{membershipError}</p>}

      <section className="location-card"><MapPin size={21} /><div><strong>Dove ci troviamo</strong><span>{jam.location || 'Luogo da definire'}</span></div></section>
      {canLeave && <section className="leave-jam-section"><strong>Partecipazione</strong><button type="button" disabled={actingMemberId === data.currentUserId} onClick={() => setLeaveSheetOpen(true)}><LogOut size={15} /> {actingMemberId === data.currentUserId ? 'Uscita…' : 'Abbandona jam'}</button></section>}
      <div className="bottom-spacer" />

      <BottomSheet
        open={Boolean(memberSheet && selectedMember && selectedProfile)}
        title={memberSheet?.confirmRemove ? `Rimuovere ${selectedProfile?.displayName ?? 'partecipante'}?` : selectedProfile?.displayName ?? 'Partecipante'}
        onClose={() => setMemberSheet(null)}
        footer={memberSheet?.confirmRemove ? <div className="sheet-actions"><button type="button" className="sheet-cancel-action" onClick={() => memberSheet && setMemberSheet({ ...memberSheet, confirmRemove: false })}>Indietro</button><button type="button" className="sheet-confirm-action danger" disabled={actingMemberId === selectedMember?.userId} onClick={() => selectedMember && void removeMember(selectedMember.userId)}>Rimuovi</button></div> : undefined}
      >
        {selectedMember && selectedProfile && (memberSheet?.confirmRemove
          ? <p className="sheet-description">Assegnazioni e preparazione per questa jam verranno rimosse.</p>
          : <div className="member-sheet-actions"><div className="member-sheet-summary"><span className="avatar" aria-hidden="true">{selectedProfile.displayName.slice(0, 2).toUpperCase()}</span><span><strong>{selectedProfile.instruments.join(' · ')}</strong><small>{selectedMember.role === 'co-organizer' ? 'Co-organizzatore' : 'Musicista'}</small></span></div><button type="button" onClick={() => { void changeRole(selectedMember.userId, selectedMember.role === 'musician' ? 'co-organizer' : 'musician') }}>{selectedMember.role === 'musician' ? <ShieldCheck size={18} /> : <Crown size={18} />}{selectedMember.role === 'musician' ? 'Promuovi a co-organizzatore' : 'Rendi musicista'}</button><button type="button" className="danger" onClick={() => setMemberSheet({ userId: selectedMember.userId, confirmRemove: true })}><Trash2 size={18} /> Rimuovi dalla jam</button></div>)}
      </BottomSheet>

      <ConfirmSheet open={leaveSheetOpen} title="Abbandonare la jam?" description="I tuoi ruoli e stati di preparazione in questa jam verranno rimossi." confirmLabel="Abbandona" danger pending={actingMemberId === data.currentUserId} onClose={() => setLeaveSheetOpen(false)} onConfirm={() => { void leaveJam() }} />
    </main>
  )
}
