import { describe, expect, it } from 'vitest'
import { getDataErrorDetails } from './errors'

describe('getDataErrorDetails', () => {
  it('preserves Supabase error fields from plain objects', () => {
    expect(getDataErrorDetails({
      message: 'Database request failed',
      code: '42883',
      details: 'Function resolution failed',
      hint: 'Qualify the function schema',
    })).toEqual({
      message: 'Database request failed',
      code: '42883',
      details: 'Function resolution failed',
      hint: 'Qualify the function schema',
    })
  })

  it('preserves native Error information', () => {
    const error = new Error('Network unavailable')
    const details = getDataErrorDetails(error)

    expect(details.message).toBe('Network unavailable')
    expect(details.name).toBe('Error')
    expect(details.stack).toBeTypeOf('string')
  })
})
