import { STORAGE_KEYS } from '../config/brand'

export type Language = 'it' | 'en'

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface BrowserLanguageLike {
  languages?: readonly string[]
  language?: string
}

interface DocumentElementLike {
  lang: string
}

export function isLanguage(value: unknown): value is Language {
  return value === 'it' || value === 'en'
}

export function detectBrowserLanguage(browser: BrowserLanguageLike): Language {
  const preferred = browser.languages?.find(Boolean) ?? browser.language ?? ''
  return /^it(?:-|$)/i.test(preferred) ? 'it' : 'en'
}

export function resolveInitialLanguage(storage: StorageLike, browser: BrowserLanguageLike): Language {
  try {
    const saved = storage.getItem(STORAGE_KEYS.language)
    if (isLanguage(saved)) return saved
  } catch {
    // Browser privacy settings can make localStorage unavailable.
  }
  return detectBrowserLanguage(browser)
}

export function persistAndApplyLanguage(language: Language, storage: StorageLike, documentElement: DocumentElementLike) {
  try {
    storage.setItem(STORAGE_KEYS.language, language)
  } catch {
    // The in-memory preference still works for the current session.
  }
  documentElement.lang = language
}
