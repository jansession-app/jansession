import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const normalUi = [
  '../pages/HomePage.tsx',
  '../pages/JamOverviewPage.tsx',
  '../pages/JamSongsPage.tsx',
  '../pages/MyJamPage.tsx',
  '../pages/SetlistPage.tsx',
  '../pages/SongDetailPage.tsx',
  '../components/StatusBadge.tsx',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n')

describe('normal UI status vocabulary', () => {
  it('does not render the old four-state selector or Playable labels', () => {
    expect(normalUi).not.toContain('PREPARATION_OPTIONS')
    expect(normalUi).not.toContain('PREPARATION_LABEL_KEYS')
    expect(normalUi).not.toContain('songs.group.playable')
    expect(normalUi).not.toMatch(/Suonabile|Playable/)
  })
})
