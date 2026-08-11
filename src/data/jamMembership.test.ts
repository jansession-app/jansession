import { describe, expect, it } from 'vitest'
import type { AppData } from '../domain/types'
import { createDemoData } from './demoSeed'
import {
  canChangeJamMemberRole,
  canLeaveJam,
  canRemoveJamMember,
  changeJamMemberRoleInData,
  removeJamMemberFromData,
} from './jamMembership'

const primaryJamId = 'jam-poggiardo'
const otherJamId = 'jam-blues-lecce'

function dataWithCrossJamMember(): AppData {
  const data = createDemoData()
  const otherSong = { ...data.songs[0]!, id: 'other-song', jamId: otherJamId }
  const otherSlot = { ...data.slots[0]!, id: 'other-slot', songId: otherSong.id }
  return {
    ...data,
    members: [...data.members, { jamId: otherJamId, userId: 'luca', role: 'musician', joinedAt: '2026-08-10T10:00:00.000Z' }],
    songs: [...data.songs, otherSong],
    slots: [...data.slots, otherSlot],
    assignments: [...data.assignments, { slotId: otherSlot.id, userId: 'luca', assignedBy: 'gian', createdAt: '2026-08-10T10:00:00.000Z' }],
    volunteers: [
      ...data.volunteers,
      { songId: 'smells', instrument: 'Chitarra', userId: 'luca' },
      { songId: otherSong.id, instrument: otherSlot.instrument, userId: 'luca' },
    ],
    preparations: [...data.preparations, { songId: otherSong.id, userId: 'luca', state: 'READY', updatedAt: '2026-08-10T10:00:00.000Z' }],
  }
}

describe('jam membership permissions', () => {
  it('allows a musician to leave the jam', () => {
    expect(canLeaveJam(createDemoData(), primaryJamId, 'marco')).toBe(true)
  })

  it('allows a co-organizer to leave the jam', () => {
    expect(canLeaveJam(createDemoData(), primaryJamId, 'luca')).toBe(true)
  })

  it('does not allow the creator to leave their jam', () => {
    expect(canLeaveJam(createDemoData(), primaryJamId, 'gian')).toBe(false)
  })

  it('allows the creator to remove a musician', () => {
    expect(canRemoveJamMember(createDemoData(), primaryJamId, 'gian', 'marco')).toBe(true)
  })

  it('allows the creator to remove a co-organizer', () => {
    expect(canRemoveJamMember(createDemoData(), primaryJamId, 'gian', 'luca')).toBe(true)
  })

  it('does not allow a non-creator to remove another member', () => {
    expect(canRemoveJamMember(createDemoData(), primaryJamId, 'luca', 'marco')).toBe(false)
  })

  it('allows the creator to promote a musician to co-organizer', () => {
    const data = createDemoData()
    expect(canChangeJamMemberRole(data, primaryJamId, 'gian', 'marco', 'co-organizer')).toBe(true)
    expect(changeJamMemberRoleInData(data, primaryJamId, 'marco', 'co-organizer').members.find((member) => member.jamId === primaryJamId && member.userId === 'marco')?.role).toBe('co-organizer')
  })

  it('allows the creator to return a co-organizer to musician', () => {
    const data = createDemoData()
    expect(canChangeJamMemberRole(data, primaryJamId, 'gian', 'luca', 'musician')).toBe(true)
    expect(changeJamMemberRoleInData(data, primaryJamId, 'luca', 'musician').members.find((member) => member.jamId === primaryJamId && member.userId === 'luca')?.role).toBe('musician')
  })
})

describe('jam member cleanup', () => {
  it('removes the member role assignments from the selected jam', () => {
    const next = removeJamMemberFromData(dataWithCrossJamMember(), primaryJamId, 'luca')
    const primarySongIds = new Set(next.songs.filter((song) => song.jamId === primaryJamId).map((song) => song.id))
    const primarySlotIds = new Set(next.slots.filter((slot) => primarySongIds.has(slot.songId)).map((slot) => slot.id))
    expect(next.assignments.some((assignment) => assignment.userId === 'luca' && primarySlotIds.has(assignment.slotId))).toBe(false)
  })

  it('keeps role slots present and makes the removed member slots free', () => {
    const data = dataWithCrossJamMember()
    const assignedSlotIds = data.assignments.filter((assignment) => assignment.userId === 'luca').map((assignment) => assignment.slotId)
    const next = removeJamMemberFromData(data, primaryJamId, 'luca')
    const primaryAssignedSlotIds = assignedSlotIds.filter((slotId) => data.slots.some((slot) => slot.id === slotId && data.songs.some((song) => song.id === slot.songId && song.jamId === primaryJamId)))
    expect(primaryAssignedSlotIds.every((slotId) => next.slots.some((slot) => slot.id === slotId))).toBe(true)
    expect(primaryAssignedSlotIds.every((slotId) => !next.assignments.some((assignment) => assignment.slotId === slotId))).toBe(true)
  })

  it('removes preparation and volunteers only from the selected jam', () => {
    const next = removeJamMemberFromData(dataWithCrossJamMember(), primaryJamId, 'luca')
    expect(next.preparations.some((item) => item.userId === 'luca' && item.songId !== 'other-song')).toBe(false)
    expect(next.volunteers.some((item) => item.userId === 'luca' && item.songId !== 'other-song')).toBe(false)
    expect(next.preparations.some((item) => item.userId === 'luca' && item.songId === 'other-song')).toBe(true)
    expect(next.volunteers.some((item) => item.userId === 'luca' && item.songId === 'other-song')).toBe(true)
  })

  it('preserves the same user membership and musical data in other jams', () => {
    const next = removeJamMemberFromData(dataWithCrossJamMember(), primaryJamId, 'luca')
    expect(next.members.some((member) => member.jamId === primaryJamId && member.userId === 'luca')).toBe(false)
    expect(next.members.some((member) => member.jamId === otherJamId && member.userId === 'luca')).toBe(true)
    expect(next.assignments.some((assignment) => assignment.slotId === 'other-slot' && assignment.userId === 'luca')).toBe(true)
    expect(next.songs.some((song) => song.id === 'other-song')).toBe(true)
    expect(next.profiles.some((profile) => profile.id === 'luca')).toBe(true)
  })
})
