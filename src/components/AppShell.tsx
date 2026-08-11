import { CalendarRange, UserRound } from 'lucide-react'
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { preserveAfterOnboardingRoute } from '../invites/inviteFlow'
import { activeGlobalNavigation, GLOBAL_NAVIGATION } from '../navigation'

export function RootShell() {
  const { data, mode, loading, syncError } = useData()
  const location = useLocation()

  if (loading) return <div className="auth-loading"><span>Caricamento…</span></div>
  const profile = mode === 'supabase' ? data.profiles.find((item) => item.id === data.currentUserId) : null
  if (mode === 'supabase' && profile && !profile.onboarded && location.pathname !== '/profile') {
    preserveAfterOnboardingRoute(location.pathname, window.localStorage)
    return <Navigate to="/profile" replace />
  }
  const showNavigation = !location.pathname.startsWith('/join/')
  return (
    <div className="app-root">
      {syncError && <div className="sync-error" role="alert">{syncError}</div>}
      <div className="view-transition" key={location.key}><Outlet /></div>
      {showNavigation && <GlobalNavigation pathname={location.pathname} />}
    </div>
  )
}

function GlobalNavigation({ pathname }: { pathname: string }) {
  const activeArea = activeGlobalNavigation(pathname)
  const icons = { jams: CalendarRange, profile: UserRound }
  return <nav className="bottom-nav" aria-label="Navigazione principale">{GLOBAL_NAVIGATION.map(({ key, to, label }) => {
    const Icon = icons[key]
    return <Link key={key} to={to} className={activeArea === key ? 'active' : ''} aria-current={activeArea === key ? 'page' : undefined}><Icon size={21} strokeWidth={2} aria-hidden="true" /><span>{label}</span></Link>
  })}</nav>
}

export function JamShell() {
  const { jamId = '' } = useParams()
  const { data } = useData()
  const jam = data.jams.find((item) => item.id === jamId)
  if (!jam) return <main className="page"><p>Jam non trovata.</p></main>

  return (
    <div className="jam-shell">
      <Outlet />
    </div>
  )
}
