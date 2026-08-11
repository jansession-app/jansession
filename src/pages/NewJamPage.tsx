import { Lock, Link2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackControl } from '../components/BackControl'
import { useData } from '../data/DataContext'
import { jamRoutes } from '../navigation'
import { useI18n } from '../i18n/LanguageContext'

export function NewJamPage() {
  const { actions } = useData()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [startsAt, setStartsAt] = useState('2026-08-22T20:30')
  const [location, setLocation] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'link'>('link')
  const reduceMotion = useReducedMotion()
  const { t } = useI18n()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const id = actions.addJam({ name: name.trim(), startsAt: new Date(startsAt).toISOString(), location: location.trim() || undefined, locationAddress: locationAddress.trim() || undefined, visibility })
    navigate(jamRoutes(id).overview)
  }
  return (
      <main className="page form-page new-jam-page app-screen">
        <header className="flow-header"><BackControl to="/jams" label={t('navigation.backToJams')} /><h1>{t('newJam.title')}</h1></header>
        <form onSubmit={submit}>
          <section className="form-section"><h2>{t('newJam.details')}</h2>
            <label className="field"><span>{t('newJam.name')}</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder={t('newJam.namePlaceholder')} /></label>
            <label className="field"><span>{t('newJam.dateTime')}</span><input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
            <label className="field"><span>{t('newJam.location')} <em>{t('common.optional')}</em></span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder={t('newJam.locationPlaceholder')} /></label>
            <label className="field"><span>{t('newJam.address')} <em>{t('common.optional')}</em></span><input value={locationAddress} onChange={(event) => setLocationAddress(event.target.value)} placeholder={t('newJam.addressPlaceholder')} autoComplete="street-address" /></label>
          </section>
          <section className="form-section"><h2>{t('newJam.access')}</h2><fieldset className="visibility-field"><legend className="sr-only">{t('newJam.access')}</legend>
            <motion.button whileTap={reduceMotion ? undefined : { scale: 0.97 }} type="button" className={visibility === 'private' ? 'active' : ''} onClick={() => setVisibility('private')}><Lock size={19} /><span><strong>{t('newJam.private')}</strong><small>{t('newJam.privateHelp')}</small></span></motion.button>
            <motion.button whileTap={reduceMotion ? undefined : { scale: 0.97 }} type="button" className={visibility === 'link' ? 'active' : ''} onClick={() => setVisibility('link')}><Link2 size={19} /><span><strong>{t('newJam.withLink')}</strong><small>{t('newJam.withLinkHelp')}</small></span></motion.button>
          </fieldset></section>
          <button className="primary-button full-button" type="submit">{t('newJam.create')}</button>
        </form>
      </main>
  )
}
