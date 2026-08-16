import { ArrowRight, CalendarDays, Music2, UsersRound } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BackControl } from '../components/BackControl'
import { discoverRepository } from '../discover/discoverRepository'
import type { PublicJamDetail } from '../discover/types'
import { displayInstrument } from '../domain/songStatus'
import { formatCompactJamDate } from '../data/selectors'
import { jamRoutes } from '../navigation'
import { useI18n } from '../i18n/LanguageContext'

export function PublicJamPage() {
  const { jamId = '' } = useParams()
  const [jam, setJam] = useState<PublicJamDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState(false)
  const reduceMotion = useReducedMotion()
  const { language, t } = useI18n()

  useEffect(() => {
    let active = true
    setLoading(true)
    void discoverRepository.getPublicJam(jamId).then((result) => {
      if (active) setJam(result)
    }).catch((loadError: unknown) => {
      console.error('[JanSession] Public jam load failed', loadError)
      if (active) setError(true)
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [jamId])

  const requestToJoin = async () => {
    if (!jam) return
    setRequesting(true)
    setError(false)
    try {
      await discoverRepository.requestToJoin(jam.jamId)
      setJam({ ...jam, requestStatus: 'pending' })
    } catch (requestError: unknown) {
      console.error('[JanSession] Join request failed', requestError)
      setError(true)
    } finally {
      setRequesting(false)
    }
  }

  if (loading) return <div className="auth-loading"><span>{t('common.loading')}</span></div>
  if (!jam) return <main className="page public-jam-page app-screen"><BackControl to="/discover" label={t('discover.back')} /><p className="discover-empty">{t('discover.publicUnavailable')}</p></main>

  const canRequest = jam.acceptingMembers && jam.requestStatus !== 'pending' && jam.requestStatus !== 'accepted'
  return (
    <main className="page public-jam-page app-screen">
      <header className="public-jam-header"><BackControl to="/discover" label={t('discover.back')} /><motion.h1 initial={reduceMotion ? false : { y: 10 }} animate={{ y: 0 }}>{jam.name}</motion.h1><p>{jam.publicArea}</p><span><CalendarDays size={16} aria-hidden="true" /> {formatCompactJamDate(jam.startsAt, language)}</span></header>

      <section className="public-jam-metrics"><span><Music2 size={18} aria-hidden="true" /><strong>{jam.songCount}</strong>{t(jam.songCount === 1 ? 'discover.song' : 'discover.songs')}</span><span><UsersRound size={18} aria-hidden="true" /><strong>{jam.participantCount}</strong>{t(jam.participantCount === 1 ? 'discover.musician' : 'discover.musicians')}</span></section>

      {jam.wantedInstruments.length > 0 && <section className="public-jam-wanted"><h2>{t('discover.wanted')}</h2><p>{jam.wantedInstruments.map((instrument) => displayInstrument(instrument, t)).join(' · ')}</p></section>}

      <section className="public-song-section"><h2>{t('discover.proposedSongs')}</h2>{jam.songs.length ? <div className="public-song-list">{jam.songs.map((song, index) => <motion.article key={`${song.title}-${song.artist}-${index}`} layout><div><h3>{song.title}</h3><p>{song.artist}</p></div>{song.roles.length > 0 && <span>{song.roles.map((instrument) => displayInstrument(instrument, t)).join(' · ')}</span>}</motion.article>)}</div> : <p className="discover-empty">{t('discover.noSongs')}</p>}</section>

      <section className="public-join-action">
        {jam.requestStatus === 'accepted' ? <Link className="primary-button full-button" to={jamRoutes(jam.jamId).overview}>{t('discover.openJam')} <ArrowRight size={18} aria-hidden="true" /></Link>
          : jam.requestStatus === 'pending' ? <p className="request-state">{t('discover.requestSent')}</p>
            : canRequest ? <motion.button className="primary-button full-button" type="button" disabled={requesting} whileTap={reduceMotion ? undefined : { scale: 0.97 }} onClick={() => { void requestToJoin() }}>{requesting ? t('common.wait') : t('discover.requestToJoin')}</motion.button>
              : <p className="request-state">{t('discover.requestsClosed')}</p>}
        {error && <p className="form-error" role="alert">{t('discover.requestError')}</p>}
      </section>
    </main>
  )
}
