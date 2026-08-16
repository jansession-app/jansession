export type PushLocale = 'it' | 'en'

export type PushEventType =
  | 'role_assigned'
  | 'role_removed'
  | 'setlist_added'
  | 'setlist_removed'
  | 'jam_updated'
  | 'jam_reminder'
  | 'song_incomplete'
  | 'join_request_created'
  | 'join_request_accepted'

export interface PushEventDelivery {
  eventId: string
  eventType: PushEventType
  payload: Record<string, unknown>
  targetPath: string
  locale: PushLocale
  timezone?: string | null
}

export interface PushPayload {
  title: 'JanSession'
  body: string
  url: string
  tag: string
}

const instrumentLabels: Record<string, { it: string; en: string }> = {
  Voce: { it: 'Voce', en: 'Vocals' },
  Chitarra: { it: 'Chitarra', en: 'Guitar' },
  Basso: { it: 'Basso', en: 'Bass' },
  Batteria: { it: 'Batteria', en: 'Drums' },
  Tastiere: { it: 'Tastiere', en: 'Keys' },
  Percussioni: { it: 'Percussioni', en: 'Percussion' },
}

function text(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  return typeof value === 'string' ? value : ''
}

function bool(payload: Record<string, unknown>, key: string) {
  return payload[key] === true
}

function instrumentLabel(instrument: string, locale: PushLocale) {
  return instrumentLabels[instrument]?.[locale] ?? instrument
}

export function validTimeZone(timezone?: string | null) {
  if (!timezone) return 'UTC'
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format()
    return timezone
  } catch {
    return 'UTC'
  }
}

function intlLocale(locale: PushLocale) {
  return locale === 'it' ? 'it-IT' : 'en-US'
}

export function formatPushTime(value: string, locale: PushLocale, timezone?: string | null) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: validTimeZone(timezone),
  }).format(new Date(value))
}

function localDateKey(value: string, locale: PushLocale, timezone?: string | null) {
  const parts = new Intl.DateTimeFormat(intlLocale(locale), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: validTimeZone(timezone),
  }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function formatPushDateTime(value: string, locale: PushLocale, timezone?: string | null) {
  const date = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: validTimeZone(timezone),
  }).format(new Date(value))
  const normalizedDate = date.charAt(0).toUpperCase() + date.slice(1)
  return `${normalizedDate} · ${formatPushTime(value, locale, timezone)}`
}

function jamUpdateBody(delivery: PushEventDelivery) {
  const { locale, payload, timezone } = delivery
  const startsAtChanged = bool(payload, 'startsAtChanged')
  const locationChanged = bool(payload, 'locationChanged')
  const addressChanged = bool(payload, 'addressChanged')
  const changedFields = [startsAtChanged, locationChanged, addressChanged].filter(Boolean).length
  const startsAt = text(payload, 'startsAt')
  const oldStartsAt = text(payload, 'oldStartsAt')
  const location = text(payload, 'location')

  if (changedFields === 1 && startsAtChanged && startsAt) {
    const sameDate = oldStartsAt && localDateKey(oldStartsAt, locale, timezone) === localDateKey(startsAt, locale, timezone)
    if (sameDate) {
      return locale === 'it'
        ? `La jam è stata spostata alle ${formatPushTime(startsAt, locale, timezone)}.`
        : `The jam has been moved to ${formatPushTime(startsAt, locale, timezone)}.`
    }
    return locale === 'it'
      ? `La jam è stata riprogrammata: ${formatPushDateTime(startsAt, locale, timezone)}.`
      : `The jam has been rescheduled: ${formatPushDateTime(startsAt, locale, timezone)}.`
  }

  if (changedFields === 1 && locationChanged && location) {
    return locale === 'it'
      ? `Il luogo della jam è cambiato: ${location}.`
      : `The jam location changed: ${location}.`
  }

  if (changedFields === 1 && addressChanged) {
    return locale === 'it' ? 'L’indirizzo della jam è cambiato.' : 'The jam address changed.'
  }

  return locale === 'it'
    ? 'Sono cambiati data, ora o luogo della jam.'
    : 'The jam date, time or location changed.'
}

export function createPushPayload(delivery: PushEventDelivery): PushPayload {
  const { eventType, locale, payload, targetPath, timezone } = delivery
  const songTitle = text(payload, 'songTitle')
  const instrument = instrumentLabel(text(payload, 'instrument'), locale)
  let body: string

  switch (eventType) {
    case 'role_assigned':
      body = locale === 'it'
        ? `Sei stato assegnato a ${instrument} in “${songTitle}”.`
        : `You've been assigned to ${instrument} in “${songTitle}”.`
      break
    case 'role_removed':
      body = locale === 'it'
        ? `Non sei più assegnato a ${instrument} in “${songTitle}”.`
        : `You're no longer assigned to ${instrument} in “${songTitle}”.`
      break
    case 'setlist_added':
      body = locale === 'it' ? `“${songTitle}” è stata aggiunta alla scaletta.` : `“${songTitle}” was added to the setlist.`
      break
    case 'setlist_removed':
      body = locale === 'it' ? `“${songTitle}” è stata rimossa dalla scaletta.` : `“${songTitle}” was removed from the setlist.`
      break
    case 'jam_updated':
      body = jamUpdateBody(delivery)
      break
    case 'jam_reminder': {
      const startsAt = text(payload, 'startsAt')
      const location = text(payload, 'location')
      const time = formatPushTime(startsAt, locale, timezone)
      body = locale === 'it'
        ? `Domani alle ${time}: ${location ? `Jam da ${location}` : 'JanSession'}.`
        : `Tomorrow at ${time}: ${location ? `Jam at ${location}` : 'JanSession'}.`
      break
    }
    case 'song_incomplete':
      body = locale === 'it'
        ? `“${songTitle}” non è più completa: manca ${instrument}.`
        : `“${songTitle}” is no longer complete: ${instrument} is missing.`
      break
    case 'join_request_created': {
      const jamName = text(payload, 'jamName')
      const requesterDisplayName = text(payload, 'requesterDisplayName')
      body = locale === 'it'
        ? `${requesterDisplayName} ha chiesto di partecipare a “${jamName}”.`
        : `${requesterDisplayName} requested to join “${jamName}”.`
      break
    }
    case 'join_request_accepted': {
      const jamName = text(payload, 'jamName')
      body = locale === 'it'
        ? `La tua richiesta per “${jamName}” è stata accettata.`
        : `Your request to join “${jamName}” was accepted.`
      break
    }
  }

  return {
    title: 'JanSession',
    body,
    url: targetPath,
    tag: `jansession:${delivery.eventId}`,
  }
}
