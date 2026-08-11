import { describe, expect, it } from 'vitest'
import { PREPARATION_LABEL_KEYS, STATUS_LABEL_KEYS } from '../domain/labels'
import type { PreparationState, SongStatus } from '../domain/types'
import { translate } from './LanguageContext'
import { en, it as italian } from './translations'

describe('translation dictionaries', () => {
  it('contain exactly the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(italian).sort())
  })

  it('changes visible language without changing preparation values', () => {
    const state: PreparationState = 'UNKNOWN'
    expect(translate('it', PREPARATION_LABEL_KEYS[state])).toBe('Non la conosco')
    expect(translate('en', PREPARATION_LABEL_KEYS[state])).toBe('I don’t know it')
    expect(state).toBe('UNKNOWN')
  })

  it('translates every song status without changing its value', () => {
    const expected: Record<SongStatus, [string, string]> = {
      INCOMPLETE: ['Incompleto', 'Incomplete'],
      TO_PREPARE: ['Da preparare', 'To prepare'],
      PLAYABLE: ['Suonabile', 'Playable'],
      READY: ['Pronto', 'Ready'],
    }
    for (const status of Object.keys(expected) as SongStatus[]) {
      expect([translate('it', STATUS_LABEL_KEYS[status]), translate('en', STATUS_LABEL_KEYS[status])]).toEqual(expected[status])
      expect(Object.hasOwn(STATUS_LABEL_KEYS, status)).toBe(true)
    }
  })

  it('interpolates dynamic values centrally', () => {
    expect(translate('en', 'home.greeting', { name: 'Gian' })).toBe('Hi Gian')
  })
})
