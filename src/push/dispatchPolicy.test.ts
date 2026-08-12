import { describe, expect, it } from 'vitest'
import { deliveryOutcome, willRetry } from '../../supabase/functions/dispatch-push/dispatchPolicy'

describe('push delivery retry policy', () => {
  it('invalidates subscriptions rejected with 404 or 410', () => {
    expect(deliveryOutcome(404)).toBe('expired')
    expect(deliveryOutcome(410)).toBe('expired')
    expect(willRetry('expired', 1)).toBe(false)
  })

  it('retries temporary failures with a finite attempt limit', () => {
    expect(deliveryOutcome(undefined)).toBe('temporary')
    expect(deliveryOutcome(429)).toBe('temporary')
    expect(deliveryOutcome(503)).toBe('temporary')
    expect(willRetry('temporary', 4)).toBe(true)
    expect(willRetry('temporary', 5)).toBe(false)
  })

  it('does not retry permanent failures', () => {
    expect(deliveryOutcome(400)).toBe('permanent')
    expect(willRetry('permanent', 1)).toBe(false)
  })
})
