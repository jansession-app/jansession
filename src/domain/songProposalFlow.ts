export interface ProposalRole {
  instrument: string
  quantity: number
}

export interface SongProposalDraft {
  title: string
  artist: string
  listeningUrl: string
  roles: ProposalRole[]
}

export type SongProposalStep = 'song' | 'lineup'

export const DEFAULT_PROPOSAL_ROLES: ProposalRole[] = [
  { instrument: 'Voce', quantity: 1 },
  { instrument: 'Chitarra', quantity: 1 },
  { instrument: 'Basso', quantity: 1 },
  { instrument: 'Batteria', quantity: 1 },
]

export function updateProposalRoleQuantity(roles: ProposalRole[], instrument: string, delta: number) {
  return roles.map((role) => role.instrument === instrument
    ? { ...role, quantity: Math.max(0, role.quantity + delta) }
    : role)
}

export function addProposalRole(roles: ProposalRole[], rawInstrument: string) {
  const instrument = rawInstrument.trim()
  if (!instrument) return roles
  const existing = roles.find((role) => role.instrument.toLocaleLowerCase() === instrument.toLocaleLowerCase())
  if (!existing) return [...roles, { instrument, quantity: 1 }]
  if (existing.quantity > 0) return roles
  return roles.map((role) => role === existing ? { ...role, quantity: 1 } : role)
}

export function activeProposalRoles(roles: ProposalRole[]) {
  return roles.filter((role) => role.quantity > 0)
}

export function canPublishProposal(step: SongProposalStep, roles: ProposalRole[]) {
  return step === 'lineup' && activeProposalRoles(roles).length > 0
}

export function buildSongProposalInput(jamId: string, draft: SongProposalDraft) {
  return {
    jamId,
    title: draft.title.trim(),
    artist: draft.artist.trim(),
    listeningUrl: draft.listeningUrl.trim() || undefined,
    roles: activeProposalRoles(draft.roles),
  }
}
