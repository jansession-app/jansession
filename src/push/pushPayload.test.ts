import { describe, expect, it } from 'vitest'
import { createPushPayload, formatPushTime } from '../../supabase/functions/dispatch-push/payload'

const base = {
  eventId: 'event-one',
  targetPath: '/jansession/#/jam/jam-one/song/song-one',
  timezone: 'Europe/Rome',
} as const

describe('automatic push payloads', () => {
  it('localizes third-party role assignment and removal', () => {
    const payload = { songTitle: 'Everlong', instrument: 'Chitarra' }
    expect(createPushPayload({ ...base, eventType: 'role_assigned', locale: 'it', payload }).body)
      .toBe('Sei stato assegnato a Chitarra in “Everlong”.')
    expect(createPushPayload({ ...base, eventType: 'role_assigned', locale: 'en', payload }).body)
      .toBe("You've been assigned to Guitar in “Everlong”.")
    expect(createPushPayload({ ...base, eventType: 'role_removed', locale: 'it', payload }).body)
      .toBe('Non sei più assegnato a Chitarra in “Everlong”.')
    expect(createPushPayload({ ...base, eventType: 'role_removed', locale: 'en', payload }).body)
      .toBe("You're no longer assigned to Guitar in “Everlong”.")
  })

  it('localizes setlist add and remove events', () => {
    expect(createPushPayload({ ...base, eventType: 'setlist_added', locale: 'it', payload: { songTitle: 'Everlong' } }).body)
      .toBe('“Everlong” è stata aggiunta alla scaletta.')
    expect(createPushPayload({ ...base, eventType: 'setlist_removed', locale: 'en', payload: { songTitle: 'Everlong' } }).body)
      .toBe('“Everlong” was removed from the setlist.')
  })

  it('formats jam times with each subscription timezone', () => {
    const startsAt = '2026-08-22T18:30:00.000Z'
    expect(formatPushTime(startsAt, 'it', 'Europe/Rome')).toBe('20:30')
    expect(formatPushTime(startsAt, 'en', 'America/New_York')).toBe('2:30 PM')
  })

  it('formats reminders independently for Italian and English subscriptions', () => {
    const payload = { startsAt: '2026-08-22T18:30:00.000Z', location: 'Casa Giovanni' }
    expect(createPushPayload({ ...base, eventType: 'jam_reminder', locale: 'it', payload }).body)
      .toBe('Domani alle 20:30: Jam da Casa Giovanni.')
    expect(createPushPayload({ ...base, eventType: 'jam_reminder', locale: 'en', timezone: 'Europe/Rome', payload }).body)
      .toBe('Tomorrow at 8:30 PM: Jam at Casa Giovanni.')
  })

  it('uses JanSession when a reminder has no location', () => {
    const payload = { startsAt: '2026-08-22T18:30:00.000Z', location: null }
    expect(createPushPayload({ ...base, eventType: 'jam_reminder', locale: 'it', payload }).body)
      .toBe('Domani alle 20:30: JanSession.')
  })

  it('creates specific and generic jam update messages', () => {
    const timeChange = {
      startsAtChanged: true,
      locationChanged: false,
      addressChanged: false,
      oldStartsAt: '2026-08-22T17:30:00.000Z',
      startsAt: '2026-08-22T19:00:00.000Z',
    }
    expect(createPushPayload({ ...base, eventType: 'jam_updated', locale: 'it', payload: timeChange }).body)
      .toBe('La jam è stata spostata alle 21:00.')

    const multipleChanges = { ...timeChange, locationChanged: true, location: 'Sala prove' }
    expect(createPushPayload({ ...base, eventType: 'jam_updated', locale: 'en', payload: multipleChanges }).body)
      .toBe('The jam date, time or location changed.')
  })

  it('localizes the complete-to-incomplete transition', () => {
    const payload = { songTitle: 'Everlong', instrument: 'Chitarra' }
    expect(createPushPayload({ ...base, eventType: 'song_incomplete', locale: 'it', payload }).body)
      .toBe('“Everlong” non è più completa: manca Chitarra.')
    expect(createPushPayload({ ...base, eventType: 'song_incomplete', locale: 'en', payload }).body)
      .toBe('“Everlong” is no longer complete: Guitar is missing.')
  })

  it('keeps a stable tag and the event deep link across retries', () => {
    const input = { ...base, eventType: 'setlist_added' as const, locale: 'it' as const, payload: { songTitle: 'Everlong' } }
    const first = createPushPayload(input)
    const retry = createPushPayload(input)
    expect(first.tag).toBe('jansession:event-one')
    expect(retry.tag).toBe(first.tag)
    expect(first.url).toBe('/jansession/#/jam/jam-one/song/song-one')
  })
})
