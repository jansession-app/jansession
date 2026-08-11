export type PushLocale = 'it' | 'en'
export const TEST_PUSH_DELAY_MS = 5000

export interface TestPushPayload {
  title: 'JanSession'
  body: string
  url: '/jansession/#/jams'
}

export function createTestPushPayload(locale: PushLocale): TestPushPayload {
  return {
    title: 'JanSession',
    body: locale === 'it' ? 'Le notifiche funzionano.' : 'Notifications are working.',
    url: '/jansession/#/jams',
  }
}
