import { Check, LogOut, RotateCcw } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { INSTRUMENTS } from '../domain/types'
import { supabase } from '../lib/supabase'
import { PARTNER_CREDIT, STORAGE_KEYS } from '../config/brand'

export function ProfilePage() {
  const { data, actions, mode } = useData()
  const navigate = useNavigate()
  const profile = data.profiles.find((item) => item.id === data.currentUserId)
  const [name, setName] = useState(profile?.displayName ?? '')
  const [instruments, setInstruments] = useState(profile?.instruments ?? [])
  const toggle = (instrument: string) => setInstruments((current) => current.includes(instrument) ? current.filter((item) => item !== instrument) : [...current, instrument])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    actions.updateProfile(name.trim(), instruments)
    const destination = window.localStorage.getItem(STORAGE_KEYS.afterOnboarding) ?? '/home'
    window.localStorage.removeItem(STORAGE_KEYS.afterOnboarding)
    navigate(destination)
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
          {mode === 'supabase' && <button className="secondary-button full-button" type="button" onClick={() => { void supabase?.auth.signOut() }}><LogOut size={18} /> Esci</button>}
        </form>
        {mode === 'demo' && <div className="demo-tools"><p className="demo-note">Dati demo salvati su questo dispositivo</p><button type="button" onClick={() => { actions.resetDemo(); navigate('/home') }}><RotateCcw size={14} /> Ripristina demo</button></div>}
        <p className="partner-credit">{PARTNER_CREDIT}</p>
      </main>
  )
}
