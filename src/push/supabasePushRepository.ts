import { supabase } from '../lib/supabase'
import type { PushSubscriptionInput, PushSubscriptionRecord, PushSubscriptionRepository } from './subscriptionStore'

type PushSubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  locale: PushSubscriptionRecord['locale']
  timezone: string | null
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

function fromRow(row: PushSubscriptionRow): PushSubscriptionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    locale: row.locale,
    timezone: row.timezone ?? 'UTC',
  }
}

const columns = 'id, user_id, endpoint, p256dh, auth, locale, timezone'

export const supabasePushRepository: PushSubscriptionRepository = {
  async findByEndpoint(userId, endpoint) {
    const { data, error } = await requireSupabase()
      .from('push_subscriptions')
      .select(columns)
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .maybeSingle()
    if (error) throw error
    return data ? fromRow(data as PushSubscriptionRow) : null
  },
  async insert(input: PushSubscriptionInput) {
    const { data, error } = await requireSupabase()
      .from('push_subscriptions')
      .insert({ user_id: input.userId, endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth, locale: input.locale, timezone: input.timezone })
      .select(columns)
      .single()
    if (error) throw error
    return fromRow(data as PushSubscriptionRow)
  },
  async update(id, userId, input) {
    const { data, error } = await requireSupabase()
      .from('push_subscriptions')
      .update(input)
      .eq('id', id)
      .eq('user_id', userId)
      .select(columns)
      .single()
    if (error) throw error
    return fromRow(data as PushSubscriptionRow)
  },
  async remove(userId, endpoint) {
    const { error } = await requireSupabase()
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
    if (error) throw error
  },
}
