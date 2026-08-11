import { describe, expect, it } from 'vitest'
import { formatCompactJamDate } from '../data/selectors'

describe('localized jam dates', () => {
  const date = '2026-08-22T20:30:00+02:00'

  it('formats compact dates in Italian', () => {
    expect(formatCompactJamDate(date, 'it')).toBe('Sab 22 ago · 20:30')
  })

  it('formats compact dates in English', () => {
    expect(formatCompactJamDate(date, 'en')).toBe('Sat 22 Aug · 20:30')
  })
})
