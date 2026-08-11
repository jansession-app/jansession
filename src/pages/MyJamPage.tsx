import { CheckCircle2, Headphones, Music2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { useData } from '../data/DataContext'
import { PREPARATION_LABEL_KEYS } from '../domain/labels'
import type { PreparationState } from '../domain/types'
import { JamOverviewLink } from '../components/JamOverviewLink'
import { useI18n } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import { displayInstrument } from '../domain/songStatus'

const GROUPS: { state: PreparationState; labelKey: TranslationKey }[] = [
  { state: 'UNKNOWN', labelKey: 'myJam.group.unknown' },
  { state: 'NEEDS_LISTENING', labelKey: 'myJam.group.needsListening' },
  { state: 'KNOWS_STRUCTURE', labelKey: 'myJam.group.knowsStructure' },
  { state: 'READY', labelKey: 'myJam.group.ready' },
]

export function MyJamPage() {
  const { jamId = '' } = useParams()
  const { data } = useData()
  const jam = data.jams.find((item) => item.id === jamId)
  const reduceMotion = useReducedMotion()
  const { t } = useI18n()
  const myAssignments = data.assignments.filter((item) => item.userId === data.currentUserId).flatMap((assignment) => {
    const slot = data.slots.find((item) => item.id === assignment.slotId)
    const song = slot && data.songs.find((item) => item.id === slot.songId && item.jamId === jamId)
    if (!slot || !song) return []
    const state = data.preparations.find((item) => item.songId === song.id && item.userId === data.currentUserId)?.state ?? 'UNKNOWN'
    return [{ song, slot, state }]
  })
  const listeningCount = myAssignments.filter((item) => item.state === 'UNKNOWN' || item.state === 'NEEDS_LISTENING').length

  return (
    <main className="page tab-page app-screen">
      <header className="tab-header my-header">
        {jam && <JamOverviewLink jamId={jamId} jamName={jam.name} />}
        <div className="section-title-row"><h1>{t('myJam.title')}</h1><span>{listeningCount}</span></div>
      </header>
      {myAssignments.length ? <AnimatePresence initial={false}>{GROUPS.map((group) => {
        const items = myAssignments.filter((item) => item.state === group.state)
        if (!items.length) return null
        return (
          <motion.section className="my-group" key={group.state} layout transition={{ type: 'spring', stiffness: 410, damping: 36 }}>
            <div className="my-group-heading">{group.state === 'NEEDS_LISTENING' || group.state === 'UNKNOWN' ? <Headphones size={17} /> : group.state === 'READY' ? <CheckCircle2 size={17} /> : <Music2 size={17} />}<h2>{t(group.labelKey)}</h2><span>{items.length}</span></div>
            {items.map(({ song, slot, state }) => <motion.div key={`${song.id}-${slot.id}`} layout initial={reduceMotion ? false : { x: 12 }} animate={{ x: 0 }} exit={reduceMotion ? undefined : { x: -14 }}><Link className="my-song" to={`/jam/${jamId}/song/${song.id}`}><span><strong>{song.title}</strong><small>{song.artist}</small></span><span className="instrument-tag">{displayInstrument(slot.instrument, t)}</span><em>{t(PREPARATION_LABEL_KEYS[state])}</em></Link></motion.div>)}
          </motion.section>
        )
      })}</AnimatePresence> : <EmptyState icon={Music2} title={t('myJam.emptyTitle')} body={t('myJam.emptyBody')} />}
      <div className="bottom-spacer" />
    </main>
  )
}
