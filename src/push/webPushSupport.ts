export type WebPushSupport = 'supported' | 'unsupported' | 'ios-not-installed'

export interface WebPushCapabilities {
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotifications: boolean
  isIos: boolean
  isStandalone: boolean
}

export function getWebPushSupport(capabilities: WebPushCapabilities): WebPushSupport {
  if (capabilities.isIos && !capabilities.isStandalone) return 'ios-not-installed'
  return capabilities.hasServiceWorker && capabilities.hasPushManager && capabilities.hasNotifications
    ? 'supported'
    : 'unsupported'
}

export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const bytes = atob(base64)
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0))
}
