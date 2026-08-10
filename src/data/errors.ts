interface DataErrorDetails {
  message: string
  name?: string
  code?: string
  details?: string
  hint?: string
  stack?: string
}

export function getDataErrorDetails(error: unknown): DataErrorDetails {
  if (error instanceof Error) {
    return { message: error.message, name: error.name, stack: error.stack }
  }
  if (typeof error === 'object' && error !== null) {
    const candidate = error as Record<string, unknown>
    return {
      message: typeof candidate.message === 'string' ? candidate.message : 'Errore dati sconosciuto',
      code: typeof candidate.code === 'string' ? candidate.code : undefined,
      details: typeof candidate.details === 'string' ? candidate.details : undefined,
      hint: typeof candidate.hint === 'string' ? candidate.hint : undefined,
    }
  }
  return { message: typeof error === 'string' ? error : 'Errore dati sconosciuto' }
}

export function reportDataError(context: string, error: unknown) {
  console.error(`[JanSession] ${context}`, getDataErrorDetails(error))
}
