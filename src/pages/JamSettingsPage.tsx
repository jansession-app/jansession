import { Globe2, Link2, Lock, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { PlaceCandidateSheet } from '../components/PlaceCandidateSheet'
import { WantedInstrumentsField } from '../components/WantedInstrumentsField'
import { useData } from '../data/DataContext'
import { canDeleteJam } from '../data/jamDeletion'
import { JamOverviewLink } from '../components/JamOverviewLink'
import { isManager } from '../data/selectors'
import { useI18n } from '../i18n/LanguageContext'
import { geocodePlace, uniqueCandidate } from '../discover/geocoding'
import type { GeocodeCandidate } from '../discover/types'

export function JamSettingsPage() {
  const { jamId = '' } = useParams()
  const { data, actions, mode } = useData()
  const navigate = useNavigate()
  const jam = data.jams.find((item) => item.id === jamId)
  const [name, setName] = useState(jam?.name ?? '')
  const [startsAt, setStartsAt] = useState(jam ? new Date(new Date(jam.startsAt).getTime() - new Date(jam.startsAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')
  const [location, setLocation] = useState(jam?.location ?? '')
  const [locationAddress, setLocationAddress] = useState(jam?.locationAddress ?? '')
  const [publicArea, setPublicArea] = useState(jam?.publicArea ?? '')
  const [visibility, setVisibility] = useState(jam?.visibility ?? 'link')
  const [acceptingMembers, setAcceptingMembers] = useState(jam?.acceptingMembers ?? true)
  const [wantedInstruments, setWantedInstruments] = useState<string[]>(jam?.wantedInstruments ?? [])
  const [proposalsOpen, setProposalsOpen] = useState(jam?.proposalsOpen ?? true)
  const [assignmentsOpen, setAssignmentsOpen] = useState(jam?.assignmentsOpen ?? true)
  const [deleting, setDeleting] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false)
  const [placeCandidates, setPlaceCandidates] = useState<GeocodeCandidate[]>([])
  const [placeSheetOpen, setPlaceSheetOpen] = useState(false)
  const [placeLoading, setPlaceLoading] = useState(false)
  const [placeError, setPlaceError] = useState(false)
  const geocodeRequest = useRef(0)
  const { language, t } = useI18n()
  if (!jam) return null
  const owner = canDeleteJam(jam, data.currentUserId)
  const manager = isManager(data, jamId)
  const saveJam = (candidateId?: string) => {
    actions.updateJam(jamId, { name: name.trim(), startsAt: new Date(startsAt).toISOString(), location: location.trim() || undefined, locationAddress: locationAddress.trim() || undefined, publicArea: publicArea.trim() || undefined, visibility, acceptingMembers, wantedInstruments, proposalsOpen, assignmentsOpen, publicPlaceCandidateId: candidateId })
    navigate(`/jam/${jamId}/musicians`)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!manager) return
    if (visibility !== 'public' || mode === 'demo') {
      saveJam()
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
      if (single) saveJam(single.candidateId)
      else if (resolved.length > 1) setPlaceSheetOpen(true)
      else setPlaceError(true)
    } catch (error: unknown) {
      console.error('[JanSession] Public jam place geocoding failed', error)
      setPlaceError(true)
    } finally {
      setPlaceLoading(false)
    }
  }
  const removeJam = async () => {
    setDeleting(true)
    setDeleteFailed(false)
    const deleted = await actions.deleteJam(jamId)
    setDeleting(false)
    if (deleted) {
      navigate('/jams', { replace: true })
      return
    }
    setDeleteFailed(true)
  }
  return <main className="page form-page settings-page app-screen">
    <motion.header className="jam-section-header" layoutId={`jam-section-${jamId}-settings`} transition={{ type: 'spring', stiffness: 370, damping: 34 }}><JamOverviewLink jamId={jamId} jamName={jam.name} /><h1>{t('settings.title')}</h1></motion.header>
    <form className="settings-form" onSubmit={(event) => { void submit(event) }}>
      <section className="form-section"><h2>{t('settings.details')}</h2>
        <label className="field"><span>{t('newJam.name')}</span><input required readOnly={!manager} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="field"><span>{t('newJam.dateTime')}</span><input required readOnly={!manager} type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
        <label className="field"><span>{t('newJam.location')}</span><input readOnly={!manager} value={location} onChange={(event) => setLocation(event.target.value)} placeholder={t('newJam.locationPlaceholder')} /></label>
        <label className="field"><span>{t('newJam.address')} <em>{t('common.optional')}</em></span><input readOnly={!manager} value={locationAddress} onChange={(event) => setLocationAddress(event.target.value)} placeholder={t('newJam.addressPlaceholder')} autoComplete="street-address" /></label>
      </section>
      <section className="form-section"><h2>{t('settings.permissions')}</h2><fieldset className="switch-list"><legend className="sr-only">{t('settings.permissionsAria')}</legend>
        <label className="setting-toggle"><strong>{t('settings.songProposals')}</strong><span className="toggle-control"><input type="checkbox" disabled={!manager} checked={proposalsOpen} onChange={(event) => setProposalsOpen(event.target.checked)} /><span aria-hidden="true" /></span></label>
        <label className="setting-toggle"><strong>{t('settings.assignments')}</strong><span className="toggle-control"><input type="checkbox" disabled={!manager} checked={assignmentsOpen} onChange={(event) => setAssignmentsOpen(event.target.checked)} /><span aria-hidden="true" /></span></label>
      </fieldset></section>
      <section className="form-section"><h2>{t('newJam.access')}</h2><fieldset className="visibility-field" disabled={!manager}><legend className="sr-only">{t('newJam.access')}</legend>
        <motion.button type="button" className={visibility === 'private' ? 'active' : ''} onClick={() => setVisibility('private')}><Lock size={19} /><span><strong>{t('newJam.private')}</strong><small>{t('newJam.privateHelp')}</small></span></motion.button>
        <motion.button type="button" className={visibility === 'link' ? 'active' : ''} onClick={() => setVisibility('link')}><Link2 size={19} /><span><strong>{t('newJam.withLink')}</strong><small>{t('newJam.withLinkHelp')}</small></span></motion.button>
        <motion.button type="button" className={visibility === 'public' ? 'active' : ''} onClick={() => setVisibility('public')}><Globe2 size={19} /><span><strong>{t('newJam.public')}</strong><small>{t('newJam.publicHelp')}</small></span></motion.button>
      </fieldset></section>
      {visibility === 'public' && <motion.section className="form-section discover-settings-section" initial={{ y: 10 }} animate={{ y: 0 }}><h2>{t('discover.settingsTitle')}</h2>
        <label className="field"><span>{t('discover.publicArea')}</span><input required minLength={2} maxLength={80} autoComplete="off" readOnly={!manager} value={publicArea} onChange={(event) => { geocodeRequest.current += 1; setPublicArea(event.target.value); setPlaceCandidates([]); setPlaceSheetOpen(false); setPlaceError(false) }} placeholder={t('discover.publicAreaPlaceholder')} /></label>
        {placeError && <p className="form-error" role="alert">{t('discover.placeResolveError')}</p>}
        <WantedInstrumentsField value={wantedInstruments} onChange={setWantedInstruments} disabled={!manager} />
        <label className="setting-toggle"><strong>{t('discover.acceptRequests')}</strong><span className="toggle-control"><input type="checkbox" disabled={!manager} checked={acceptingMembers} onChange={(event) => setAcceptingMembers(event.target.checked)} /><span aria-hidden="true" /></span></label>
      </motion.section>}
      {manager && <button className="primary-button full-button" disabled={placeLoading}>{placeLoading ? t('common.wait') : t('settings.save')}</button>}
    </form>
    {owner && <section className="jam-delete-section"><button className="delete-jam-action" type="button" disabled={deleting} onClick={() => setDeleteSheetOpen(true)}><Trash2 size={16} /> {t('settings.delete')}</button></section>}
    <ConfirmSheet open={deleteSheetOpen} title={t('settings.deleteTitle')} description={<><p>{t('settings.deleteDescription')}</p>{deleteFailed && <p className="form-error" role="alert">{t('data.error.deleteJam')}</p>}</>} confirmLabel={t('settings.delete')} danger pending={deleting} onClose={() => { setDeleteSheetOpen(false); setDeleteFailed(false) }} onConfirm={() => { void removeJam() }} />
    <PlaceCandidateSheet open={placeSheetOpen} title={t('discover.choosePlace')} candidates={placeCandidates} onClose={() => setPlaceSheetOpen(false)} onSelect={(candidate) => { setPlaceSheetOpen(false); saveJam(candidate.candidateId) }} />
  </main>
}
