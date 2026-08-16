import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../supabase/migrations/202608160012_allow_any_jam_song_in_setlist.sql', import.meta.url),
  'utf8',
)

describe('setlist RLS migration', () => {
  it('keeps manager and same-jam checks while removing preparation eligibility', () => {
    expect(migration).toContain('for insert to authenticated')
    expect(migration).toContain('private.can_manage_jam(jam_id)')
    expect(migration).toContain('private.song_jam_id(song_id) = jam_id')
    expect(migration).not.toContain('song_is_playable')
  })

  it('does not broaden other privileges or change push triggers', () => {
    expect(migration).not.toMatch(/disable row level security/i)
    expect(migration).not.toMatch(/grant\s+(insert|update|delete)/i)
    expect(migration).not.toMatch(/for\s+(update|delete)/i)
    expect(migration).not.toMatch(/trigger|push_events|push_deliveries/i)
  })
})
