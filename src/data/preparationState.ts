import type { AppData, Preparation, PreparationState } from '../domain/types'

export function preparationFor(data: AppData, songId: string, userId: string): Preparation | undefined {
  return data.preparations.find((item) => item.songId === songId && item.userId === userId)
}

export function applyPreparationState(data: AppData, songId: string, userId: string, state: PreparationState): AppData {
  const preparations = data.preparations.filter((item) => !(item.songId === songId && item.userId === userId))
  preparations.push({ songId, userId, state, updatedAt: new Date().toISOString() })
  return { ...data, preparations }
}

export function rollbackPreparationState(
  data: AppData,
  songId: string,
  userId: string,
  failedState: PreparationState,
  previous: Preparation | undefined,
): AppData {
  if (preparationFor(data, songId, userId)?.state !== failedState) return data
  const preparations = data.preparations.filter((item) => !(item.songId === songId && item.userId === userId))
  if (previous) preparations.push(previous)
  return { ...data, preparations }
}
