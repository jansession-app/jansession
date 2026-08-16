import { Globe2, Lock, Link2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackControl } from '../components/BackControl'
import { PlaceCandidateSheet } from '../components/PlaceCandidateSheet'
import { WantedInstrumentsField } from '../components/WantedInstrumentsField'
import { useData } from '../data/DataContext'
import { jamRoutes } from '../navigation'
import { useI18n } from '../i18n/LanguageContext'
import { geocodePlace, uniqueCandidate } from '../discover/geocoding'
import type { GeocodeCandidate } from '../discover/types'

export function NewJamPage() {
  const { actions, mode } = useData()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [startsAt, setStartsAt] = useState('2026-08-22T20:30')
  const [location, setLocation] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [publicArea, setPublicArea] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'link' | 'public'>('link')
  const [acceptingMembers, setAcceptingMembers] = useState(true)
  const [wantedInstruments, setWantedInstruments] = useState<string[]>([])
  const [placeCandidates, setPlaceCandidates] = useState<GeocodeCandidate[]>([])
  const [placeSheetOpen, setPlaceSheetOpen] = useState(false)
  const [placeLoading, setPlaceLoading] = useState(false)
  const [placeError, setPlaceError] = useState(false)
  const geocodeRequest = useRef(0)
  const reduceMotion = useReducedMotion()
  const { language, t } = useI18n()
  const createJam = (candidateId?: string) => {
    const id = actions.addJam({ name: name.trim(), startsAt: new Date(startsAt).toISOString(), location: location.trim() || undefined, locationAddress: locationAddress.trim() || undefined, publicArea: publicArea.trim() || undefined, visibility, acceptingMembers, wantedInstruments, publicPlaceCandidateId: candidateId })
    navigate(jamRoutes(id).overview)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (visibility !== 'public' || mode === 'demo') {
      createJam()
      return
    }
    setPlaceLoading(true)
    setPlaceError(false)
    const requestId = ++geocodeRequest.current
    try {
      const resolved = await geocodePlace(publicArea, language)
      if (requestId !== geocodeRequest.current) return
      setPlaceCandidates(resolved)
      const single = uniqueCandidate(resolved)
      if (single) createJam(single.candidateId)
      else if (resolved.length > 1) setPlaceSheetOpen(true)
      else setPlaceError(true)
    } catch (error: unknown) {
      console.error('[JanSession] Public jam place geocoding failed', error)
      setPlaceError(true)
    } finally {
      setPlaceLoading(false)
    }
  }
  return (
      <main className="page form-page new-jam-page app-screen">
        <header className="flow-header"><BackControl to="/jams" label={t('navigation.backToJams')} /><h1>{t('newJam.title')}</h1></header>
        <form onSubmit={(event) => { void submit(event) }}>
          <section className="form-section"><h2>{t('newJam.details')}</h2>
            <label className="field"><span>{t('newJam.name')}</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder={t('newJam.namePlaceholder')} /></label>
            <label className="field"><span>{t('newJam.dateTime')}</span><input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
            <label className="field"><span>{t('newJam.location')} <em>{t('common.optional')}</em></span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder={t('newJam.locationPlaceholder')} /></label>
            <label className="field"><span>{t('newJam.address')} <em>{t('common.optional')}</em></span><input value={locationAddress} onChange={(event) => setLocationAddress(event.target.value)} placeholder={t('newJam.addressPlaceholder')} autoComplete="street-address" /></label>
          </section>
          <section className="form-section"><h2>{t('newJam.access')}</h2><fieldset className="visibility-field"><legend className="sr-only">{t('newJam.access')}</legend>
            <motion.button whileTap={reduceMotion ? undefined : { scale: 0.97 }} type="button" className={visibility === 'private' ? 'active' : ''} onClick={() => setVisibility('private')}><Lock size={19} /><span><strong>{t('newJam.private')}</strong><small>{t('newJam.privateHelp')}</small></span></motion.button>
            <motion.button whileTap={reduceMotion ? undefined : { scale: 0.97 }} type="button" className={visibility === 'link' ? 'active' : ''} onClick={() => setVisibility('link')}><Link2 size={19} /><span><strong>{t('newJam.withLink')}</strong><small>{t('newJam.withLinkHelp')}</small></span></motion.button>
            <motion.button whileTap={reduceMotion ? undefined : { scale: 0.97 }} type="button" className={visibility === 'public' ? 'active' : ''} onClick={() => setVisibility('public')}><Globe2 size={19} /><span><strong>{t('newJam.public')}</strong><small>{t('newJam.publicHelp')}</small></span></motion.button>
          </fieldset></section>
          {visibility === 'public' && <motion.section className="form-section discover-settings-section" initial={{ y: 10 }} animate={{ y: 0 }}>
            <h2>{t('discover.settingsTitle')}</h2>
            <label className="field"><span>{t('discover.publicArea')}</span><input required minLength={2} maxLength={80} autoComplete="off" value={publicArea} onChange={(event) => { geocodeRequest.current += 1; setPublicArea(event.target.value); setPlaceCandidates([]); setPlaceSheetOpen(false); setPlaceError(false) }} placeholder={t('discover.publicAreaPlaceholder')} /></label>
            {placeError && <p className="form-error" role="alert">{t('discover.placeResolveError')}</p>}
            <WantedInstrumentsField value={wantedInstruments} onChange={setWantedInstruments} />
            <label className="setting-toggle"><strong>{t('discover.acceptRequests')}</strong><span className="toggle-control"><input type="checkbox" checked={acceptingMembers} onChange={(event) => setAcceptingMembers(event.target.checked)} /><span aria-hidden="true" /></span></label>
          </motion.section>}
          <button className="primary-button full-button" type="submit" disabled={placeLoading}>{placeLoading ? t('common.wait') : t('newJam.create')}</button>
        </form>
        <PlaceCandidateSheet open={placeSheetOpen} title={t('discover.choosePlace')} candidates={placeCandidates} onClose={() => setPlaceSheetOpen(false)} onSelect={(candidate) => { setPlaceSheetOpen(false); createJam(candidate.candidateId) }} />
      </main>
  )
}
