export { PRODUCT_NAME } from '../config/brand'

export const INSTRUMENTS = ['Voce', 'Chitarra', 'Basso', 'Batteria', 'Tastiere', 'Percussioni'] as const

export type PreparationState = 'UNKNOWN' | 'NEEDS_LISTENING' | 'KNOWS_STRUCTURE' | 'READY'
export type SongStatus = 'INCOMPLETE' | 'TO_PREPARE' | 'PLAYABLE' | 'READY'
export type JamRole = 'organizer' | 'co-organizer' | 'musician'
export type JamVisibility = 'private' | 'link' | 'public'

export interface Profile {
  id: string
  displayName: string
  instruments: string[]
  onboarded: boolean
}

export interface Jam {
  id: string
  name: string
  startsAt: string
  location?: string
  locationAddress?: string
  creatorId: string
  visibility: JamVisibility
  proposalsOpen: boolean
  assignmentsOpen: boolean
  inviteCode: string
  createdAt: string
}

export interface JamMember {
  jamId: string
  userId: string
  role: JamRole
  joinedAt: string
}

export interface Song {
  id: string
  jamId: string
  proposerId: string
  title: string
  artist: string
  listeningUrl?: string
  bpm?: number
  musicalKey?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface RoleSlot {
  id: string
  songId: string
  instrument: string
  position: number
}

export interface Assignment {
  slotId: string
  userId: string
  assignedBy: string
  createdAt: string
}

export interface Volunteer {
  songId: string
  instrument: string
  userId: string
}

export interface Preparation {
  songId: string
  userId: string
  state: PreparationState
  updatedAt: string
}

export interface SetlistItem {
  id: string
  jamId: string
  songId: string
  position: number
  createdAt: string
}

export interface AppData {
  currentUserId: string
  profiles: Profile[]
  jams: Jam[]
  members: JamMember[]
  songs: Song[]
  slots: RoleSlot[]
  assignments: Assignment[]
  volunteers: Volunteer[]
  preparations: Preparation[]
  setlist: SetlistItem[]
}

export interface StatusDetails {
  status: SongStatus
  missingInstruments: string[]
  musiciansToPrepare: string[]
  occupiedSlots: number
  totalSlots: number
}
