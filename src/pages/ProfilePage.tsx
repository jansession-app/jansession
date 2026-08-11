import { Check, ChevronRight, Languages, LogOut, RotateCcw } from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { INSTRUMENTS } from '../domain/types'
import { supabase } from '../lib/supabase'
import { getPasswordUpdateErrorKey } from '../auth/authErrors'
import { takeAfterOnboardingRoute } from '../invites/inviteFlow'
import { BottomSheet } from '../components/BottomSheet'
import { useI18n } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import { displayInstrument } from '../domain/songStatus'
import { PushNotificationsSection } from '../push/PushNotificationsSection'

const MIN_PASSWORD_LENGTH = 6

export function ProfilePage() {
  const { data, actions, mode } = useData()
  const navigate = useNavigate()
  const profile = data.profiles.find((item) => item.id === data.currentUserId)
  const [name, setName] = useState(profile?.displayName ?? '')
  const [instruments, setInstruments] = useState(profile?.instruments ?? [])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<TranslationKey | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false)
  const { language, setLanguage, t } = useI18n()
  const toggle = (instrument: string) => setInstruments((current) => current.includes(instrument) ? current.filter((item) => item !== instrument) : [...current, instrument])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    actions.updateProfile(name.trim(), instruments)
    const destination = takeAfterOnboardingRoute(window.localStorage)
    navigate(destination)
  }
  const savePassword = async (event: FormEvent) => {
    event.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)
    if (newPassword !== confirmPassword) {
      setPasswordError('profile.passwordMismatch')
      return
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError('auth.error.passwordTooShort')
      return
    }
    if (!supabase) {
      setPasswordError('auth.error.passwordUpdate')
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setPasswordError(getPasswordUpdateErrorKey(error))
        return
      }
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(true)
    } catch {
      setPasswordError('auth.error.passwordUpdate')
    } finally {
      setSavingPassword(false)
    }
  }
  const initials = (profile?.displayName || name || t('profile.defaultMusician')).split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return (
      <main className="page form-page profile-page app-screen">
        <header className="profile-header"><motion.div className="profile-avatar" layoutId="profile-avatar" aria-hidden="true">{initials}</motion.div><h1>{t('profile.title')}</h1></header>
        <section className="profile-section profile-identity-section">
          <div className="profile-section-heading"><h2>{t('profile.nameAndInstruments')}</h2></div>
          <form onSubmit={submit}>
            <label className="field"><span>{t('profile.displayName')}</span><input required value={name} onChange={(event) => setName(event.target.value)} /></label>
            <fieldset className="instrument-picker"><legend>{t('profile.instrumentsQuestion')}</legend>
              {INSTRUMENTS.map((instrument) => <button type="button" key={instrument} className={instruments.includes(instrument) ? 'active' : ''} onClick={() => toggle(instrument)}><span>{displayInstrument(instrument, t)}</span>{instruments.includes(instrument) && <Check size={17} />}</button>)}
            </fieldset>
            <button className="primary-button full-button" type="submit" disabled={!instruments.length}>{t('profile.save')}</button>
          </form>
        </section>
        <section className="profile-language-section">
          <button className="profile-language-row" type="button" onClick={() => setLanguageSheetOpen(true)}>
            <Languages size={18} aria-hidden="true" />
            <span><strong>{t('profile.language')}</strong><small>{t(language === 'it' ? 'profile.italian' : 'profile.english')}</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </section>
        {mode === 'supabase' && <PushNotificationsSection userId={data.currentUserId} />}
        {mode === 'supabase' && <section className="profile-section profile-password-section">
          <div className="profile-section-heading"><h2>{t('profile.password')}</h2></div>
          <form onSubmit={savePassword}>
            <label className="field"><span>{t('profile.newPassword')}</span><input type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
            <label className="field"><span>{t('profile.confirmPassword')}</span><input type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            <button className="secondary-button full-button" type="submit" disabled={savingPassword}>{savingPassword ? t('profile.saving') : t('profile.savePassword')}</button>
          </form>
          {passwordError && <p className="form-error" role="alert">{t(passwordError, { count: MIN_PASSWORD_LENGTH })}</p>}
          {passwordSuccess && <p className="form-success" role="status">{t('profile.passwordSaved')}</p>}
        </section>}
        {mode === 'supabase' && <section className="profile-session-section"><strong>{t('profile.session')}</strong><button className="logout-button" type="button" onClick={() => { void supabase?.auth.signOut() }}><LogOut size={17} /> {t('profile.signOut')}</button></section>}
        {mode === 'demo' && <div className="demo-tools"><p className="demo-note">{t('profile.demoData')}</p><button type="button" onClick={() => { actions.resetDemo(); navigate('/jams') }}><RotateCcw size={14} /> {t('profile.resetDemo')}</button></div>}
        <p className="partner-credit">{t('profile.partnerCredit')}</p>
        <BottomSheet open={languageSheetOpen} title={t('profile.language')} onClose={() => setLanguageSheetOpen(false)}>
          <div className="language-sheet-options">
            {(['it', 'en'] as const).map((option) => <button key={option} type="button" className={language === option ? 'active' : ''} aria-pressed={language === option} onClick={() => { setLanguage(option); setLanguageSheetOpen(false) }}><span>{t(option === 'it' ? 'profile.italian' : 'profile.english')}</span>{language === option && <Check size={18} aria-hidden="true" />}</button>)}
          </div>
        </BottomSheet>
      </main>
  )
}
