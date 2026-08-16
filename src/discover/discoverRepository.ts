import { supabase } from '../lib/supabase'
import type { DiscoverJamSummary, JamJoinRequest, PublicJamDetail } from './types'
import { mapDiscoverJamRow, mapPublicJamRow, type DiscoverJamRow, type PublicJamRow } from './discoverMappers'

type JoinRequestRow = { request_id: string; display_name: string; instruments: string[] | null; created_at: string }

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export const discoverRepository = {
  async search(searchText: string, page = 0): Promise<DiscoverJamSummary[]> {
    const { data, error } = await requireClient().rpc('discover_jams', {
      search_text: searchText.trim(),
      page_offset: Math.max(0, page) * 30,
      page_limit: 30,
    })
    if (error) throw error
    return ((data ?? []) as DiscoverJamRow[]).map(mapDiscoverJamRow)
  },

  async getPublicJam(jamId: string): Promise<PublicJamDetail | null> {
    const { data, error } = await requireClient().rpc('get_public_jam', { target_jam_id: jamId })
    if (error) throw error
    const row = ((data ?? []) as PublicJamRow[])[0]
    return row ? mapPublicJamRow(row) : null
  },

  async requestToJoin(jamId: string): Promise<string> {
    const { data, error } = await requireClient().rpc('request_to_join_jam', { target_jam_id: jamId })
    if (error) throw error
    return data as string
  },

  async listJoinRequests(jamId: string): Promise<JamJoinRequest[]> {
    const { data, error } = await requireClient().rpc('list_jam_join_requests', { target_jam_id: jamId })
    if (error) throw error
    return ((data ?? []) as JoinRequestRow[]).map((row) => ({
      requestId: row.request_id,
      displayName: row.display_name,
      instruments: row.instruments ?? [],
      createdAt: row.created_at,
    }))
  },

  async acceptRequest(requestId: string): Promise<string> {
    const { data, error } = await requireClient().rpc('accept_jam_join_request', { target_request_id: requestId })
    if (error) throw error
    return data as string
  },

  async rejectRequest(requestId: string): Promise<string> {
    const { data, error } = await requireClient().rpc('reject_jam_join_request', { target_request_id: requestId })
    if (error) throw error
    return data as string
  },
}
