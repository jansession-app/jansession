import { describe, expect, it } from 'vitest'
import {
  removeDeviceSubscription,
  saveDeviceSubscription,
  updateDeviceSubscriptionPreferences,
  type PushSubscriptionInput,
  type PushSubscriptionRecord,
  type PushSubscriptionRepository,
} from './subscriptionStore'

class MemoryPushRepository implements PushSubscriptionRepository {
  records: PushSubscriptionRecord[] = []

  async findByEndpoint(userId: string, endpoint: string) {
    return this.records.find((record) => record.userId === userId && record.endpoint === endpoint) ?? null
  }

  async insert(input: PushSubscriptionInput) {
    const record = { ...input, id: `subscription-${this.records.length + 1}` }
    this.records.push(record)
    return record
  }

  async update(id: string, userId: string, input: Pick<PushSubscriptionInput, 'p256dh' | 'auth' | 'locale' | 'timezone'>) {
    const index = this.records.findIndex((record) => record.id === id && record.userId === userId)
    if (index < 0) throw new Error('Subscription not found')
    const current = this.records[index]!
    const updated = { ...current, ...input }
    this.records[index] = updated
    return updated
  }

  async remove(userId: string, endpoint: string) {
    this.records = this.records.filter((record) => record.userId !== userId || record.endpoint !== endpoint)
  }
}

const subscription = (endpoint: string, locale: 'it' | 'en' = 'it'): PushSubscriptionInput => ({
  userId: 'user-one',
  endpoint,
  p256dh: `key-${endpoint}`,
  auth: `auth-${endpoint}`,
  locale,
  timezone: 'Europe/Rome',
})

describe('push subscription storage', () => {
  it('saves a new device subscription', async () => {
    const repository = new MemoryPushRepository()
    const saved = await saveDeviceSubscription(repository, subscription('iphone'))
    expect(saved).toMatchObject({ userId: 'user-one', endpoint: 'iphone', locale: 'it' })
    expect(repository.records).toHaveLength(1)
  })

  it('removes only the current device subscription', async () => {
    const repository = new MemoryPushRepository()
    await saveDeviceSubscription(repository, subscription('iphone'))
    await saveDeviceSubscription(repository, subscription('mac'))
    await removeDeviceSubscription(repository, 'user-one', 'iphone')
    expect(repository.records.map((record) => record.endpoint)).toEqual(['mac'])
  })

  it('keeps multiple devices for the same account', async () => {
    const repository = new MemoryPushRepository()
    await saveDeviceSubscription(repository, subscription('iphone'))
    await saveDeviceSubscription(repository, subscription('mac'))
    expect(repository.records).toHaveLength(2)
    expect(new Set(repository.records.map((record) => record.userId))).toEqual(new Set(['user-one']))
  })

  it('updates the locale of the current subscription', async () => {
    const repository = new MemoryPushRepository()
    await saveDeviceSubscription(repository, subscription('iphone', 'it'))
    await updateDeviceSubscriptionPreferences(repository, 'user-one', 'iphone', 'en', 'America/New_York')
    expect(repository.records[0]?.locale).toBe('en')
    expect(repository.records[0]?.timezone).toBe('America/New_York')
  })
})
