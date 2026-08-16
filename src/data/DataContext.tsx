import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createDemoData } from './demoSeed'
import type { AppData, Jam, JamRole, PreparationState, RoleSlot, Song } from '../domain/types'
import { useAuth } from '../auth/AuthGate'
import { loadSupabaseData, remoteMutations, subscribeToCollaborativeChanges } from './supabaseRepository'
import { reportDataError } from './errors'
import { STORAGE_KEYS } from '../config/brand'
import { canDeleteJam, removeJamFromData } from './jamDeletion'
import { canChangeJamMemberRole, canLeaveJam, canRemoveJamMember, changeJamMemberRoleInData, removeJamMemberFromData } from './jamMembership'
import { useI18n } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import { applyPreparationState, preparationFor, rollbackPreparationState } from './preparationState'
import { canAddSongToSetlist } from '../domain/setlistRules'

const STORAGE_KEY = STORAGE_KEYS.demo

interface NewJamInput {
  name: string
  startsAt: string
  location?: string
  locationAddress?: string
  visibility: 'private' | 'link'
}

interface NewSongInput {
  jamId: string
  title: string
  artist: string
  listeningUrl?: string
  roles: { instrument: string; quantity: number }[]
}

interface DataActions {
  setPreparation: (songId: string, state: PreparationState) => void
  claimSlot: (slotId: string) => void
  assignSlot: (slotId: string, userId: string) => void
  leaveSlot: (slotId: string) => void
  removeAssignment: (slotId: string) => void
  toggleVolunteer: (songId: string, instrument: string) => void
  addSong: (input: NewSongInput) => string
  addJam: (input: NewJamInput) => string
  acceptInvite: (inviteCode: string) => string | null
  addToSetlist: (jamId: string, songId: string) => boolean
  removeFromSetlist: (songId: string) => void
  moveSetlist: (songId: string, direction: -1 | 1) => void
  updateProfile: (displayName: string, instruments: string[]) => Promise<boolean>
  updateJam: (jamId: string, changes: Partial<Pick<Jam, 'name' | 'startsAt' | 'location' | 'locationAddress' | 'proposalsOpen' | 'assignmentsOpen'>>) => void
  deleteJam: (jamId: string) => Promise<boolean>
  updateMemberRole: (jamId: string, userId: string, role: JamRole) => Promise<boolean>
  leaveJam: (jamId: string) => Promise<boolean>
  removeMember: (jamId: string, userId: string) => Promise<boolean>
  removeSong: (songId: string) => void
  updateSong: (songId: string, changes: Pick<Song, 'title' | 'artist' | 'listeningUrl'>) => void
  resetDemo: () => void
}

interface DataContextValue {
  data: AppData
  actions: DataActions
  mode: 'demo' | 'supabase'
  loading: boolean
  syncError: string
}

const DataContext = createContext<DataContextValue | null>(null)

function readInitialData(): AppData {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as AppData) : createDemoData()
  } catch {
    return createDemoData()
  }
}

const id = (_prefix: string) => crypto.randomUUID()

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isDemo } = useAuth()
  const { t } = useI18n()
  const [data, setData] = useState<AppData>(readInitialData)
  const [loading, setLoading] = useState(!isDemo)
  const [syncErrorKey, setSyncErrorKey] = useState<TranslationKey | null>(null)

  useEffect(() => {
    if (isDemo) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data, isDemo])

  useEffect(() => {
    if (isDemo || !user) return
    let active = true
    const reload = () => {
      void loadSupabaseData(user.id).then((snapshot) => {
        if (active) { setData(snapshot); setLoading(false); setSyncErrorKey(null) }
      }).catch((error: unknown) => {
        reportDataError('Caricamento dati Supabase non riuscito', error)
        if (active) { setLoading(false); setSyncErrorKey('data.error.load') }
      })
    }
    reload()
    const unsubscribe = subscribeToCollaborativeChanges(reload)
    return () => { active = false; unsubscribe() }
  }, [isDemo, user])

  const update = useCallback((recipe: (current: AppData) => AppData) => setData((current) => recipe(current)), [])
  const runRemote = useCallback(<Result,>(makeWork: () => Promise<Result>, onSuccess?: (result: Result) => void) => {
    if (isDemo) return
    void makeWork().then((result) => onSuccess?.(result)).catch((error: unknown) => {
      reportDataError('Modifica Supabase non salvata', error)
      setSyncErrorKey('data.error.unsaved')
    })
  }, [isDemo])
  const removeMembership = useCallback(async (jamId: string, userId: string) => {
    setSyncErrorKey(null)
    try {
      if (!isDemo) await remoteMutations.removeJamParticipant(jamId, userId)
      update((current) => removeJamMemberFromData(current, jamId, userId))
      return true
    } catch (error: unknown) {
      reportDataError('Aggiornamento partecipanti Supabase non riuscito', error)
      setSyncErrorKey('data.error.membersUpdate')
      return false
    }
  }, [isDemo, update])

  const actions = useMemo<DataActions>(() => ({
    setPreparation(songId, state) {
      const userId = data.currentUserId
      const previous = preparationFor(data, songId, userId)
      update((current) => applyPreparationState(current, songId, userId, state))
      if (!isDemo) {
        void remoteMutations.setPreparation(songId, userId, state).catch((error: unknown) => {
          reportDataError('Preparazione Supabase non salvata', error)
          update((current) => rollbackPreparationState(current, songId, userId, state, previous))
          setSyncErrorKey('data.error.unsaved')
        })
      }
    },
    claimSlot(slotId) {
      runRemote(() => remoteMutations.claimSlot(slotId, data.currentUserId))
      update((current) => {
        const slot = current.slots.find((item) => item.id === slotId)
        const me = current.profiles.find((profile) => profile.id === current.currentUserId)
        const song = slot && current.songs.find((item) => item.id === slot.songId)
        const jam = song && current.jams.find((item) => item.id === song.jamId)
        const manager = jam && current.members.some((member) => member.jamId === jam.id && member.userId === current.currentUserId && member.role !== 'musician')
        if (!slot || !me?.instruments.includes(slot.instrument) || (!jam?.assignmentsOpen && !manager) || current.assignments.some((item) => item.slotId === slotId)) return current
        return { ...current, assignments: [...current.assignments, { slotId, userId: current.currentUserId, assignedBy: current.currentUserId, createdAt: new Date().toISOString() }] }
      })
    },
    assignSlot(slotId, userId) {
      runRemote(() => remoteMutations.assignSlot(slotId, userId, data.currentUserId))
      update((current) => current.assignments.some((item) => item.slotId === slotId) ? current : {
        ...current,
        assignments: [...current.assignments, { slotId, userId, assignedBy: current.currentUserId, createdAt: new Date().toISOString() }],
      })
    },
    leaveSlot(slotId) {
      runRemote(() => remoteMutations.leaveSlot(slotId, data.currentUserId))
      update((current) => ({ ...current, assignments: current.assignments.filter((item) => !(item.slotId === slotId && item.userId === current.currentUserId)) }))
    },
    removeAssignment(slotId) {
      runRemote(() => remoteMutations.removeAssignment(slotId))
      update((current) => ({ ...current, assignments: current.assignments.filter((item) => item.slotId !== slotId) }))
    },
    toggleVolunteer(songId, instrument) {
      const enabling = !data.volunteers.some((item) => item.songId === songId && item.instrument === instrument && item.userId === data.currentUserId)
      runRemote(() => remoteMutations.volunteer(songId, instrument, data.currentUserId, enabling))
      update((current) => {
        const exists = current.volunteers.some((item) => item.songId === songId && item.instrument === instrument && item.userId === current.currentUserId)
        return {
          ...current,
          volunteers: exists
            ? current.volunteers.filter((item) => !(item.songId === songId && item.instrument === instrument && item.userId === current.currentUserId))
            : [...current.volunteers, { songId, instrument, userId: current.currentUserId }],
        }
      })
    },
    addSong(input) {
      const songId = id('song')
      const timestamp = new Date().toISOString()
      const createdSong: Song = { id: songId, jamId: input.jamId, proposerId: data.currentUserId, title: input.title, artist: input.artist, listeningUrl: input.listeningUrl, createdAt: timestamp, updatedAt: timestamp }
      const createdSlots: RoleSlot[] = input.roles.flatMap((role) => Array.from({ length: role.quantity }, (_, index) => ({ id: id('slot'), songId, instrument: role.instrument, position: index + 1 })))
      update((current) => ({ ...current, songs: [...current.songs, createdSong], slots: [...current.slots, ...createdSlots] }))
      runRemote(() => remoteMutations.addSong(createdSong, createdSlots))
      return songId
    },
    addJam(input) {
      const jamId = id('jam')
      const timestamp = new Date().toISOString()
      const createdJam: Jam = { id: jamId, ...input, creatorId: data.currentUserId, proposalsOpen: true, assignmentsOpen: true, inviteCode: isDemo ? Math.random().toString(36).slice(2, 8).toUpperCase() : '', createdAt: timestamp }
      update((current) => ({ ...current, jams: [...current.jams, createdJam], members: [...current.members, { jamId, userId: current.currentUserId, role: 'organizer', joinedAt: timestamp }] }))
      runRemote(() => remoteMutations.addJam(createdJam), (inviteCode) => {
        if (!inviteCode) return
        update((current) => ({ ...current, jams: current.jams.map((jam) => jam.id === jamId ? { ...jam, inviteCode } : jam) }))
      })
      return jamId
    },
    acceptInvite(inviteCode) {
      const jam = data.jams.find((item) => item.inviteCode.toLowerCase() === inviteCode.toLowerCase())
      if (!jam) return null
      runRemote(() => remoteMutations.acceptInvite(inviteCode))
      update((current) => current.members.some((item) => item.jamId === jam.id && item.userId === current.currentUserId)
        ? current
        : { ...current, members: [...current.members, { jamId: jam.id, userId: current.currentUserId, role: 'musician', joinedAt: new Date().toISOString() }] })
      return jam.id
    },
    addToSetlist(jamId, songId) {
      if (!canAddSongToSetlist(data, jamId, songId)) return false
      runRemote(() => remoteMutations.addToSetlist(jamId, songId, data.setlist.filter((item) => item.jamId === jamId).length + 1))
      update((current) => ({ ...current, setlist: [...current.setlist, { id: id('set'), jamId, songId, position: current.setlist.filter((item) => item.jamId === jamId).length + 1, createdAt: new Date().toISOString() }] }))
      return true
    },
    removeFromSetlist(songId) {
      runRemote(() => remoteMutations.removeFromSetlist(songId))
      update((current) => {
        const removed = current.setlist.find((item) => item.songId === songId)
        if (!removed) return current
        const setlist = current.setlist.filter((item) => item.songId !== songId).map((item) => item.jamId === removed.jamId && item.position > removed.position ? { ...item, position: item.position - 1 } : item)
        return { ...current, setlist }
      })
    },
    moveSetlist(songId, direction) {
      runRemote(() => remoteMutations.moveSetlist(songId, direction))
      update((current) => {
        const moving = current.setlist.find((item) => item.songId === songId)
        if (!moving) return current
        const target = current.setlist.find((item) => item.jamId === moving.jamId && item.position === moving.position + direction)
        if (!target) return current
        return { ...current, setlist: current.setlist.map((item) => item.id === moving.id ? { ...item, position: target.position } : item.id === target.id ? { ...item, position: moving.position } : item) }
      })
    },
    async updateProfile(displayName, instruments) {
      setSyncErrorKey(null)
      try {
        if (!isDemo) await remoteMutations.updateProfile(data.currentUserId, displayName, instruments)
        update((current) => ({ ...current, profiles: current.profiles.map((profile) => profile.id === current.currentUserId ? { ...profile, displayName, instruments, onboarded: true } : profile) }))
        return true
      } catch (error: unknown) {
        reportDataError('Aggiornamento profilo Supabase non riuscito', error)
        setSyncErrorKey('data.error.profileUpdate')
        return false
      }
    },
    updateJam(jamId, changes) {
      runRemote(() => remoteMutations.updateJam(jamId, changes))
      update((current) => ({ ...current, jams: current.jams.map((jam) => jam.id === jamId ? { ...jam, ...changes } : jam) }))
    },
    async deleteJam(jamId) {
      const jam = data.jams.find((item) => item.id === jamId)
      if (!canDeleteJam(jam, data.currentUserId)) {
        setSyncErrorKey('data.error.ownerDeleteOnly')
        return false
      }
      setSyncErrorKey(null)
      try {
        if (!isDemo) await remoteMutations.deleteJam(jamId)
        update((current) => removeJamFromData(current, jamId))
        return true
      } catch (error: unknown) {
        reportDataError('Eliminazione jam Supabase non riuscita', error)
        setSyncErrorKey('data.error.deleteJam')
        return false
      }
    },
    async updateMemberRole(jamId, userId, role) {
      if (!canChangeJamMemberRole(data, jamId, data.currentUserId, userId, role)) {
        setSyncErrorKey('data.error.ownerRoleOnly')
        return false
      }
      setSyncErrorKey(null)
      try {
        if (!isDemo) await remoteMutations.updateMemberRole(jamId, userId, role)
        update((current) => changeJamMemberRoleInData(current, jamId, userId, role))
        return true
      } catch (error: unknown) {
        reportDataError('Modifica ruolo Supabase non riuscita', error)
        setSyncErrorKey('data.error.roleUpdate')
        return false
      }
    },
    async leaveJam(jamId) {
      if (!canLeaveJam(data, jamId)) {
        setSyncErrorKey('data.error.ownerCannotLeave')
        return false
      }
      return removeMembership(jamId, data.currentUserId)
    },
    async removeMember(jamId, userId) {
      if (!canRemoveJamMember(data, jamId, data.currentUserId, userId)) {
        setSyncErrorKey('data.error.ownerRemoveOnly')
        return false
      }
      return removeMembership(jamId, userId)
    },
    removeSong(songId) {
      runRemote(() => remoteMutations.removeSong(songId))
      update((current) => {
        const slotIds = new Set(current.slots.filter((slot) => slot.songId === songId).map((slot) => slot.id))
        return {
          ...current,
          songs: current.songs.filter((song) => song.id !== songId),
          slots: current.slots.filter((slot) => slot.songId !== songId),
          assignments: current.assignments.filter((assignment) => !slotIds.has(assignment.slotId)),
          volunteers: current.volunteers.filter((item) => item.songId !== songId),
          preparations: current.preparations.filter((item) => item.songId !== songId),
          setlist: current.setlist.filter((item) => item.songId !== songId),
        }
      })
    },
    updateSong(songId, changes) {
      runRemote(() => remoteMutations.updateSong(songId, changes))
      update((current) => ({ ...current, songs: current.songs.map((song) => song.id === songId ? { ...song, ...changes, updatedAt: new Date().toISOString() } : song) }))
    },
    resetDemo() {
      if (isDemo) setData(createDemoData())
    },
  }), [data, isDemo, removeMembership, runRemote, update])

  return <DataContext.Provider value={{ data, actions, mode: isDemo ? 'demo' : 'supabase', loading, syncError: syncErrorKey ? t(syncErrorKey) : '' }}>{children}</DataContext.Provider>
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used inside DataProvider')
  return context
}
