import type { DiscoverJamSummary, JoinRequestStatus, PublicJamDetail, PublicJamSong } from './types'

export type DiscoverJamRow = {
  jam_id: string
  name: string
  starts_at: string
  public_area: string
  accepting_members: boolean
  participant_count: number | string
  song_count: number | string
  wanted_instruments: string[] | null
  request_status: string | null
  distance_meters?: number | string
}

export type PublicJamRow = DiscoverJamRow & { public_songs: unknown }

function joinRequestStatus(value: string | null): JoinRequestStatus | null {
  return value === 'pending' || value === 'accepted' || value === 'rejected' ? value : null
}

export function mapDiscoverJamRow(row: DiscoverJamRow): DiscoverJamSummary {
  return {
    jamId: row.jam_id,
    name: row.name,
    startsAt: row.starts_at,
    publicArea: row.public_area,
    acceptingMembers: row.accepting_members,
    participantCount: Number(row.participant_count),
    songCount: Number(row.song_count),
    wantedInstruments: row.wanted_instruments ?? [],
    requestStatus: joinRequestStatus(row.request_status),
    distanceMeters: Number(row.distance_meters ?? 0),
  }
}

function publicSongs(value: unknown): PublicJamSong[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    if (typeof record.title !== 'string' || typeof record.artist !== 'string') return []
    return [{
      title: record.title,
      artist: record.artist,
      roles: Array.isArray(record.roles) ? record.roles.filter((role): role is string => typeof role === 'string') : [],
    }]
  })
}

export function mapPublicJamRow(row: PublicJamRow): PublicJamDetail {
  return { ...mapDiscoverJamRow(row), songs: publicSongs(row.public_songs) }
}
