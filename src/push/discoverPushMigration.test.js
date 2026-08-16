import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../supabase/migrations/202608160015_add_discover_push_events.sql', import.meta.url),
  'utf8',
)
const pushEngineMigration = readFileSync(
  new URL('../../supabase/migrations/202608120011_add_automatic_push_events.sql', import.meta.url),
  'utf8',
)

function functionSql(name) {
  const start = migration.indexOf(`create or replace function public.${name}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = migration.indexOf('\n$$;', start)
  return migration.slice(start, end + 4)
}

describe('Discover push event migration', () => {
  it('adds only the two approved event types to the existing outbox', () => {
    expect(migration).toContain("'join_request_created'")
    expect(migration).toContain("'join_request_accepted'")
    expect(migration).not.toMatch(/create table private\.push_(?:events|deliveries)/i)
    expect(migration).not.toMatch(/cron\.schedule|invoke_push_dispatcher|claim_push_deliveries/i)
  })

  it('notifies the organizer and every co-organizer with deduplicated recipients', () => {
    const sql = functionSql('request_to_join_jam')
    expect(sql).toContain("member.role in ('organizer', 'co-organizer')")
    expect(sql).toContain('array_agg(distinct member.user_id)')
    expect(sql).toContain('manager_user_ids')
  })

  it('excludes the requester from their own created-request notification', () => {
    expect(functionSql('request_to_join_jam')).toMatch(/enqueue_push_event\([\s\S]*?'join_request_created',[\s\S]*?actor_id,/)
    expect(pushEngineMigration).toContain('recipient.user_id <> target_actor_user_id')
  })

  it('uses the request id and current pending-cycle timestamp for deduplication', () => {
    const sql = functionSql('request_to_join_jam')
    expect(sql).toContain("'join-request-created:%s:%s'")
    expect(sql).toContain('created_request_id, request_cycle_at')
    expect(sql).toContain('existing_request.id, request_cycle_at')
  })

  it('creates a new cycle when a rejected request returns to pending', () => {
    const sql = functionSql('request_to_join_jam')
    expect(sql).toContain("set status = 'pending'::public.jam_join_request_status")
    expect(sql).toContain('updated_at = pg_catalog.now()')
    expect(sql).toContain('returning request.updated_at into request_cycle_at')
  })

  it('keeps event and delivery retries idempotent', () => {
    expect(pushEngineMigration).toContain('dedupe_key text not null unique')
    expect(pushEngineMigration).toContain('on conflict (dedupe_key) do nothing')
    expect(pushEngineMigration).toContain('unique (event_id, subscription_id)')
  })

  it('notifies only the requester after a real acceptance', () => {
    const sql = functionSql('accept_jam_join_request')
    expect(sql).toContain('array[target_request.requester_id]')
    expect(sql).toContain("'join_request_accepted'")
    expect(sql).toContain("set status = 'accepted'::public.jam_join_request_status")
    expect(sql.indexOf("set status = 'accepted'")).toBeLessThan(sql.indexOf("'join_request_accepted'"))
  })

  it('prevents duplicate acceptance events under concurrent attempts', () => {
    const sql = functionSql('accept_jam_join_request')
    expect(sql).toContain('for update')
    expect(sql).toContain("target_request.status <> 'pending'::public.jam_join_request_status")
    expect(sql).toContain("'join-request-accepted:%s', target_request.id")
  })

  it('does not enqueue push events for rejection and cancels stale pending notifications', () => {
    expect(migration).not.toContain('create or replace function public.reject_jam_join_request')
    expect(migration).not.toContain('sync_jam_visibility')
    expect(migration).toContain('after update of status on public.jam_join_requests')
    expect(migration).toContain("event.event_type = 'join_request_created'")
    expect(migration).toContain("new.status <> 'pending'::public.jam_join_request_status")
    const cancellation = migration.slice(
      migration.indexOf('create function private.cancel_obsolete_join_request_deliveries'),
      migration.indexOf('create trigger cancel_join_request_deliveries_after_status_change'),
    )
    expect(cancellation).not.toContain('enqueue_push_event')
  })

  it('enqueues in the same RPC transaction as pending and accepted state changes', () => {
    expect(functionSql('request_to_join_jam').match(/private\.enqueue_push_event/g)).toHaveLength(2)
    expect(functionSql('accept_jam_join_request').match(/private\.enqueue_push_event/g)).toHaveLength(1)
    expect(migration).not.toMatch(/pg_net|http_post|dispatch-push/i)
  })

  it('uses the approved manager and requester deep links', () => {
    expect(functionSql('request_to_join_jam')).toContain("'/jansession/#/jam/%s/musicians'")
    expect(functionSql('accept_jam_join_request')).toContain("'/jansession/#/jam/%s'")
  })

  it('keeps payloads minimal and free of private data', () => {
    expect(migration).toContain("'jamName', target_jam.name")
    expect(migration).toContain("'requestId', created_request_id")
    expect(migration).toContain("'requesterDisplayName', requester_display_name")
    expect(migration).not.toMatch(/email|location_address|invite_token|raw_user_meta_data|auth\.users/i)
  })

  it('fans out one logical recipient to every active device subscription', () => {
    expect(pushEngineMigration).toContain('join public.push_subscriptions as subscription on subscription.user_id = recipient.user_id')
    expect(pushEngineMigration).toContain('select distinct created_event_id, recipient.user_id, subscription.id')
  })

  it('preserves the existing notification triggers and authenticated-only RPC access', () => {
    expect(migration).not.toMatch(/create (?:or replace )?function private\.push_(?:role|setlist|jam)/i)
    expect(migration).toContain('revoke all on function public.request_to_join_jam(uuid) from public, anon, authenticated')
    expect(migration).toContain('grant execute on function public.request_to_join_jam(uuid) to authenticated')
    expect(migration).toContain('revoke all on function public.accept_jam_join_request(uuid) from public, anon, authenticated')
    expect(migration).toContain('grant execute on function public.accept_jam_join_request(uuid) to authenticated')
  })
})
