import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const proposalPage = readFileSync(new URL('../pages/ProposeSongPage.tsx', import.meta.url), 'utf8')
const editPage = readFileSync(new URL('../pages/EditSongPage.tsx', import.meta.url), 'utf8')

describe('song proposal wizard wiring', () => {
  it('reviews the lineup before the only addSong call can publish', () => {
    expect(proposalPage).toContain("useState<SongProposalStep>('song')")
    expect(proposalPage).toContain('onSubmit={reviewLineup}')
    expect(proposalPage).toContain('onSubmit={publish}')
    expect(proposalPage.match(/actions\.addSong/g)).toHaveLength(1)
    expect(proposalPage.indexOf('actions.addSong')).toBeGreaterThan(proposalPage.indexOf('canPublishProposal(step, roles)'))
  })

  it('renders the default roles as the main lineup-step summary', () => {
    expect(proposalPage).toContain('useState<ProposalRole[]>(DEFAULT_PROPOSAL_ROLES)')
    expect(proposalPage).toContain('activeProposalRoles(roles).map')
    expect(proposalPage.indexOf('activeProposalRoles(roles).map')).toBeGreaterThan(proposalPage.indexOf("key=\"lineup\""))
  })

  it('returns to the song step without resetting any draft field or lineup change', () => {
    expect(proposalPage).toContain("onClick={() => setStep('song')}")
    expect(proposalPage).not.toMatch(/onClick=\{\(\) => \{[^}]*set(?:Title|Artist|ListeningUrl|Roles)/)
  })

  it('keeps the published proposal editor outside the creation wizard', () => {
    expect(editPage).not.toContain('SongProposalStep')
    expect(editPage).not.toContain('songForm.checkLineup')
    expect(editPage).toContain('actions.updateSong')
  })
})
