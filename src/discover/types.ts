export type JoinRequestStatus = 'pending' | 'accepted' | 'rejected'

export interface DiscoverJamSummary {
  jamId: string
  name: string
  startsAt: string
  publicArea: string
  acceptingMembers: boolean
  participantCount: number
  songCount: number
  wantedInstruments: string[]
  requestStatus: JoinRequestStatus | null
  distanceMeters: number
}

export interface GeocodeCandidate {
  candidateId: string
  displayName: string
}

export interface PublicJamSong {
  title: string
  artist: string
  roles: string[]
}

export interface PublicJamDetail extends DiscoverJamSummary {
  songs: PublicJamSong[]
}

export interface JamJoinRequest {
  requestId: string
  displayName: string
  instruments: string[]
  createdAt: string
}
