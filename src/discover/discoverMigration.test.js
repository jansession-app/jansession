import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../supabase/migrations/202608160013_add_discover.sql', import.meta.url),
  'utf8',
)
const paginationFixMigration = readFileSync(
  new URL('../../supabase/migrations/202608160014_fix_discover_pagination.sql', import.meta.url),
  'utf8',
)

function functionSql(name) {
  const start = migration.indexOf(`create function public.${name}`)
  const replacementStart = migration.indexOf(`create or replace function public.${name}`)
  const actualStart = start >= 0 ? start : replacementStart
  expect(actualStart).toBeGreaterThanOrEqual(0)
  const end = migration.indexOf('\n$$;', actualStart)
  return migration.slice(actualStart, end + 4)
}

describe('Discover database migration', () => {
  it('requires a non-empty public area for public jams without copying private location', () => {
    expect(migration).toContain('add column public_area text null')
    expect(migration).toContain('add column accepting_members boolean not null default true')
    expect(migration).toContain('jams_public_area_required_when_public')
    expect(migration).not.toMatch(/set\s+public_area\s*=\s*(?:location|location_address)/i)
  })

  it('keeps existing member-only table access closed to non-members', () => {
    expect(migration).not.toMatch(/drop policy "Members read (?:jams|songs|membership)"/i)
    expect(migration).not.toMatch(/grant select on table public\.(?:jams|songs|jam_members|profiles|profile_instruments|jam_invites)/i)
    expect(migration).toContain('revoke all on table public.jam_wanted_instruments from public, anon, authenticated')
    expect(migration).toContain('revoke all on table public.jam_join_requests from public, anon, authenticated')
  })

  it('allows only members to read wanted instruments and only managers to change them', () => {
    expect(migration).toContain('using (private.is_jam_member(jam_id))')
    expect(migration).toContain('with check (private.can_manage_jam(jam_id))')
    expect(migration).toContain('using (private.can_manage_jam(jam_id))')
  })

  it('exposes only the requester own join request directly', () => {
    expect(migration).toMatch(/create policy "Requesters read own join request"[\s\S]*using \(requester_id = auth\.uid\(\)\)/)
    expect(migration).toContain('grant select (id, jam_id, requester_id, status, created_at, updated_at, decided_at)')
    expect(migration).not.toMatch(/grant select \([^)]*decided_by[^)]*\)/i)
    expect(migration).not.toMatch(/create policy[\s\S]{0,100}jam_join_requests[\s\S]{0,100}for (?:insert|update|delete)/i)
  })

  it('keeps Discover authenticated-only and hardens every exposed RPC', () => {
    for (const name of ['discover_jams', 'get_public_jam', 'request_to_join_jam', 'list_jam_join_requests', 'accept_jam_join_request', 'reject_jam_join_request', 'set_jam_wanted_instruments']) {
      expect(functionSql(name)).toContain("security definer\nset search_path = ''")
      expect(migration).toContain(`revoke all on function public.${name}`)
      expect(migration).toContain(`grant execute on function public.${name}`)
    }
    expect(migration).not.toMatch(/grant execute on function public\.(?:discover_jams|get_public_jam|request_to_join_jam).* to anon/i)
  })

  it('filters public, future jams and searches public_area case-insensitively with capped pagination', () => {
    const sql = paginationFixMigration
    expect(sql).toContain("jam.visibility = 'public'::public.jam_visibility")
    expect(sql).toContain('jam.starts_at > pg_catalog.now()')
    expect(sql).toContain('pg_catalog.lower(jam.public_area) like')
    expect(sql).toContain('GREATEST(1, LEAST(page_limit, 30))')
    expect(sql).not.toMatch(/pg_catalog\.(?:greatest|least)\s*\(/i)
    expect(sql).toContain('pg_catalog.char_length(normalized_search) < 2')
    expect(sql).toContain('order by jam.starts_at asc')
  })

  it('returns no private location, address, invite, identities, assignments or preparation in Discover RPCs', () => {
    for (const sql of [functionSql('discover_jams'), functionSql('get_public_jam')]) {
      expect(sql).not.toMatch(/location_address|jam_invites|invite\.token|auth\.users|role_assignments|song_preparation|profile\.display_name/i)
    }
    const detail = functionSql('get_public_jam')
    expect(detail).toContain("'title', song.title")
    expect(detail).toContain("'artist', song.artist")
    expect(detail).toContain("'roles'")
    expect(detail).not.toMatch(/proposer_id|listening_url|assigned_by/i)
  })

  it('allows closed public jams to remain visible while request creation checks accepting_members', () => {
    expect(functionSql('discover_jams')).not.toContain('jam.accepting_members = true')
    expect(functionSql('request_to_join_jam')).toContain('if not target_jam.accepting_members')
  })

  it('serializes request creation and supports rejected to pending without duplicate rows', () => {
    const sql = functionSql('request_to_join_jam')
    expect(migration).toContain('unique (jam_id, requester_id)')
    expect(sql).toContain('for update')
    expect(sql).toContain("existing_request.status in ('pending', 'accepted')")
    expect(sql).toContain("set status = 'pending'::public.jam_join_request_status")
    expect(sql).toContain('when unique_violation')
    expect(sql).toContain('private.is_jam_member(target_jam_id, actor_id)')
  })

  it('accepts and rejects only pending requests through manager-checked atomic RPCs', () => {
    const accept = functionSql('accept_jam_join_request')
    const reject = functionSql('reject_jam_join_request')
    for (const sql of [accept, reject]) {
      expect(sql).toContain('for update')
      expect(sql).toContain('private.can_manage_jam(target_request.jam_id, actor_id)')
      expect(sql).toContain("target_request.status <> 'pending'")
    }
    expect(accept).toContain("'musician'::public.jam_member_role")
    expect(accept).toContain('on conflict (jam_id, user_id) do nothing')
    expect(accept).toContain("set status = 'accepted'")
    expect(reject).not.toContain('insert into public.jam_members')
    expect(reject).toContain("set status = 'rejected'")
  })

  it('revokes link tokens, creates a fresh token on entering link and rejects pending requests on leaving public', () => {
    const trigger = migration.slice(migration.indexOf('create function private.sync_jam_visibility'), migration.indexOf('create trigger sync_jam_visibility_before_update'))
    expect(trigger).toContain("old.visibility = 'link'")
    expect(trigger).toContain('set revoked_at = pg_catalog.now()')
    expect(trigger).toContain("new.visibility = 'link'")
    expect(trigger).toContain('public.make_invite_token()')
    expect(trigger).toContain("old.visibility = 'public'")
    expect(trigger).toContain("set status = 'rejected'")
    expect(trigger).not.toMatch(/delete from public\.jam_members/i)
  })

  it('rejects old invite tokens unless the jam is still link-visible', () => {
    expect(functionSql('accept_jam_invite')).toContain("jam.visibility = 'link'::public.jam_visibility")
    const previewStart = migration.indexOf('create or replace function public.get_jam_invite_preview')
    const previewEnd = migration.indexOf('\n$$;', previewStart)
    expect(migration.slice(previewStart, previewEnd)).toContain("jam.visibility = 'link'::public.jam_visibility")
  })

  it('does not modify the push engine', () => {
    expect(migration).not.toMatch(/push_events|push_deliveries|dispatch_push|pg_cron|pg_net/i)
  })
})
