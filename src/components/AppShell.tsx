import { CalendarRange, Compass, UserRound } from 'lucide-react'
import { forwardRef, useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, LayoutGroup, motion, useIsPresent, useReducedMotion } from 'motion/react'
import { Link, Navigate, Outlet, useLocation, useOutlet, useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { preserveAfterOnboardingRoute } from '../invites/inviteFlow'
import { activeGlobalNavigation, GLOBAL_NAVIGATION } from '../navigation'
import { useI18n } from '../i18n/LanguageContext'
import { isProfileComplete } from '../domain/profileOnboarding'

export function RootShell() {
  const { data, mode, loading, syncError } = useData()
  const location = useLocation()
  const outlet = useOutlet()
  const reduceMotion = useReducedMotion()
  const { t } = useI18n()
  const currentDepth = routeDepth(location.pathname)
  const previousDepth = useRef(currentDepth)
  const direction = currentDepth === previousDepth.current
    ? (location.pathname === '/profile' ? 1 : -1)
    : currentDepth > previousDepth.current ? 1 : -1

  useEffect(() => {
    previousDepth.current = currentDepth
  }, [currentDepth])

  if (loading) return <div className="auth-loading"><span>{t('common.loading')}</span></div>
  const profile = mode === 'supabase' ? data.profiles.find((item) => item.id === data.currentUserId) : null
  const onboardingRequired = mode === 'supabase' && !isProfileComplete(profile)
  if (onboardingRequired && location.pathname !== '/profile') {
    preserveAfterOnboardingRoute(location.pathname, window.localStorage)
    return <Navigate to="/profile" replace />
  }
  const showNavigation = !location.pathname.startsWith('/join/') && !onboardingRequired
  return (
    <LayoutGroup id="app-navigation">
      <div className="app-root">
        {syncError && <div className="sync-error" role="alert">{syncError}</div>}
        <div className="route-stage">
          <AnimatePresence initial={false} mode="popLayout" custom={direction}>
            <RouteLayer
              key={location.pathname}
              direction={direction}
              reduceMotion={Boolean(reduceMotion)}
            >
              {outlet}
            </RouteLayer>
          </AnimatePresence>
        </div>
        {showNavigation && <GlobalNavigation pathname={location.pathname} />}
      </div>
    </LayoutGroup>
  )
}

const RouteLayer = forwardRef<HTMLDivElement, { children: ReactNode; direction: number; reduceMotion: boolean }>(function RouteLayer({ children, direction, reduceMotion }, ref) {
  const isPresent = useIsPresent()

  return (
    <motion.div
      ref={ref}
      className="view-transition"
      data-route-presence={isPresent ? 'present' : 'exiting'}
      aria-hidden={!isPresent}
      layoutScroll
      custom={direction}
      initial={reduceMotion ? false : { x: direction * 28, scale: 0.992 }}
      animate={{ x: 0, scale: 1 }}
      exit={reduceMotion ? { x: 0, scale: 1 } : { x: direction * -18, scale: 0.995 }}
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 410, damping: 38, mass: 0.72 }}
    >
      {children}
    </motion.div>
  )
})

function GlobalNavigation({ pathname }: { pathname: string }) {
  const { t } = useI18n()
  const activeArea = activeGlobalNavigation(pathname)
  const icons = { jams: CalendarRange, discover: Compass, profile: UserRound }
  const labels = { jams: 'navigation.jams', discover: 'navigation.discover', profile: 'navigation.profile' } as const
  return <nav className="bottom-nav" aria-label={t('navigation.mainAria')}>{GLOBAL_NAVIGATION.map(({ key, to }) => {
    const Icon = icons[key]
    const active = activeArea === key
    return <Link key={key} to={to} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
      {active && <motion.span className="bottom-nav-indicator" layoutId="global-navigation-indicator" transition={{ type: 'spring', stiffness: 440, damping: 34, mass: 0.7 }} />}
      <span className="bottom-nav-icon"><Icon size={20} strokeWidth={2} aria-hidden="true" /></span>
      <span className="bottom-nav-label">{t(labels[key])}</span>
    </Link>
  })}</nav>
}

function routeDepth(pathname: string) {
  if (!pathname.startsWith('/jam/')) return 0
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length <= 2) return 1
  return segments[2] === 'song' ? 3 : 2
}

export function JamShell() {
  const { jamId = '' } = useParams()
  const { data } = useData()
  const { t } = useI18n()
  const jam = data.jams.find((item) => item.id === jamId)
  if (!jam) return <main className="page"><p>{t('jam.notFound')}</p></main>

  return (
    <div className="jam-shell">
      <Outlet />
    </div>
  )
}
