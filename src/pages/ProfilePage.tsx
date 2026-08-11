import { Check, LogOut, RotateCcw } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { INSTRUMENTS } from '../domain/types'
import { supabase } from '../lib/supabase'
import { PARTNER_CREDIT } from '../config/brand'
import { getPasswordUpdateErrorMessage } from '../auth/authErrors'
import { takeAfterOnboardingRoute } from '../invites/inviteFlow'

const MIN_PASSWORD_LENGTH = 6

export function ProfilePage() {
  const { data, actions, mode } = useData()
  const navigate = useNavigate()
  const profile = data.profiles.find((item) => item.id === data.currentUserId)
  const [name, setName] = useState(profile?.displayName ?? '')
  const [instruments, setInstruments] = useState(profile?.instruments ?? [])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const toggle = (instrument: string) => setInstruments((current) => current.includes(instrument) ? current.filter((item) => item !== instrument) : [...current, instrument])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    actions.updateProfile(name.trim(), instruments)
    const destination = takeAfterOnboardingRoute(window.localStorage)
    navigate(destination)
  }
  const savePassword = async (event: FormEvent) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    if (newPassword !== confirmPassword) {
      setPasswordError('Le password non coincidono.')
      return
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`La password deve contenere almeno ${MIN_PASSWORD_LENGTH} caratteri.`)
      return
    }
    if (!supabase) {
      setPasswordError('Non è stato possibile aggiornare la password. Riprova.')
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setPasswordError(getPasswordUpdateErrorMessage(error))
        return
      }
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess('Password salvata.')
    } catch {
      setPasswordError('Non è stato possibile aggiornare la password. Riprova.')
    } finally {
      setSavingPassword(false)
    }
  }
  return (
      <main className="page form-page profile-page app-screen">
        <header><p className="eyebrow">Il tuo profilo</p><h1>Come suoni?</h1><p>Gli strumenti indicano ciò che sai suonare. Sceglierai il ruolo brano per brano.</p></header>
        <form onSubmit={submit}>
          <label className="field"><span>Nome da mostrare</span><input required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <fieldset className="instrument-picker"><legend>Quali strumenti suoni?</legend>
            {INSTRUMENTS.map((instrument) => <button type="button" key={instrument} className={instruments.includes(instrument) ? 'active' : ''} onClick={() => toggle(instrument)}><span>{instrument}</span>{instruments.includes(instrument) && <Check size={18} />}</button>)}
          </fieldset>
          <button className="primary-button full-button" type="submit" disabled={!instruments.length}>Salva profilo</button>
        </form>
        {mode === 'supabase' && <section className="profile-password-section">
          <h2>Password</h2>
          <form onSubmit={savePassword}>
            <label className="field"><span>Nuova password</span><input type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
            <label className="field"><span>Conferma password</span><input type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            <button className="secondary-button full-button" type="submit" disabled={savingPassword}>{savingPassword ? 'Salvataggio…' : 'Salva password'}</button>
          </form>
          {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
          {passwordSuccess && <p className="form-success" role="status">{passwordSuccess}</p>}
        </section>}
        {mode === 'supabase' && <button className="secondary-button full-button" type="button" onClick={() => { void supabase?.auth.signOut() }}><LogOut size={18} /> Esci</button>}
        {mode === 'demo' && <div className="demo-tools"><p className="demo-note">Dati demo salvati su questo dispositivo</p><button type="button" onClick={() => { actions.resetDemo(); navigate('/home') }}><RotateCcw size={14} /> Ripristina demo</button></div>}
        <p className="partner-credit">{PARTNER_CREDIT}</p>
      </main>
  )
}
