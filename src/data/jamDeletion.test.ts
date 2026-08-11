import { describe, expect, it } from 'vitest'
import { createDemoData } from './demoSeed'
import { canDeleteJam, removeJamFromData } from './jamDeletion'
import { jamsForUser } from './selectors'

describe('jam deletion', () => {
  it('allows the creator to delete their jam', () => {
    const data = createDemoData()
    expect(canDeleteJam(data.jams[0], 'gian')).toBe(true)
  })

  it('does not expose deletion to a user who is not the creator', () => {
    const data = createDemoData()
    expect(canDeleteJam(data.jams[0], 'luca')).toBe(false)
  })

  it('removes the deleted jam and its linked local data from the UI state', () => {
    const data = createDemoData()
    const next = removeJamFromData(data, 'jam-poggiardo')

    expect(jamsForUser(next, 'gian').map((jam) => jam.id)).toEqual(['jam-blues-lecce'])
    expect(next.members.some((member) => member.jamId === 'jam-poggiardo')).toBe(false)
    expect(next.songs).toHaveLength(0)
    expect(next.slots).toHaveLength(0)
    expect(next.assignments).toHaveLength(0)
    expect(next.volunteers).toHaveLength(0)
    expect(next.preparations).toHaveLength(0)
    expect(next.setlist).toHaveLength(0)
  })
})
