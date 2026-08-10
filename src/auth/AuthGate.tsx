import type { User } from '@supabase/supabase-js'
import { ArrowRight, Mail } from 'lucide-react'
import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { authRedirectUrl, hasSupabaseConfig, supabase } from '../lib/supabase'
import { PRODUCT_NAME } from '../domain/types'
import { STORAGE_KEYS } from '../config/brand'

interface AuthState { user: User | null; isDemo: boolean }
const AuthContext = createContext<AuthState>({ user: null, isDemo: true })

export function useAuth() { return useContext(AuthContext) }

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(hasSupabaseConfig)

  useEffect(() => {
    if (!supabase) return
    if (window.location.hash.startsWith('#/join/')) window.localStorage.setItem(STORAGE_KEYS.pendingRoute, window.location.hash)
    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setChecking(false)
      if (data.session?.user) restorePendingRoute()
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) restorePendingRoute()
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const value = useMemo(() => ({ user, isDemo: !hasSupabaseConfig }), [user])
  if (!hasSupabaseConfig) return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  if (checking) return <div className="auth-loading"><span>Caricamento…</span></div>
  if (!user) return <AuthPage />
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function restorePendingRoute() {
  const route = window.localStorage.getItem(STORAGE_KEYS.pendingRoute)
  if (!route) return
  window.localStorage.removeItem(STORAGE_KEYS.pendingRoute)
  window.location.hash = route
}

function AuthPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    setLoading(true); setError('')
    const { error: authError } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: authRedirectUrl } })
    setLoading(false)
    if (authError) setError(authError.message)
    else setSent(true)
  }
  const google = async () => {
    if (!supabase) return
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirectUrl } })
    if (authError) setError(authError.message)
  }
  return (
    <main className="auth-page">
      <section className="auth-brand"><strong>{PRODUCT_NAME}</strong><h1>La jam comincia prima della sala prove.</h1><p>Formazione, preparazione e scaletta in un solo posto.</p></section>
      <section className="auth-card">
        <p className="eyebrow">Accedi a {PRODUCT_NAME}</p><h2>{sent ? 'Controlla la tua email' : 'Bentornato'}</h2>
        {sent ? <><p>Ti abbiamo inviato un link sicuro a <strong>{email}</strong>.</p><button className="secondary-button full-button" onClick={() => setSent(false)}>Usa un’altra email</button></> : <>
          <form onSubmit={submit}><label className="field"><span>Email</span><div className="email-field"><Mail size={18} /><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@email.it" /></div></label><button className="primary-button full-button" disabled={loading}>{loading ? 'Invio…' : <>Continua con email <ArrowRight size={18} /></>}</button></form>
          <div className="auth-divider"><span>oppure</span></div>
          <button className="google-button" onClick={google}><strong>G</strong> Continua con Google</button>
          <p className="auth-note">Google è opzionale: se non è configurato, l’accesso via email continua a funzionare.</p>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
    </main>
  )
}
