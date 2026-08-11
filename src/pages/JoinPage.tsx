import { ArrowRight, CalendarDays, Link2, MapPin } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { formatCompactJamDate } from '../data/selectors'
import { PRODUCT_NAME } from '../domain/types'
import { supabase } from '../lib/supabase'
import { remoteMutations } from '../data/supabaseRepository'
import { joinedJamRoute } from '../navigation'
import { useI18n } from '../i18n/LanguageContext'

interface InvitePreview { id: string; name: string; startsAt: string; location?: string }

export function JoinPage() {
  const { inviteCode = '' } = useParams()
  const navigate = useNavigate()
  const { data, actions, mode } = useData()
  const reduceMotion = useReducedMotion()
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(mode === 'supabase')
  const { language, t } = useI18n()
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

  if (previewLoading) return <div className="auth-loading"><span>{t('join.checking')}</span></div>
  if (!displayJam) return (
    <main className="join-page">
      <div className="join-brand"><strong>{PRODUCT_NAME}</strong></div>
      <section className="join-panel"><span className="join-code">{t('join.invalid')}</span><h1>{t('join.unavailable')}</h1><p>{t('join.checkLink')}</p><button className="primary-button" onClick={() => navigate('/jams')}>{t('join.goToJams')}</button></section>
    </main>
  )

  const accept = async () => {
    if (jam) {
      const id = actions.acceptInvite(inviteCode)
      if (id) navigate(joinedJamRoute(id))
      return
    }
    const id = await remoteMutations.acceptInvite(inviteCode)
    navigate(joinedJamRoute(id))
  }
  return (
    <main className="join-page">
      <div className="join-brand"><strong>{PRODUCT_NAME}</strong></div>
      <motion.section className="join-panel" initial={reduceMotion ? false : { y: 24, scale: 0.985 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 390, damping: 34 }}>
        <span className="join-code"><Link2 size={15} /> {t('join.invitation')}</span>
        <h1>{displayJam.name}</h1>
        <div className="join-details"><span><CalendarDays size={18} /> {formatCompactJamDate(displayJam.startsAt, language)}</span>{displayJam.location && <span><MapPin size={18} /> {displayJam.location}</span>}</div>
        <motion.button whileTap={reduceMotion ? undefined : { scale: 0.97 }} className="primary-button full-button" onClick={accept}>{t(alreadyMember ? 'join.openJam' : 'join.joinJam')} <ArrowRight size={19} /></motion.button>
      </motion.section>
    </main>
  )
}
