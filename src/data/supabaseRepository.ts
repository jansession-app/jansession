import type { RealtimeChannel } from '@supabase/supabase-js'
import type { AppData, Jam, JamMember, Preparation, Profile, RoleSlot, SetlistItem, Song } from '../domain/types'
import { supabase } from '../lib/supabase'
import { readInviteToken, type InviteTokenRelation } from '../invites/inviteFlow'

type ProfileRow = { id: string; display_name: string | null; onboarding_completed: boolean; profile_instruments: { instruments: { name: string } | null }[] }
type JamRow = { id: string; name: string; starts_at: string; location: string | null; creator_id: string; visibility: Jam['visibility']; proposals_open: boolean; assignments_open: boolean; created_at: string; jam_invites: InviteTokenRelation }
type MemberRow = { jam_id: string; user_id: string; role: JamMember['role']; joined_at: string }
type SongRow = { id: string; jam_id: string; proposer_id: string; title: string; artist: string; listening_url: string | null; bpm: number | null; musical_key: string | null; notes: string | null; created_at: string; updated_at: string }
type SlotRow = { id: string; song_id: string; instrument_id: string; position: number; instruments: { name: string } | null }
type AssignmentRow = { slot_id: string; user_id: string; assigned_by: string; created_at: string }
type VolunteerRow = { song_id: string; instrument_id: string; user_id: string; instruments: { name: string } | null }
type PreparationRow = { song_id: string; user_id: string; state: Preparation['state']; updated_at: string }
type SetlistRow = { id: string; jam_id: string; song_id: string; position: number; created_at: string }

function requireClient() {
  if (!supabase) throw new Error('Supabase non è configurato.')
  return supabase
}

export async function loadSupabaseData(currentUserId: string): Promise<AppData> {
  const client = requireClient()
  const [profilesResult, jamsResult, membersResult, songsResult, slotsResult, assignmentsResult, volunteersResult, preparationsResult, setlistResult] = await Promise.all([
    client.from('profiles').select('id, display_name, onboarding_completed, profile_instruments(instruments(name))'),
    client.from('jams').select('id, name, starts_at, location, creator_id, visibility, proposals_open, assignments_open, created_at, jam_invites(token)'),
    client.from('jam_members').select('jam_id, user_id, role, joined_at'),
    client.from('songs').select('*'),
    client.from('song_role_slots').select('id, song_id, instrument_id, position, instruments(name)'),
    client.from('role_assignments').select('*'),
    client.from('role_volunteers').select('song_id, instrument_id, user_id, instruments(name)'),
    client.from('song_preparation').select('*'),
    client.from('setlist_items').select('*'),
  ])
  const firstError = [profilesResult, jamsResult, membersResult, songsResult, slotsResult, assignmentsResult, volunteersResult, preparationsResult, setlistResult].find((result) => result.error)?.error
  if (firstError) throw firstError

  const profiles: Profile[] = (profilesResult.data as unknown as ProfileRow[]).map((row) => ({
    id: row.id, displayName: row.display_name ?? 'Musicista', onboarded: row.onboarding_completed,
    instruments: row.profile_instruments.flatMap((item) => item.instruments?.name ? [item.instruments.name] : []),
  }))
  const jams: Jam[] = (jamsResult.data as unknown as JamRow[]).map((row) => ({
    id: row.id, name: row.name, startsAt: row.starts_at, location: row.location ?? undefined,
    creatorId: row.creator_id, visibility: row.visibility, proposalsOpen: row.proposals_open,
    assignmentsOpen: row.assignments_open, inviteCode: readInviteToken(row.jam_invites), createdAt: row.created_at,
  }))
  const members: JamMember[] = (membersResult.data as MemberRow[]).map((row) => ({ jamId: row.jam_id, userId: row.user_id, role: row.role, joinedAt: row.joined_at }))
  const songs: Song[] = (songsResult.data as SongRow[]).map((row) => ({ id: row.id, jamId: row.jam_id, proposerId: row.proposer_id, title: row.title, artist: row.artist, listeningUrl: row.listening_url ?? undefined, bpm: row.bpm ?? undefined, musicalKey: row.musical_key ?? undefined, notes: row.notes ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at }))
  const slots: RoleSlot[] = (slotsResult.data as unknown as SlotRow[]).map((row) => ({ id: row.id, songId: row.song_id, instrument: row.instruments?.name ?? 'Altro', position: row.position }))
  const assignments = (assignmentsResult.data as AssignmentRow[]).map((row) => ({ slotId: row.slot_id, userId: row.user_id, assignedBy: row.assigned_by, createdAt: row.created_at }))
  const volunteers = (volunteersResult.data as unknown as VolunteerRow[]).map((row) => ({ songId: row.song_id, instrument: row.instruments?.name ?? 'Altro', userId: row.user_id }))
  const preparations: Preparation[] = (preparationsResult.data as PreparationRow[]).map((row) => ({ songId: row.song_id, userId: row.user_id, state: row.state, updatedAt: row.updated_at }))
  const setlist: SetlistItem[] = (setlistResult.data as SetlistRow[]).map((row) => ({ id: row.id, jamId: row.jam_id, songId: row.song_id, position: row.position, createdAt: row.created_at }))
  return { currentUserId, profiles, jams, members, songs, slots, assignments, volunteers, preparations, setlist }
}

export function subscribeToCollaborativeChanges(onChange: () => void): () => void {
  const client = requireClient()
  const tables = ['role_assignments', 'role_volunteers', 'song_preparation', 'jam_members', 'songs', 'song_role_slots', 'setlist_items']
  let channel: RealtimeChannel = client.channel('jansession-collaboration')
  tables.forEach((table) => {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
  })
  void channel.subscribe()
  return () => { void client.removeChannel(channel) }
}

export const remoteMutations = {
  async setPreparation(songId: string, userId: string, state: Preparation['state']) {
    const { error } = await requireClient().from('song_preparation').upsert({ song_id: songId, user_id: userId, state }, { onConflict: 'song_id,user_id' })
    if (error) throw error
  },
  async claimSlot(slotId: string, userId: string) {
    const { error } = await requireClient().from('role_assignments').insert({ slot_id: slotId, user_id: userId, assigned_by: userId })
    if (error) throw error
  },
  async assignSlot(slotId: string, userId: string, assignedBy: string) {
    const { error } = await requireClient().from('role_assignments').insert({ slot_id: slotId, user_id: userId, assigned_by: assignedBy })
    if (error) throw error
  },
  async leaveSlot(slotId: string, userId: string) {
    const { error } = await requireClient().from('role_assignments').delete().eq('slot_id', slotId).eq('user_id', userId)
    if (error) throw error
  },
  async removeAssignment(slotId: string) {
    const { error } = await requireClient().from('role_assignments').delete().eq('slot_id', slotId)
    if (error) throw error
  },
  async volunteer(songId: string, instrumentName: string, userId: string, enabled: boolean) {
    const client = requireClient()
    const { data: instrument, error: instrumentError } = await client.from('instruments').select('id').eq('name', instrumentName).single()
    if (instrumentError) throw instrumentError
    const query = enabled
      ? client.from('role_volunteers').upsert({ song_id: songId, instrument_id: instrument.id, user_id: userId })
      : client.from('role_volunteers').delete().eq('song_id', songId).eq('instrument_id', instrument.id).eq('user_id', userId)
    const { error } = await query
    if (error) throw error
  },
  async updateProfile(userId: string, displayName: string, instrumentNames: string[]) {
    const client = requireClient()
    const { error: profileError } = await client.from('profiles').update({ display_name: displayName, onboarding_completed: true }).eq('id', userId)
    if (profileError) throw profileError
    const { data: instruments, error: instrumentsError } = await client.from('instruments').select('id, name').in('name', instrumentNames)
    if (instrumentsError) throw instrumentsError
    const { error: deleteError } = await client.from('profile_instruments').delete().eq('profile_id', userId)
    if (deleteError) throw deleteError
    if (instruments.length) {
      const { error: insertError } = await client.from('profile_instruments').insert(instruments.map((instrument) => ({ profile_id: userId, instrument_id: instrument.id })))
      if (insertError) throw insertError
    }
  },
  async addSong(song: Song, slots: RoleSlot[]) {
    const client = requireClient()
    const { error: songError } = await client.from('songs').insert({ id: song.id, jam_id: song.jamId, proposer_id: song.proposerId, title: song.title, artist: song.artist, listening_url: song.listeningUrl ?? null })
    if (songError) throw songError
    const instrumentNames = [...new Set(slots.map((slot) => slot.instrument))]
    const { error: upsertError } = await client.from('instruments').upsert(instrumentNames.map((name) => ({ name, is_standard: false })), { onConflict: 'name', ignoreDuplicates: true })
    if (upsertError) throw upsertError
    const { data: instruments, error: instrumentError } = await client.from('instruments').select('id, name').in('name', instrumentNames)
    if (instrumentError) throw instrumentError
    const instrumentByName = new Map(instruments.map((instrument) => [instrument.name, instrument.id]))
    const { error: slotError } = await client.from('song_role_slots').insert(slots.map((slot) => ({ id: slot.id, song_id: slot.songId, instrument_id: instrumentByName.get(slot.instrument), position: slot.position })))
    if (slotError) throw slotError
  },
  async addJam(jam: Jam) {
    const client = requireClient()
    const { error } = await client.from('jams').insert({ id: jam.id, name: jam.name, starts_at: jam.startsAt, location: jam.location ?? null, creator_id: jam.creatorId, visibility: jam.visibility, proposals_open: true, assignments_open: true })
    if (error) throw error
    if (jam.visibility !== 'link') return ''
    const { data, error: inviteError } = await client.from('jam_invites').select('token').eq('jam_id', jam.id).single()
    if (inviteError) throw inviteError
    return data.token
  },
  async acceptInvite(token: string) {
    const { data, error } = await requireClient().rpc('accept_jam_invite', { invite_token: token })
    if (error) throw error
    return data as string
  },
  async addToSetlist(jamId: string, songId: string, position: number) {
    const { error } = await requireClient().from('setlist_items').insert({ jam_id: jamId, song_id: songId, position })
    if (error) throw error
  },
  async removeFromSetlist(songId: string) {
    const { error } = await requireClient().from('setlist_items').delete().eq('song_id', songId)
    if (error) throw error
  },
  async moveSetlist(songId: string, direction: number) {
    const { error } = await requireClient().rpc('move_setlist_item', { target_song_id: songId, direction })
    if (error) throw error
  },
  async updateJam(jamId: string, changes: Partial<Pick<Jam, 'name' | 'startsAt' | 'location' | 'proposalsOpen' | 'assignmentsOpen'>>) {
    const patch: Record<string, string | boolean | null> = {}
    if (changes.name !== undefined) patch.name = changes.name
    if (changes.startsAt !== undefined) patch.starts_at = changes.startsAt
    if ('location' in changes) patch.location = changes.location ?? null
    if (changes.proposalsOpen !== undefined) patch.proposals_open = changes.proposalsOpen
    if (changes.assignmentsOpen !== undefined) patch.assignments_open = changes.assignmentsOpen
    const { error } = await requireClient().from('jams').update(patch).eq('id', jamId)
    if (error) throw error
  },
  async updateMemberRole(jamId: string, userId: string, role: JamMember['role']) {
    const { error } = await requireClient().from('jam_members').update({ role }).eq('jam_id', jamId).eq('user_id', userId)
    if (error) throw error
  },
  async removeMember(jamId: string, userId: string) {
    const { error } = await requireClient().from('jam_members').delete().eq('jam_id', jamId).eq('user_id', userId)
    if (error) throw error
  },
  async removeSong(songId: string) {
    const { error } = await requireClient().from('songs').delete().eq('id', songId)
    if (error) throw error
  },
  async updateSong(songId: string, changes: Pick<Song, 'title' | 'artist' | 'listeningUrl'>) {
    const { error } = await requireClient().from('songs').update({ title: changes.title, artist: changes.artist, listening_url: changes.listeningUrl ?? null }).eq('id', songId)
    if (error) throw error
  },
}
