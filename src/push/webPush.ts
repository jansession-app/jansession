import type { Language } from '../i18n/language'
import { supabase } from '../lib/supabase'
import { removeDeviceSubscription, saveDeviceSubscription, updateDeviceSubscriptionLocale } from './subscriptionStore'
import { supabasePushRepository } from './supabasePushRepository'
import { getWebPushSupport, urlBase64ToUint8Array, type WebPushSupport } from './webPushSupport'

export type PushPermissionState = 'enabled' | 'disabled' | 'denied'

export interface PushNotificationState {
  permission: PushPermissionState
  subscriptionId?: string
}

const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim()
const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`
const serviceWorkerScope = import.meta.env.BASE_URL

function isIosDevice() {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
  return /iPad|iPhone|iPod/i.test(navigatorWithStandalone.userAgent)
    || (navigatorWithStandalone.platform === 'MacIntel' && navigatorWithStandalone.maxTouchPoints > 1)
}

export function detectWebPushSupport(): WebPushSupport {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
  return getWebPushSupport({
    hasServiceWorker: 'serviceWorker' in window.navigator,
    hasPushManager: 'PushManager' in window,
    hasNotifications: 'Notification' in window,
    isIos: isIosDevice(),
    isStandalone: window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true,
  })
}

export async function registerPushServiceWorker() {
  if (!('serviceWorker' in window.navigator)) return null
  return window.navigator.serviceWorker.register(serviceWorkerUrl, { scope: serviceWorkerScope })
}

function serializeSubscription(subscription: PushSubscription, userId: string, locale: Language) {
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('Incomplete push subscription.')
  return { userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, locale }
}

async function currentBrowserSubscription() {
  const registration = await registerPushServiceWorker()
  return registration ? registration.pushManager.getSubscription() : null
}

export async function readPushNotificationState(userId: string, locale: Language): Promise<PushNotificationState> {
  if (Notification.permission === 'denied') return { permission: 'denied' }
  const subscription = await currentBrowserSubscription()
  if (!subscription) return { permission: 'disabled' }
  const saved = await saveDeviceSubscription(supabasePushRepository, serializeSubscription(subscription, userId, locale))
  return { permission: 'enabled', subscriptionId: saved.id }
}

export async function enablePushNotifications(userId: string, locale: Language): Promise<PushNotificationState> {
  if (!vapidPublicKey) throw new Error('The VAPID public key is not configured.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { permission: permission === 'denied' ? 'denied' : 'disabled' }
  const registration = await registerPushServiceWorker()
  if (!registration) throw new Error('Service workers are not available.')
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })
  const saved = await saveDeviceSubscription(supabasePushRepository, serializeSubscription(subscription, userId, locale))
  return { permission: 'enabled', subscriptionId: saved.id }
}

export async function disablePushNotifications(userId: string): Promise<PushNotificationState> {
  const subscription = await currentBrowserSubscription()
  if (!subscription) return { permission: Notification.permission === 'denied' ? 'denied' : 'disabled' }
  await removeDeviceSubscription(supabasePushRepository, userId, subscription.endpoint)
  await subscription.unsubscribe()
  return { permission: 'disabled' }
}

export async function syncPushSubscriptionLocale(userId: string, locale: Language) {
  if (detectWebPushSupport() !== 'supported' || Notification.permission !== 'granted') return
  const subscription = await currentBrowserSubscription()
  if (!subscription) return
  await updateDeviceSubscriptionLocale(supabasePushRepository, userId, subscription.endpoint, locale)
}

export async function sendTestPushNotification(subscriptionId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.functions.invoke('dispatch-push', { body: { subscriptionId } })
  if (error) throw error
}
