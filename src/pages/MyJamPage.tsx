import { CheckCircle2, Headphones, Music2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { useData } from '../data/DataContext'
import { JamOverviewLink } from '../components/JamOverviewLink'
import { useI18n } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import { displayInstrument } from '../domain/songStatus'
import { personalSongAssignments } from '../data/personalPreparation'
import { visiblePreparationLabelKey, visiblePreparationState, type VisiblePreparationState } from '../domain/statusPresentation'

const GROUPS: { state: VisiblePreparationState; labelKey: TranslationKey }[] = [
  { state: 'TO_PREPARE', labelKey: 'status.toPrepare' },
  { state: 'READY', labelKey: 'status.ready' },
]

export function MyJamPage() {
  const { jamId = '' } = useParams()
  const { data } = useData()
  const jam = data.jams.find((item) => item.id === jamId)
  const reduceMotion = useReducedMotion()
  const { t } = useI18n()
  const myAssignments = personalSongAssignments(data, jamId)
  const listeningCount = myAssignments.filter((item) => visiblePreparationState(item.state) === 'TO_PREPARE').length

  return (
    <main className="page tab-page app-screen">
      <header className="tab-header my-header">
        {jam && <JamOverviewLink jamId={jamId} jamName={jam.name} />}
        <div className="section-title-row"><h1>{t('myJam.title')}</h1><span>{listeningCount}</span></div>
      </header>
      {myAssignments.length ? <AnimatePresence initial={false}>{GROUPS.map((group) => {
        const items = myAssignments.filter((item) => visiblePreparationState(item.state) === group.state)
        if (!items.length) return null
        return (
          <motion.section className="my-group" key={group.state} layout transition={{ type: 'spring', stiffness: 410, damping: 36 }}>
            <div className="my-group-heading">{group.state === 'READY' ? <CheckCircle2 size={17} /> : <Headphones size={17} />}<h2>{t(group.labelKey)}</h2><span>{items.length}</span></div>
            {items.map(({ song, instruments, state }) => <motion.div key={song.id} layout initial={reduceMotion ? false : { x: 12 }} animate={{ x: 0 }} exit={reduceMotion ? undefined : { x: -14 }}><Link className="my-song" to={`/jam/${jamId}/song/${song.id}`}><span><strong>{song.title}</strong><small>{song.artist}</small></span><span className="instrument-tag">{instruments.map((instrument) => displayInstrument(instrument, t)).join(' · ')}</span><em>{t(visiblePreparationLabelKey(state))}</em></Link></motion.div>)}
          </motion.section>
        )
      })}</AnimatePresence> : <EmptyState icon={Music2} title={t('myJam.emptyTitle')} body={t('myJam.emptyBody')} />}
      <div className="bottom-spacer" />
    </main>
  )
}
