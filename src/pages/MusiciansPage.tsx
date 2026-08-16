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
import { useI18n } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import { displayInstrument } from '../domain/songStatus'
import { JAM_ROLE_LABEL_KEYS } from '../domain/labels'
import { JoinRequestsSection } from '../discover/JoinRequestsSection'

export function MusiciansPage() {
  const { jamId = '' } = useParams()
  const { data, actions, mode } = useData()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [inviteError, setInviteError] = useState<TranslationKey | null>(null)
  const [membershipError, setMembershipError] = useState<TranslationKey | null>(null)
  const [actingMemberId, setActingMemberId] = useState('')
  const [memberSheet, setMemberSheet] = useState<{ userId: string; confirmRemove: boolean } | null>(null)
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const { t } = useI18n()
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
      setInviteError('musicians.inviteUnavailable')
      return
    }
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setInviteError(null)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setInviteError('musicians.copyError')
    }
  }
  const changeRole = async (userId: string, role: 'musician' | 'co-organizer') => {
    setActingMemberId(userId)
    setMembershipError(null)
    const updated = await actions.updateMemberRole(jamId, userId, role)
    setActingMemberId('')
    if (updated) setMemberSheet(null)
    else setMembershipError('musicians.roleError')
  }
  const removeMember = async (userId: string) => {
    setActingMemberId(userId)
    setMembershipError(null)
    const removed = await actions.removeMember(jamId, userId)
    setActingMemberId('')
    if (removed) setMemberSheet(null)
    else setMembershipError('musicians.removeError')
  }
  const leaveJam = async () => {
    setActingMemberId(data.currentUserId)
    setMembershipError(null)
    const left = await actions.leaveJam(jamId)
    setActingMemberId('')
    if (left) {
      navigate('/jams', { replace: true })
      return
    }
    setMembershipError('musicians.leaveError')
  }

  return (
    <main className="page tab-page app-screen">
      <motion.header className="tab-header jam-section-header" layoutId={`jam-section-${jamId}-musicians`} transition={{ type: 'spring', stiffness: 370, damping: 34 }}>
        <JamOverviewLink jamId={jamId} jamName={jam.name} />
        <div className="section-title-row"><h1>{t('musicians.title')}</h1><span>{members.length}</span></div>
      </motion.header>

      {jam.visibility === 'link' && <motion.section className="invite-card" layout>
        <span className="invite-icon"><Share2 size={22} /></span>
        <div><h2>{t('musicians.invite')}</h2><p>{t('musicians.inviteHelp')}</p></div>
        <button className="secondary-button" onClick={copyInvite}>{copied ? <Check size={18} /> : <Copy size={18} />} {t(copied ? 'musicians.copied' : 'musicians.copyLink')}</button>
        {inviteError && <p className="form-error invite-error" role="alert">{t(inviteError)}</p>}
      </motion.section>}

      {manager && <section className="management-card"><div><Settings2 size={20} /><span><strong>{t('musicians.management')}</strong><small>{t('musicians.managementSummary', { proposals: t(jam.proposalsOpen ? 'musicians.open' : 'musicians.closed'), assignments: t(jam.assignmentsOpen ? 'musicians.open' : 'musicians.closed') })}</small></span></div><Link className="secondary-button" to={`/jam/${jamId}/settings`}>{t('common.edit')}</Link></section>}

      {manager && mode === 'supabase' && <JoinRequestsSection jamId={jamId} />}

      <motion.div className="musician-list" layout>
        <AnimatePresence initial={false}>{members.map((member) => {
          const profile = data.profiles.find((item) => item.id === member.userId)
          if (!profile) return null
          return (
            <motion.article className="musician-card" key={member.userId} layout initial={reduceMotion ? false : { x: 14, scale: 0.99 }} animate={{ x: 0, scale: 1 }} exit={reduceMotion ? undefined : { x: -18, scale: 0.98 }} transition={{ type: 'spring', stiffness: 420, damping: 35 }}>
              <span className="avatar" aria-hidden="true">{profile.displayName.slice(0, 2).toUpperCase()}</span>
              <div className="musician-copy"><h3>{profile.displayName}{profile.id === data.currentUserId && <em>{t('musicians.you')}</em>}</h3><p>{profile.instruments.map((instrument) => displayInstrument(instrument, t)).join(' · ')}</p>{member.role !== 'musician' && <span className="role-badge">{member.role === 'organizer' ? <Crown size={13} /> : <ShieldCheck size={13} />}{t(JAM_ROLE_LABEL_KEYS[member.role])}</span>}</div>
              {creator && canRemoveJamMember(data, jamId, data.currentUserId, member.userId) && <motion.button className="member-menu-trigger" type="button" whileTap={reduceMotion ? undefined : { scale: 0.88 }} disabled={actingMemberId === member.userId} onClick={() => setMemberSheet({ userId: member.userId, confirmRemove: false })} aria-label={t('musicians.actionsAria', { name: profile.displayName })}><MoreHorizontal size={20} /></motion.button>}
            </motion.article>
          )
        })}</AnimatePresence>
      </motion.div>

      {membershipError && <p className="form-error membership-error" role="alert">{t(membershipError)}</p>}

      <section className="location-card"><MapPin size={21} /><div><strong>{t('musicians.where')}</strong><span>{jam.location || t('musicians.locationUnknown')}</span></div></section>
      {canLeave && <section className="leave-jam-section"><strong>{t('musicians.participation')}</strong><button type="button" disabled={actingMemberId === data.currentUserId} onClick={() => setLeaveSheetOpen(true)}><LogOut size={15} /> {t(actingMemberId === data.currentUserId ? 'musicians.leaving' : 'musicians.leaveJam')}</button></section>}
      <div className="bottom-spacer" />

      <BottomSheet
        open={Boolean(memberSheet && selectedMember && selectedProfile)}
        title={memberSheet?.confirmRemove ? t('musicians.removeTitle', { name: selectedProfile?.displayName ?? t('musicians.memberFallback') }) : selectedProfile?.displayName ?? t('musicians.memberTitleFallback')}
        onClose={() => setMemberSheet(null)}
        footer={memberSheet?.confirmRemove ? <div className="sheet-actions"><button type="button" className="sheet-cancel-action" onClick={() => memberSheet && setMemberSheet({ ...memberSheet, confirmRemove: false })}>{t('common.back')}</button><button type="button" className="sheet-confirm-action danger" disabled={actingMemberId === selectedMember?.userId} onClick={() => selectedMember && void removeMember(selectedMember.userId)}>{t('common.remove')}</button></div> : undefined}
      >
        {selectedMember && selectedProfile && (memberSheet?.confirmRemove
          ? <p className="sheet-description">{t('musicians.removeDescription')}</p>
          : <div className="member-sheet-actions"><div className="member-sheet-summary"><span className="avatar" aria-hidden="true">{selectedProfile.displayName.slice(0, 2).toUpperCase()}</span><span><strong>{selectedProfile.instruments.map((instrument) => displayInstrument(instrument, t)).join(' · ')}</strong><small>{t(JAM_ROLE_LABEL_KEYS[selectedMember.role])}</small></span></div><button type="button" onClick={() => { void changeRole(selectedMember.userId, selectedMember.role === 'musician' ? 'co-organizer' : 'musician') }}>{selectedMember.role === 'musician' ? <ShieldCheck size={18} /> : <Crown size={18} />}{t(selectedMember.role === 'musician' ? 'musicians.promote' : 'musicians.demote')}</button><button type="button" className="danger" onClick={() => setMemberSheet({ userId: selectedMember.userId, confirmRemove: true })}><Trash2 size={18} /> {t('musicians.removeFromJam')}</button></div>)}
      </BottomSheet>

      <ConfirmSheet open={leaveSheetOpen} title={t('musicians.leaveTitle')} description={t('musicians.leaveDescription')} confirmLabel={t('musicians.leaveConfirm')} danger pending={actingMemberId === data.currentUserId} onClose={() => setLeaveSheetOpen(false)} onConfirm={() => { void leaveJam() }} />
    </main>
  )
}
