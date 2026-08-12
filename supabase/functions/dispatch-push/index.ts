import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
// @ts-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7'
import { deliveryOutcome, willRetry } from './dispatchPolicy.ts'
import { createPushPayload, type PushEventType, type PushLocale } from './payload.ts'

type ClaimedDelivery = {
  delivery_id: string
  event_id: string
  event_type: PushEventType
  payload: Record<string, unknown>
  target_path: string
  subscription_id: string
  endpoint: string
  p256dh: string
  auth: string
  locale: PushLocale
  timezone: string | null
  attempt: number
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requiredEnvironmentValue(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function serviceRoleKeys() {
  const availableKeys: string[] = []
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (legacyKey) availableKeys.push(legacyKey)
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
  for (const key of Object.values(keys)) {
    const normalized = key.trim()
    if (normalized && !availableKeys.includes(normalized)) availableKeys.push(normalized)
  }
  if (availableKeys.length === 0) throw new Error('Missing Supabase secret key')
  return availableKeys
}

function safeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left)
  const rightBytes = new TextEncoder().encode(right)
  if (leftBytes.length !== rightBytes.length) return false
  let difference = 0
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index]! ^ rightBytes[index]!
  }
  return difference === 0
}

function authorizedServerRequest(request: Request, secretKeys: string[]) {
  const suppliedKey = request.headers.get('apikey')?.trim()
  return Boolean(suppliedKey && secretKeys.some((secretKey) => safeEqual(suppliedKey, secretKey)))
}

function errorStatus(error: unknown) {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return undefined
  return typeof error.statusCode === 'number' ? error.statusCode : undefined
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown push failure'
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const secretKeys = serviceRoleKeys()
    if (!authorizedServerRequest(request, secretKeys)) return jsonResponse({ error: 'Authentication required' }, 401)

    const admin = createClient(requiredEnvironmentValue('SUPABASE_URL'), secretKeys[0]!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error: claimError } = await admin.rpc('claim_push_deliveries', { batch_size: 50 })
    if (claimError) throw claimError

    const deliveries = (data ?? []) as ClaimedDelivery[]
    const result = { claimed: deliveries.length, sent: 0, retried: 0, failed: 0, skipped: 0 }

    if (deliveries.length > 0) {
      webpush.setVapidDetails(
        requiredEnvironmentValue('VAPID_SUBJECT'),
        requiredEnvironmentValue('VAPID_PUBLIC_KEY'),
        requiredEnvironmentValue('VAPID_PRIVATE_KEY'),
      )
    }

    for (const delivery of deliveries) {
      const { data: isCurrent, error: currentError } = await admin.rpc('push_delivery_is_current', {
        target_delivery_id: delivery.delivery_id,
      })
      if (currentError) throw currentError
      if (!isCurrent) {
        result.skipped += 1
        continue
      }

      const notification = createPushPayload({
        eventId: delivery.event_id,
        eventType: delivery.event_type,
        payload: delivery.payload,
        targetPath: delivery.target_path,
        locale: delivery.locale,
        timezone: delivery.timezone,
      })

      try {
        const pushResult = await webpush.sendNotification({
          endpoint: delivery.endpoint,
          keys: { p256dh: delivery.p256dh, auth: delivery.auth },
        }, JSON.stringify(notification), {
          TTL: delivery.event_type === 'jam_reminder' ? 21600 : 3600,
          urgency: delivery.event_type === 'jam_reminder' ? 'normal' : 'high',
        })
        const { error: finishError } = await admin.rpc('finish_push_delivery', {
          target_delivery_id: delivery.delivery_id,
          outcome: 'sent',
          target_response_status: pushResult.statusCode,
          target_error: null,
        })
        if (finishError) throw finishError
        result.sent += 1
      } catch (error: unknown) {
        const status = errorStatus(error)
        const outcome = deliveryOutcome(status)
        const { error: finishError } = await admin.rpc('finish_push_delivery', {
          target_delivery_id: delivery.delivery_id,
          outcome,
          target_response_status: status ?? null,
          target_error: errorMessage(error),
        })
        if (finishError) throw finishError
        if (willRetry(outcome, delivery.attempt)) result.retried += 1
        else result.failed += 1
      }
    }

    return jsonResponse({ ok: true, ...result })
  } catch (error: unknown) {
    console.error('[dispatch-push] Dispatch failed', errorMessage(error))
    return jsonResponse({ error: 'Unable to dispatch notifications' }, 500)
  }
})
