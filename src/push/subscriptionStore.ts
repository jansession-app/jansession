import type { Language } from '../i18n/language'

export interface PushSubscriptionInput {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  locale: Language
}

export interface PushSubscriptionRecord extends PushSubscriptionInput {
  id: string
}

export interface PushSubscriptionRepository {
  findByEndpoint(userId: string, endpoint: string): Promise<PushSubscriptionRecord | null>
  insert(input: PushSubscriptionInput): Promise<PushSubscriptionRecord>
  update(id: string, userId: string, input: Pick<PushSubscriptionInput, 'p256dh' | 'auth' | 'locale'>): Promise<PushSubscriptionRecord>
  remove(userId: string, endpoint: string): Promise<void>
}

export async function saveDeviceSubscription(repository: PushSubscriptionRepository, input: PushSubscriptionInput) {
  const existing = await repository.findByEndpoint(input.userId, input.endpoint)
  if (!existing) return repository.insert(input)
  return repository.update(existing.id, input.userId, {
    p256dh: input.p256dh,
    auth: input.auth,
    locale: input.locale,
  })
}

export async function removeDeviceSubscription(repository: PushSubscriptionRepository, userId: string, endpoint: string) {
  await repository.remove(userId, endpoint)
}

export async function updateDeviceSubscriptionLocale(repository: PushSubscriptionRepository, userId: string, endpoint: string, locale: Language) {
  const existing = await repository.findByEndpoint(userId, endpoint)
  if (!existing || existing.locale === locale) return existing
  return repository.update(existing.id, userId, {
    p256dh: existing.p256dh,
    auth: existing.auth,
    locale,
  })
}
