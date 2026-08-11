import { Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { useData } from '../data/DataContext'
import { canDeleteJam } from '../data/jamDeletion'
import { JamOverviewLink } from '../components/JamOverviewLink'
import { isManager } from '../data/selectors'
import { useI18n } from '../i18n/LanguageContext'

export function JamSettingsPage() {
  const { jamId = '' } = useParams()
  const { data, actions } = useData()
  const navigate = useNavigate()
  const jam = data.jams.find((item) => item.id === jamId)
  const [name, setName] = useState(jam?.name ?? '')
  const [startsAt, setStartsAt] = useState(jam ? new Date(new Date(jam.startsAt).getTime() - new Date(jam.startsAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')
  const [location, setLocation] = useState(jam?.location ?? '')
  const [locationAddress, setLocationAddress] = useState(jam?.locationAddress ?? '')
  const [proposalsOpen, setProposalsOpen] = useState(jam?.proposalsOpen ?? true)
  const [assignmentsOpen, setAssignmentsOpen] = useState(jam?.assignmentsOpen ?? true)
  const [deleting, setDeleting] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false)
  const { t } = useI18n()
  if (!jam) return null
  const owner = canDeleteJam(jam, data.currentUserId)
  const manager = isManager(data, jamId)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!manager) return
    actions.updateJam(jamId, { name: name.trim(), startsAt: new Date(startsAt).toISOString(), location: location.trim() || undefined, locationAddress: locationAddress.trim() || undefined, proposalsOpen, assignmentsOpen })
    navigate(`/jam/${jamId}/musicians`)
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
    <form className="settings-form" onSubmit={submit}>
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
      {manager && <button className="primary-button full-button">{t('settings.save')}</button>}
    </form>
    {owner && <section className="jam-delete-section"><button className="delete-jam-action" type="button" disabled={deleting} onClick={() => setDeleteSheetOpen(true)}><Trash2 size={16} /> {t('settings.delete')}</button></section>}
    <ConfirmSheet open={deleteSheetOpen} title={t('settings.deleteTitle')} description={<><p>{t('settings.deleteDescription')}</p>{deleteFailed && <p className="form-error" role="alert">{t('data.error.deleteJam')}</p>}</>} confirmLabel={t('settings.delete')} danger pending={deleting} onClose={() => { setDeleteSheetOpen(false); setDeleteFailed(false) }} onConfirm={() => { void removeJam() }} />
  </main>
}
