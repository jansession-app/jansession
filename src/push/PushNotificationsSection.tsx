import { Bell, BellOff, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/LanguageContext'
import {
  detectWebPushSupport,
  disablePushNotifications,
  enablePushNotifications,
  readPushNotificationState,
  sendTestPushNotification,
  type PushNotificationState,
} from './webPush'
import type { WebPushSupport } from './webPushSupport'

type ViewState = 'loading' | WebPushSupport | PushNotificationState['permission'] | 'error'

export function PushNotificationsSection({ userId }: { userId: string }) {
  const { language, t } = useI18n()
  const [viewState, setViewState] = useState<ViewState>('loading')
  const [subscriptionId, setSubscriptionId] = useState<string>()
  const [working, setWorking] = useState<'enable' | 'disable' | 'test' | null>(null)
  const [testSent, setTestSent] = useState(false)

  useEffect(() => {
    const support = detectWebPushSupport()
    if (support !== 'supported') {
      setViewState(support)
      return
    }
    let active = true
    void readPushNotificationState(userId, language).then((state) => {
      if (!active) return
      setViewState(state.permission)
      setSubscriptionId(state.subscriptionId)
    }).catch(() => {
      if (active) setViewState('error')
    })
    return () => { active = false }
  }, [language, userId])

  const enable = async () => {
    setWorking('enable')
    setTestSent(false)
    try {
      const state = await enablePushNotifications(userId, language)
      setViewState(state.permission)
      setSubscriptionId(state.subscriptionId)
    } catch {
      setViewState('error')
    } finally {
      setWorking(null)
    }
  }

  const disable = async () => {
    setWorking('disable')
    setTestSent(false)
    try {
      const state = await disablePushNotifications(userId)
      setViewState(state.permission)
      setSubscriptionId(undefined)
    } catch {
      setViewState('error')
    } finally {
      setWorking(null)
    }
  }

  const sendTest = async () => {
    if (!subscriptionId) return
    setWorking('test')
    setTestSent(false)
    try {
      await sendTestPushNotification(subscriptionId)
      setTestSent(true)
    } catch {
      setViewState('error')
    } finally {
      setWorking(null)
    }
  }

  const statusKey = viewState === 'enabled' ? 'profile.notificationsEnabled'
    : viewState === 'denied' ? 'profile.notificationsDenied'
      : viewState === 'ios-not-installed' ? 'profile.notificationsInstall'
        : viewState === 'unsupported' ? 'profile.notificationsUnsupported'
          : viewState === 'error' ? 'profile.notificationsError'
            : viewState === 'loading' ? 'common.loading'
              : 'profile.notificationsEnable'

  return (
    <section className="profile-notifications-section" aria-labelledby="profile-notifications-title">
      <div className="profile-notifications-row">
        {viewState === 'denied' || viewState === 'unsupported' ? <BellOff size={18} aria-hidden="true" /> : <Bell size={18} aria-hidden="true" />}
        <span><strong id="profile-notifications-title">{t('profile.notifications')}</strong><small>{t(statusKey)}</small></span>
      </div>
      {viewState === 'disabled' && <button className="secondary-button" type="button" onClick={() => { void enable() }} disabled={working !== null}>{working === 'enable' ? t('common.wait') : t('profile.notificationsEnable')}</button>}
      {viewState === 'enabled' && <div className="profile-notifications-actions">
        <button className="secondary-button" type="button" onClick={() => { void sendTest() }} disabled={working !== null}><Send size={15} aria-hidden="true" /> {working === 'test' ? t('common.wait') : t('profile.notificationsTest')}</button>
        <button className="text-button" type="button" onClick={() => { void disable() }} disabled={working !== null}>{working === 'disable' ? t('common.wait') : t('profile.notificationsDisable')}</button>
      </div>}
      {viewState === 'enabled' && <p className="profile-notifications-hint">{t('profile.notificationsTestHint')}</p>}
      {testSent && <p className="form-success" role="status">{t('profile.notificationsTestSent')}</p>}
    </section>
  )
}
