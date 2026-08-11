import { describe, expect, it } from 'vitest'
import { getWebPushSupport, urlBase64ToUint8Array } from './webPushSupport'

describe('Web Push capabilities', () => {
  it('detects complete Web Push support', () => {
    expect(getWebPushSupport({
      hasServiceWorker: true,
      hasPushManager: true,
      hasNotifications: true,
      isIos: false,
      isStandalone: false,
    })).toBe('supported')
  })

  it('reports unsupported browsers when a required API is missing', () => {
    expect(getWebPushSupport({
      hasServiceWorker: true,
      hasPushManager: false,
      hasNotifications: true,
      isIos: false,
      isStandalone: false,
    })).toBe('unsupported')
  })

  it('requires an installed Home Screen app on iOS', () => {
    expect(getWebPushSupport({
      hasServiceWorker: true,
      hasPushManager: true,
      hasNotifications: true,
      isIos: true,
      isStandalone: false,
    })).toBe('ios-not-installed')
  })

  it('converts a URL-safe VAPID public key to bytes', () => {
    expect([...urlBase64ToUint8Array('AQID_v8')]).toEqual([1, 2, 3, 254, 255])
  })
})
