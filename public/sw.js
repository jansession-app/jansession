const APP_SCOPE_PATH = '/jansession/'
const DEFAULT_NOTIFICATION_PATH = '/jansession/#/jams'

function resolveNotificationTarget(candidate) {
  const fallback = new URL(DEFAULT_NOTIFICATION_PATH, self.location.origin)
  if (typeof candidate !== 'string' || !candidate) return fallback.href
  try {
    const target = new URL(candidate, self.location.origin)
    if (target.origin !== self.location.origin || !target.pathname.startsWith(APP_SCOPE_PATH)) return fallback.href
    return target.href
  } catch {
    return fallback.href
  }
}

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = {}
  }
  const title = typeof payload.title === 'string' && payload.title ? payload.title : 'JanSession'
  const body = typeof payload.body === 'string' ? payload.body : ''
  const targetUrl = resolveNotificationTarget(payload.url)
  const icon = new URL('icons/icon-192.png', self.registration.scope).href

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon,
    data: { url: targetUrl },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = resolveNotificationTarget(event.notification.data?.url)
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((client) => {
      try {
        const clientUrl = new URL(client.url)
        return clientUrl.origin === self.location.origin && clientUrl.pathname.startsWith(APP_SCOPE_PATH)
      } catch {
        return false
      }
    })
    if (existing) {
      if (existing.url === targetUrl) return existing.focus()
      if ('navigate' in existing) {
        const navigated = await existing.navigate(targetUrl)
        return (navigated ?? existing).focus()
      }
    }
    return self.clients.openWindow(targetUrl)
  })())
})
