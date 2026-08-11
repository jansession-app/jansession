import { Home, ListMusic, Music2, UserRound, UsersRound } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { STORAGE_KEYS } from '../config/brand'
import { useData } from '../data/DataContext'
import { preserveAfterOnboardingRoute } from '../invites/inviteFlow'

export function RootShell() {
  const { data, mode, loading, syncError } = useData()
  const location = useLocation()
  const routeJamId = location.pathname.match(/^\/jam\/([^/]+)/)?.[1]
  const validJams = useMemo(() => {
    const memberJamIds = new Set(data.members.filter((member) => member.userId === data.currentUserId).map((member) => member.jamId))
    return data.jams.filter((jam) => memberJamIds.has(jam.id))
  }, [data.currentUserId, data.jams, data.members])
  const storedJamId = window.localStorage.getItem(STORAGE_KEYS.activeJam)
  const activeJamId = routeJamId && validJams.some((jam) => jam.id === routeJamId)
    ? routeJamId
    : validJams.some((jam) => jam.id === storedJamId) ? storedJamId : validJams[0]?.id

  useEffect(() => {
    if (routeJamId && validJams.some((jam) => jam.id === routeJamId)) window.localStorage.setItem(STORAGE_KEYS.activeJam, routeJamId)
  }, [routeJamId, validJams])

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
      {showNavigation && <GlobalNavigation activeJamId={activeJamId} pathname={location.pathname} />}
    </div>
  )
}

function GlobalNavigation({ activeJamId, pathname }: { activeJamId?: string | null; pathname: string }) {
  const activeArea = pathname === '/home' || pathname === '/jam/new'
    ? 'home'
    : pathname === '/profile' ? 'profile'
      : pathname.includes('/setlist') ? 'setlist'
        : pathname.includes('/musicians') || pathname.includes('/settings') ? 'musicians' : 'songs'
  const jamPath = (section: 'songs' | 'setlist' | 'musicians') => activeJamId ? `/jam/${activeJamId}/${section}` : '/home'
  const items = [
    { key: 'home', to: '/home', label: 'Home', icon: Home },
    { key: 'songs', to: jamPath('songs'), label: 'Brani', icon: Music2 },
    { key: 'setlist', to: jamPath('setlist'), label: 'Scaletta', icon: ListMusic },
    { key: 'musicians', to: jamPath('musicians'), label: 'Musicisti', icon: UsersRound },
    { key: 'profile', to: '/profile', label: 'Profilo', icon: UserRound },
  ]
  return <nav className="bottom-nav" aria-label="Navigazione principale">{items.map(({ key, to, label, icon: Icon }) => <Link key={key} to={to} className={activeArea === key ? 'active' : ''} aria-current={activeArea === key ? 'page' : undefined}><Icon size={21} strokeWidth={2} aria-hidden="true" /><span>{label}</span></Link>)}</nav>
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
