import { describe, expect, it } from 'vitest'
import { createTestPushPayload } from '../../supabase/functions/dispatch-push/payload'

describe('test push payload', () => {
  it('creates the Italian notification', () => {
    expect(createTestPushPayload('it')).toEqual({
      title: 'JanSession',
      body: 'Le notifiche funzionano.',
      url: '/jansession/#/jams',
    })
  })

  it('creates the English notification', () => {
    expect(createTestPushPayload('en')).toEqual({
      title: 'JanSession',
      body: 'Notifications are working.',
      url: '/jansession/#/jams',
    })
  })
})
