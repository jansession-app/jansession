import type { User } from '@supabase/supabase-js'
import { Lock, LogIn, Mail, UserPlus } from 'lucide-react'
import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { PRODUCT_NAME } from '../domain/types'
import { getAuthErrorKey } from './authErrors'
import { preservePendingInviteRoute, takePendingRoute } from '../invites/inviteFlow'
import { useI18n } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'

interface AuthState { user: User | null; isDemo: boolean }
const AuthContext = createContext<AuthState>({ user: null, isDemo: true })

export function useAuth() { return useContext(AuthContext) }

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(hasSupabaseConfig)
  const { t } = useI18n()

  useEffect(() => {
    if (!supabase) return
    preservePendingInviteRoute(window.location.hash, window.localStorage)
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
  if (checking) return <div className="auth-loading"><span>{t('common.loading')}</span></div>
  if (!user) return <AuthPage />
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function restorePendingRoute() {
  const route = takePendingRoute(window.localStorage)
  if (!route) return
  window.location.hash = route
}

function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null)
  const [loading, setLoading] = useState<'login' | 'signup' | null>(null)
  const { t } = useI18n()
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const action = submitter?.value === 'signup' ? 'signup' : 'login'
    if (action === 'signup' && password.length < 6) {
      setErrorKey('auth.error.passwordTooShort')
      return
    }
    setLoading(action)
    setErrorKey(null)
    const credentials = { email: email.trim(), password }
    const { data, error: authError } = action === 'signup'
      ? await supabase.auth.signUp(credentials)
      : await supabase.auth.signInWithPassword(credentials)
    setLoading(null)
    if (authError) {
      setErrorKey(getAuthErrorKey(authError, action))
      return
    }
    if (!data.session) setErrorKey('auth.error.complete')
  }
  return (
    <main className="auth-page">
      <section className="auth-brand"><strong>{PRODUCT_NAME}</strong><h1>{t('auth.tagline')}</h1><p>{t('auth.description')}</p></section>
      <section className="auth-card">
        <p className="eyebrow">{t('auth.signInTo', { productName: PRODUCT_NAME })}</p><h2>{t('auth.welcomeBack')}</h2>
        <form onSubmit={submit}>
          <label className="field"><span>{t('auth.email')}</span><div className="auth-input"><Mail size={18} /><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t('auth.emailPlaceholder')} /></div></label>
          <label className="field"><span>{t('auth.password')}</span><div className="auth-input"><Lock size={18} /><input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>
          <button className="primary-button full-button" type="submit" name="auth-action" value="login" disabled={loading !== null}>{loading === 'login' ? t('auth.signingIn') : <><LogIn size={18} /> {t('auth.signIn')}</>}</button>
          <button className="secondary-button full-button" type="submit" name="auth-action" value="signup" disabled={loading !== null}>{loading === 'signup' ? t('auth.creatingAccount') : <><UserPlus size={18} /> {t('auth.createAccount')}</>}</button>
        </form>
        {errorKey && <p className="form-error" role="alert">{t(errorKey, { count: 6 })}</p>}
      </section>
    </main>
  )
}
