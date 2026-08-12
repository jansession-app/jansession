export type DeliveryOutcome = 'expired' | 'temporary' | 'permanent'

export function deliveryOutcome(status?: number): DeliveryOutcome {
  if (status === 404 || status === 410) return 'expired'
  if (status === undefined || status === 408 || status === 425 || status === 429 || status >= 500) return 'temporary'
  return 'permanent'
}

export function willRetry(outcome: DeliveryOutcome, attempt: number) {
  return outcome === 'temporary' && attempt < 5
}
