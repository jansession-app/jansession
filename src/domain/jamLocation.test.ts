import { describe, expect, it } from 'vitest'
import type { Jam } from './types'
import { buildJamMapLinks, jamLocationDetails } from './jamLocation'

const baseJam: Jam = {
  id: 'jam-one',
  name: 'Jam di prova',
  startsAt: '2026-08-22T20:30:00+02:00',
  creatorId: 'user-one',
  visibility: 'link',
  acceptingMembers: true,
  wantedInstruments: [],
  proposalsOpen: true,
  assignmentsOpen: true,
  inviteCode: 'ABC123',
  createdAt: '2026-08-11T10:00:00.000Z',
}

describe('jam location', () => {
  it('keeps the place name separate from its address', () => {
    const details = jamLocationDetails({
      ...baseJam,
      location: 'Casa Giovanni',
      locationAddress: 'Via delle Rose 14, Poggiardo LE',
    })

    expect(details.name).toBe('Casa Giovanni')
    expect(details.address).toBe('Via delle Rose 14, Poggiardo LE')
    expect(details.mapLinks).not.toBeNull()
  })

  it('supports a jam with only a place name and no Maps actions', () => {
    const details = jamLocationDetails({ ...baseJam, location: 'Campagna di Luca' })

    expect(details.name).toBe('Campagna di Luca')
    expect(details.address).toBeUndefined()
    expect(details.mapLinks).toBeNull()
  })

  it('generates the Apple Maps URL from the address', () => {
    expect(buildJamMapLinks('Via Roma 82, Avigliano PZ')?.appleMaps)
      .toBe('https://maps.apple.com/?q=Via%20Roma%2082%2C%20Avigliano%20PZ')
  })

  it('generates the Google Maps URL from the address', () => {
    expect(buildJamMapLinks('Via Roma 82, Avigliano PZ')?.googleMaps)
      .toBe('https://www.google.com/maps/search/?api=1&query=Via%20Roma%2082%2C%20Avigliano%20PZ')
  })

  it('encodes spaces and non-ASCII characters in the address', () => {
    const links = buildJamMapLinks('Via Sant’Anna 8, Nardò LE')

    expect(links?.appleMaps).toContain('Via%20Sant%E2%80%99Anna%208%2C%20Nard%C3%B2%20LE')
    expect(links?.googleMaps).toContain('Via%20Sant%E2%80%99Anna%208%2C%20Nard%C3%B2%20LE')
  })

  it('does not expose Maps actions when the address is absent or blank', () => {
    expect(buildJamMapLinks()).toBeNull()
    expect(buildJamMapLinks('   ')).toBeNull()
  })
})
