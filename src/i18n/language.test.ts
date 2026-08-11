import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '../config/brand'
import { detectBrowserLanguage, persistAndApplyLanguage, resolveInitialLanguage } from './language'

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    value: (key: string) => values.get(key),
  }
}

describe('language selection', () => {
  it('detects Italian from it', () => {
    expect(detectBrowserLanguage({ languages: ['it'] })).toBe('it')
  })

  it('detects Italian from it-IT', () => {
    expect(detectBrowserLanguage({ languages: ['it-IT', 'en-US'] })).toBe('it')
  })

  it('falls back to English for every other language', () => {
    expect(detectBrowserLanguage({ languages: ['fr-FR'], language: 'it-IT' })).toBe('en')
    expect(detectBrowserLanguage({})).toBe('en')
  })

  it('gives a saved preference precedence over the browser', () => {
    expect(resolveInitialLanguage(storage({ [STORAGE_KEYS.language]: 'en' }), { languages: ['it-IT'] })).toBe('en')
    expect(resolveInitialLanguage(storage({ [STORAGE_KEYS.language]: 'it' }), { languages: ['en-US'] })).toBe('it')
  })

  it('persists a language change and updates the HTML lang value', () => {
    const localStorage = storage()
    const documentElement = { lang: 'it' }
    persistAndApplyLanguage('en', localStorage, documentElement)
    expect(localStorage.value(STORAGE_KEYS.language)).toBe('en')
    expect(documentElement.lang).toBe('en')
  })
})
