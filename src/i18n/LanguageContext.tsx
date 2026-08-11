import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { persistAndApplyLanguage, resolveInitialLanguage, type Language } from './language'
import { translations, type TranslationKey, type TranslationParams } from './translations'

export type Translate = (key: TranslationKey, params?: TranslationParams) => string

interface LanguageContextValue {
  language: Language
  locale: 'it-IT' | 'en-GB'
  setLanguage: (language: Language) => void
  t: Translate
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function translate(language: Language, key: TranslationKey, params: TranslationParams = {}): string {
  return translations[language][key].replace(/\{(\w+)\}/g, (match, name: string) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  ))
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => resolveInitialLanguage(window.localStorage, window.navigator))

  useEffect(() => {
    persistAndApplyLanguage(language, window.localStorage, document.documentElement)
  }, [language])

  const setLanguage = useCallback((nextLanguage: Language) => {
    persistAndApplyLanguage(nextLanguage, window.localStorage, document.documentElement)
    setLanguageState(nextLanguage)
  }, [])
  const t = useCallback<Translate>((key, params) => translate(language, key, params), [language])
  const value = useMemo<LanguageContextValue>(() => ({
    language,
    locale: language === 'it' ? 'it-IT' : 'en-GB',
    setLanguage,
    t,
  }), [language, setLanguage, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useI18n() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useI18n must be used inside LanguageProvider')
  return context
}
