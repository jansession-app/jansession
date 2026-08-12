import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../supabase/migrations/202608120011_add_automatic_push_events.sql', import.meta.url),
  'utf8',
)

describe('automatic push migration contracts', () => {
  it('keeps the outbox private and creates one delivery per event/subscription', () => {
    expect(migration).toContain('create table private.push_events')
    expect(migration).toContain('create table private.push_deliveries')
    expect(migration).toContain('unique (event_id, subscription_id)')
    expect(migration).toContain('revoke all on table private.push_events from public, anon, authenticated')
    expect(migration).toContain('revoke all on table private.push_deliveries from public, anon, authenticated')
  })

  it('excludes the actor and suppresses self-assignment notifications', () => {
    expect(migration).toContain('recipient.user_id <> target_actor_user_id')
    expect(migration).toContain('actor_id = new.user_id')
    expect(migration).toContain('actor_id <> old.user_id')
  })

  it('deduplicates setlist recipients and emits add/remove events', () => {
    expect(migration).toContain('array_agg(distinct assignment.user_id)')
    expect(migration).toContain("target_event_type := case when tg_op = 'INSERT' then 'setlist_added' else 'setlist_removed' end")
  })

  it('emits one jam event only for approved changed fields', () => {
    expect(migration).toContain('new.starts_at is distinct from old.starts_at')
    expect(migration).toContain('new.location is distinct from old.location')
    expect(migration).toContain('new.location_address is distinct from old.location_address')
    expect(migration).toContain('after update of starts_at, location, location_address on public.jams')
  })

  it('deduplicates reminders by jam, user and current start time', () => {
    expect(migration).toContain("'jam-reminder:%s:%s:%s', candidate.jam_id, candidate.user_id, candidate.starts_at")
    expect(migration).toContain("interval '23 hours 45 minutes'")
    expect(migration).toContain("interval '24 hours 15 minutes'")
    expect(migration).toContain("event.event_type = 'jam_reminder'")
    expect(migration).toContain("(event.payload ->> 'startsAt')::timestamptz is distinct from jam.starts_at")
  })

  it('emits incomplete only when an in-setlist song was complete before deletion', () => {
    expect(migration).toContain('was_complete and is_in_setlist')
    expect(migration).toContain('assignment.slot_id is null')
    expect(migration).toContain("'song-incomplete:%s:%s:%s'")
  })

  it('suppresses assignment and setlist spam during destructive cleanup', () => {
    expect(migration).toContain("set_config('jansession.suppress_push', 'on', true)")
    expect(migration).toContain('before delete on public.jams')
    expect(migration).toContain('before delete on public.songs')
    expect(migration).toMatch(/remove_jam_participant[\s\S]*set_config\('jansession\.suppress_push', 'on', true\)[\s\S]*delete from public\.role_assignments/)
  })

  it('claims atomically and protects dispatcher RPCs from browser roles', () => {
    expect(migration).toContain('for update of delivery skip locked')
    expect(migration).toContain("status = 'processing'")
    expect(migration).toContain("coalesce(auth.role(), '') <> 'service_role'")
    expect(migration).toContain('revoke all on function public.claim_push_deliveries(integer) from public, anon, authenticated')
  })
})
