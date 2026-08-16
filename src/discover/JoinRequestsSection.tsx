import { Check, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { displayInstrument } from '../domain/songStatus'
import { useI18n } from '../i18n/LanguageContext'
import { discoverRepository } from './discoverRepository'
import type { JamJoinRequest } from './types'

export function JoinRequestsSection({ jamId }: { jamId: string }) {
  const [requests, setRequests] = useState<JamJoinRequest[]>([])
  const [actingId, setActingId] = useState('')
  const [error, setError] = useState(false)
  const reduceMotion = useReducedMotion()
  const { t } = useI18n()

  useEffect(() => {
    let active = true
    void discoverRepository.listJoinRequests(jamId).then((rows) => {
      if (active) setRequests(rows)
    }).catch((loadError: unknown) => {
      console.error('[JanSession] Join requests load failed', loadError)
      if (active) setError(true)
    })
    return () => { active = false }
  }, [jamId])

  const decide = async (request: JamJoinRequest, decision: 'accept' | 'reject') => {
    setActingId(request.requestId)
    setError(false)
    try {
      if (decision === 'accept') await discoverRepository.acceptRequest(request.requestId)
      else await discoverRepository.rejectRequest(request.requestId)
      setRequests((current) => current.filter((item) => item.requestId !== request.requestId))
    } catch (decisionError: unknown) {
      console.error('[JanSession] Join request decision failed', decisionError)
      setError(true)
    } finally {
      setActingId('')
    }
  }

  if (!requests.length && !error) return null
  return (
    <motion.section className="join-requests-section" layout>
      <div className="section-heading"><div><h2>{t('discover.requests')}</h2></div>{requests.length > 0 && <span className="count-label">{requests.length}</span>}</div>
      <AnimatePresence initial={false}>{requests.map((request) => <motion.article className="join-request-row" key={request.requestId} layout initial={reduceMotion ? false : { x: 12, scale: 0.99 }} animate={{ x: 0, scale: 1 }} exit={reduceMotion ? undefined : { x: -18, scale: 0.98 }}>
        <span className="avatar" aria-hidden="true">{request.displayName.slice(0, 2).toUpperCase()}</span>
        <div><h3>{request.displayName}</h3><p>{request.instruments.length ? request.instruments.map((instrument) => displayInstrument(instrument, t)).join(' · ') : t('discover.noInstruments')}</p></div>
        <div className="join-request-actions"><button type="button" disabled={actingId === request.requestId} onClick={() => { void decide(request, 'reject') }} aria-label={t('discover.rejectRequestAria', { name: request.displayName })}><X size={17} aria-hidden="true" /><span>{t('discover.reject')}</span></button><button className="accept" type="button" disabled={actingId === request.requestId} onClick={() => { void decide(request, 'accept') }} aria-label={t('discover.acceptRequestAria', { name: request.displayName })}><Check size={17} aria-hidden="true" /><span>{t('discover.accept')}</span></button></div>
      </motion.article>)}</AnimatePresence>
      {error && <p className="form-error" role="alert">{t('discover.requestsError')}</p>}
    </motion.section>
  )
}
