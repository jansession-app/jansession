import { ArrowDown, ArrowUp, ListMusic, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { JamOverviewLink } from '../components/JamOverviewLink'
import { StatusBadge } from '../components/StatusBadge'
import { useData } from '../data/DataContext'
import { isManager, jamSongs, songDetails } from '../data/selectors'
import { canAddToSetlist, statusSummary } from '../domain/songStatus'
import { useI18n } from '../i18n/LanguageContext'

export function SetlistPage() {
  const { jamId = '' } = useParams()
  const { data, actions } = useData()
  const jam = data.jams.find((item) => item.id === jamId)
  const manager = isManager(data, jamId)
  const items = data.setlist.filter((item) => item.jamId === jamId).sort((a, b) => a.position - b.position)
  const available = jamSongs(data, jamId).filter(({ song, details }) => canAddToSetlist(details.status) && !items.some((item) => item.songId === song.id))
  const reduceMotion = useReducedMotion()
  const { t } = useI18n()

  return (
    <main className="page tab-page app-screen">
      <motion.header className="tab-header jam-section-header" layoutId={`jam-section-${jamId}-setlist`} transition={{ type: 'spring', stiffness: 370, damping: 34 }}>
        {jam && <JamOverviewLink jamId={jamId} jamName={jam.name} />}
        <div className="section-title-row"><h1>{t('setlist.title')}</h1><span>{items.length}</span></div>
      </motion.header>
      {items.length ? (
        <motion.ol className="setlist-list" layout>
          <AnimatePresence initial={false}>{items.map((item, index) => {
            const song = data.songs.find((candidate) => candidate.id === item.songId)
            if (!song) return null
            const details = songDetails(data, song).details
            const invalid = !canAddToSetlist(details.status)
            return (
              <motion.li
                key={item.id}
                className={invalid ? 'invalid' : ''}
                layout
                initial={reduceMotion ? false : { x: 18, scale: 0.985 }}
                animate={{ x: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { x: -20, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 430, damping: 36 }}
              >
                <span className="setlist-number">{String(item.position).padStart(2, '0')}</span>
                <Link to={`/jam/${jamId}/song/${song.id}`} className="setlist-song">
                  <h3>{song.title}</h3><p>{song.artist}</p>
                  {invalid ? <span className="setlist-warning"><TriangleAlert size={15} /> {statusSummary(details, t)}</span> : <StatusBadge status={details.status} />}
                </Link>
                {manager && <div className="order-controls">
                  <motion.button whileTap={reduceMotion ? undefined : { scale: 0.88, y: -1 }} onClick={() => actions.moveSetlist(song.id, -1)} disabled={index === 0} aria-label={t('setlist.moveUpAria', { title: song.title })}><ArrowUp size={16} /></motion.button>
                  <motion.button whileTap={reduceMotion ? undefined : { scale: 0.88, y: 1 }} onClick={() => actions.moveSetlist(song.id, 1)} disabled={index === items.length - 1} aria-label={t('setlist.moveDownAria', { title: song.title })}><ArrowDown size={16} /></motion.button>
                  <motion.button whileTap={reduceMotion ? undefined : { scale: 0.88 }} onClick={() => actions.removeFromSetlist(song.id)} aria-label={t('setlist.removeAria', { title: song.title })}><Trash2 size={16} /></motion.button>
                </div>}
              </motion.li>
            )
          })}</AnimatePresence>
        </motion.ol>
      ) : <EmptyState icon={ListMusic} title={t('setlist.emptyTitle')} body={t('setlist.emptyBody')} />}

      {manager && available.length > 0 && <section className="section-block add-setlist">
        <div className="section-heading"><div><h2>{t('setlist.add')}</h2></div></div>
        <AnimatePresence initial={false}>{available.map(({ song, details }) => (
          <motion.button key={song.id} className="add-song-row" layout whileTap={reduceMotion ? undefined : { scale: 0.985 }} onClick={() => actions.addToSetlist(jamId, song.id)}>
            <span><strong>{song.title}</strong><small>{song.artist}</small></span>
            <StatusBadge status={details.status} /><Plus size={18} />
          </motion.button>
        ))}</AnimatePresence>
      </section>}
      {!manager && <p className="permission-note">{t('setlist.organizersOnly')}</p>}
      <div className="bottom-spacer" />
    </main>
  )
}
