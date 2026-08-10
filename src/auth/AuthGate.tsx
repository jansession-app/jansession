import type { User } from '@supabase/supabase-js'
import { Lock, LogIn, Mail, UserPlus } from 'lucide-react'
import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { PRODUCT_NAME } from '../domain/types'
import { STORAGE_KEYS } from '../config/brand'
import { getAuthErrorMessage } from './authErrors'

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
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState<'login' | 'signup' | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const action = submitter?.value === 'signup' ? 'signup' : 'login'
    if (action === 'signup' && password.length < 6) {
      setError('La password deve contenere almeno 6 caratteri.')
      return
    }
    setLoading(action)
    setError('')
    const credentials = { email: email.trim(), password }
    const { data, error: authError } = action === 'signup'
      ? await supabase.auth.signUp(credentials)
      : await supabase.auth.signInWithPassword(credentials)
    setLoading(null)
    if (authError) {
      setError(getAuthErrorMessage(authError, action))
      return
    }
    if (!data.session) setError('Non è stato possibile completare l’accesso. Riprova.')
  }
  return (
    <main className="auth-page">
      <section className="auth-brand"><strong>{PRODUCT_NAME}</strong><h1>La jam comincia prima della sala prove.</h1><p>Formazione, preparazione e scaletta in un solo posto.</p></section>
      <section className="auth-card">
        <p className="eyebrow">Accedi a {PRODUCT_NAME}</p><h2>Bentornato</h2>
        <form onSubmit={submit}>
          <label className="field"><span>Email</span><div className="auth-input"><Mail size={18} /><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@email.it" /></div></label>
          <label className="field"><span>Password</span><div className="auth-input"><Lock size={18} /><input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>
          <button className="primary-button full-button" type="submit" name="auth-action" value="login" disabled={loading !== null}>{loading === 'login' ? 'Accesso…' : <><LogIn size={18} /> Accedi</>}</button>
          <button className="secondary-button full-button" type="submit" name="auth-action" value="signup" disabled={loading !== null}>{loading === 'signup' ? 'Creazione…' : <><UserPlus size={18} /> Crea account</>}</button>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
    </main>
  )
}
