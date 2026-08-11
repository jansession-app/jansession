import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
// @ts-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7'
import { createTestPushPayload, TEST_PUSH_DELAY_MS, type PushLocale } from './payload.ts'

const productionOrigin = 'https://jansession-app.github.io'

function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return productionOrigin
  if (origin === productionOrigin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin
  return null
}

function response(request: Request, body: Record<string, unknown>, status = 200) {
  const origin = allowedOrigin(request)
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin ?? productionOrigin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    },
  })
}

function requiredEnvironmentValue(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function serviceRoleKey() {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (legacyKey) return legacyKey
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
  const key = keys.default?.trim()
  if (!key) throw new Error('Missing Supabase secret key')
  return key
}

function errorStatus(error: unknown) {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return undefined
  return typeof error.statusCode === 'number' ? error.statusCode : undefined
}

Deno.serve(async (request) => {
  if (!allowedOrigin(request)) return response(request, { error: 'Origin not allowed' }, 403)
  if (request.method === 'OPTIONS') return response(request, { ok: true })
  if (request.method !== 'POST') return response(request, { error: 'Method not allowed' }, 405)

  try {
    const authorization = request.headers.get('authorization')
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return response(request, { error: 'Authentication required' }, 401)

    const supabaseUrl = requiredEnvironmentValue('SUPABASE_URL')
    const admin = createClient(supabaseUrl, serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData, error: authError } = await admin.auth.getUser(token)
    if (authError || !authData.user) return response(request, { error: 'Authentication required' }, 401)

    const body = await request.json().catch(() => null) as { subscriptionId?: unknown } | null
    const subscriptionId = typeof body?.subscriptionId === 'string' ? body.subscriptionId : ''
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(subscriptionId)) {
      return response(request, { error: 'Invalid subscription' }, 400)
    }

    const { data: subscription, error: subscriptionError } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, locale')
      .eq('id', subscriptionId)
      .eq('user_id', authData.user.id)
      .maybeSingle()
    if (subscriptionError) throw subscriptionError
    if (!subscription) return response(request, { error: 'Subscription not found' }, 404)

    webpush.setVapidDetails(
      requiredEnvironmentValue('VAPID_SUBJECT'),
      requiredEnvironmentValue('VAPID_PUBLIC_KEY'),
      requiredEnvironmentValue('VAPID_PRIVATE_KEY'),
    )
    const payload = createTestPushPayload(subscription.locale as PushLocale)

    try {
      await new Promise((resolve) => setTimeout(resolve, TEST_PUSH_DELAY_MS))
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify(payload), { TTL: 60, urgency: 'normal' })
    } catch (error: unknown) {
      const status = errorStatus(error)
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('id', subscription.id).eq('user_id', authData.user.id)
        return response(request, { error: 'Subscription expired' }, 410)
      }
      throw error
    }

    return response(request, { ok: true })
  } catch (error: unknown) {
    console.error('[dispatch-push] Test push failed', error instanceof Error ? error.message : 'Unknown error')
    return response(request, { error: 'Unable to send test notification' }, 500)
  }
})
