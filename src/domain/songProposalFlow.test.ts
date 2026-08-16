import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROPOSAL_ROLES,
  activeProposalRoles,
  addProposalRole,
  buildSongProposalInput,
  canPublishProposal,
  updateProposalRoleQuantity,
  type SongProposalDraft,
} from './songProposalFlow'

const draft = (roles = DEFAULT_PROPOSAL_ROLES): SongProposalDraft => ({
  title: ' Reptilia ',
  artist: ' The Strokes ',
  listeningUrl: ' https://example.com/song ',
  roles,
})

describe('new song proposal flow', () => {
  it('cannot publish directly from the song step', () => {
    expect(canPublishProposal('song', DEFAULT_PROPOSAL_ROLES)).toBe(false)
  })

  it('shows the unchanged default lineup in the lineup step', () => {
    expect(DEFAULT_PROPOSAL_ROLES).toEqual([
      { instrument: 'Voce', quantity: 1 },
      { instrument: 'Chitarra', quantity: 1 },
      { instrument: 'Basso', quantity: 1 },
      { instrument: 'Batteria', quantity: 1 },
    ])
    expect(canPublishProposal('lineup', DEFAULT_PROPOSAL_ROLES)).toBe(true)
  })

  it('confirms the default lineup without requiring changes', () => {
    expect(activeProposalRoles(DEFAULT_PROPOSAL_ROLES)).toEqual(DEFAULT_PROPOSAL_ROLES)
  })

  it('changes a role quantity', () => {
    const doubled = updateProposalRoleQuantity(DEFAULT_PROPOSAL_ROLES, 'Voce', 1)
    expect(doubled.find((role) => role.instrument === 'Voce')?.quantity).toBe(2)
  })

  it('allows a role quantity to reach zero', () => {
    const doubled = updateProposalRoleQuantity(DEFAULT_PROPOSAL_ROLES, 'Voce', 1)
    const removed = updateProposalRoleQuantity(doubled, 'Voce', -2)
    expect(removed.find((role) => role.instrument === 'Voce')?.quantity).toBe(0)
  })

  it('adds supported or custom instruments', () => {
    expect(addProposalRole(DEFAULT_PROPOSAL_ROLES, 'Tastiere')).toContainEqual({ instrument: 'Tastiere', quantity: 1 })
    expect(addProposalRole(DEFAULT_PROPOSAL_ROLES, 'Sax')).toContainEqual({ instrument: 'Sax', quantity: 1 })
  })

  it('restores an existing zero role instead of duplicating it', () => {
    const zeroVoice = updateProposalRoleQuantity(DEFAULT_PROPOSAL_ROLES, 'Voce', -1)
    expect(addProposalRole(zeroVoice, 'voce').find((role) => role.instrument === 'Voce')?.quantity).toBe(1)
  })

  it('blocks a completely empty lineup', () => {
    const empty = DEFAULT_PROPOSAL_ROLES.map((role) => ({ ...role, quantity: 0 }))
    expect(activeProposalRoles(empty)).toEqual([])
    expect(canPublishProposal('lineup', empty)).toBe(false)
  })

  it('publishes the existing payload shape and omits zero roles', () => {
    const changedRoles = updateProposalRoleQuantity(DEFAULT_PROPOSAL_ROLES, 'Voce', 1)
    const zeroBass = updateProposalRoleQuantity(changedRoles, 'Basso', -1)
    expect(buildSongProposalInput('jam-1', draft(zeroBass))).toEqual({
      jamId: 'jam-1',
      title: 'Reptilia',
      artist: 'The Strokes',
      listeningUrl: 'https://example.com/song',
      roles: zeroBass.filter((role) => role.instrument !== 'Basso'),
    })
  })
})
