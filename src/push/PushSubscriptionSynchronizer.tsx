import { useEffect } from 'react'
import { useAuth } from '../auth/AuthGate'
import { useI18n } from '../i18n/LanguageContext'
import { syncPushSubscriptionPreferences } from './webPush'

export function PushSubscriptionSynchronizer() {
  const { user, isDemo } = useAuth()
  const { language } = useI18n()

  useEffect(() => {
    if (isDemo || !user) return
    void syncPushSubscriptionPreferences(user.id, language).catch((error: unknown) => {
      console.error('[JanSession] Push subscription synchronization failed', error)
    })
  }, [isDemo, language, user])

  return null
}
