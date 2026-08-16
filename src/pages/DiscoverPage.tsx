import { ArrowUpRight, Search } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PlaceCandidateSheet } from '../components/PlaceCandidateSheet'
import { discoverRepository } from '../discover/discoverRepository'
import { formatDiscoverDistance, geocodePlace, uniqueCandidate } from '../discover/geocoding'
import type { DiscoverJamSummary, GeocodeCandidate } from '../discover/types'
import { displayInstrument } from '../domain/songStatus'
import { formatCompactJamDate } from '../data/selectors'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n/LanguageContext'

const MotionLink = motion.create(Link)

export function DiscoverPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DiscoverJamSummary[]>([])
  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<GeocodeCandidate | null>(null)
  const [candidateSheetOpen, setCandidateSheetOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [placeNotFound, setPlaceNotFound] = useState(false)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const geocodeRequest = useRef(0)
  const reduceMotion = useReducedMotion()
  const { language, t } = useI18n()

  const runSearch = async (candidate: GeocodeCandidate, targetPage: number, append = false) => {
    setLoading(true)
    setError(false)
    try {
      const rows = await discoverRepository.search(candidate.candidateId, targetPage)
      setResults((current) => append ? [...current, ...rows] : rows)
      setSelectedCandidate(candidate)
      setPage(targetPage)
      setHasMore(rows.length === 30)
      setSearched(true)
    } catch (searchError: unknown) {
      console.error('[JanSession] Geographic Discover search failed', searchError)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || query.trim().length < 2) return
    setLoading(true)
    setError(false)
    setPlaceNotFound(false)
    const requestId = ++geocodeRequest.current
    try {
      const resolved = await geocodePlace(query, language)
      if (requestId !== geocodeRequest.current) return
      setCandidates(resolved)
      const single = uniqueCandidate(resolved)
      if (single) {
        await runSearch(single, 0)
      } else if (resolved.length > 1) {
        setCandidateSheetOpen(true)
      } else {
        setResults([])
        setSearched(false)
        setPlaceNotFound(true)
      }
    } catch (searchError: unknown) {
      console.error('[JanSession] Place geocoding failed', searchError)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const changeQuery = (value: string) => {
    geocodeRequest.current += 1
    setQuery(value)
    setCandidates([])
    setSelectedCandidate(null)
    setCandidateSheetOpen(false)
    setResults([])
    setSearched(false)
    setPlaceNotFound(false)
    setError(false)
    setPage(0)
    setHasMore(false)
  }

  return (
    <main className="page discover-page app-screen">
      <header className="discover-header"><h1>{t('discover.title')}</h1></header>
      <form className="discover-search" onSubmit={(event) => { void submit(event) }} role="search">
        <label><span className="sr-only">{t('discover.searchLabel')}</span><Search size={19} aria-hidden="true" /><input type="search" minLength={2} maxLength={80} autoComplete="off" value={query} onChange={(event) => changeQuery(event.target.value)} placeholder={t('discover.searchPlaceholder')} /></label>
        <motion.button className="primary-button" type="submit" disabled={loading || query.trim().length < 2} whileTap={reduceMotion ? undefined : { scale: 0.96 }}>{loading ? t('common.wait') : t('discover.search')}</motion.button>
      </form>

      {!supabase && <p className="discover-empty">{t('discover.demoUnavailable')}</p>}
      {error && <p className="form-error" role="alert">{t('discover.searchError')}</p>}
      {placeNotFound && <p className="discover-empty">{t('discover.placeNotFound')}</p>}
      {searched && !loading && results.length === 0 && <p className="discover-empty">{t('discover.noResults')}</p>}

      <motion.div className="discover-results" layout>
        <AnimatePresence initial={false}>{results.map((jam) => (
          <MotionLink key={jam.jamId} className="discover-card" to={`/discover/jam/${encodeURIComponent(jam.jamId)}`} layout initial={reduceMotion ? false : { x: 18, scale: 0.985 }} animate={{ x: 0, scale: 1 }} exit={reduceMotion ? undefined : { x: -16, scale: 0.98 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }}>
            <div className="discover-card-main"><h2>{jam.name}</h2><p>{jam.publicArea} · {formatDiscoverDistance(jam.distanceMeters, language)} · {formatCompactJamDate(jam.startsAt, language)}</p><small>{t('discover.counts', { songs: jam.songCount, musicians: jam.participantCount })}</small></div>
            {jam.wantedInstruments.length > 0 && <div className="discover-wanted"><strong>{t('discover.wanted')}</strong><span>{jam.wantedInstruments.map((instrument) => displayInstrument(instrument, t)).join(' · ')}</span></div>}
            <span className="discover-open">{t('discover.viewJam')} <ArrowUpRight size={16} aria-hidden="true" /></span>
          </MotionLink>
        ))}</AnimatePresence>
      </motion.div>
      {results.length > 0 && hasMore && selectedCandidate && <button className="secondary-button discover-more" type="button" disabled={loading} onClick={() => { void runSearch(selectedCandidate, page + 1, true) }}>{t('discover.loadMore')}</button>}
      {(searched || placeNotFound) && <p className="discover-attribution">{t('discover.attributionPrefix')} · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></p>}
      <PlaceCandidateSheet open={candidateSheetOpen} title={t('discover.choosePlace')} candidates={candidates} onClose={() => setCandidateSheetOpen(false)} onSelect={(candidate) => { setCandidateSheetOpen(false); void runSearch(candidate, 0) }} />
    </main>
  )
}
