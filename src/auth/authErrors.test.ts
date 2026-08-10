import { describe, expect, it } from 'vitest'
import { getAuthErrorMessage, getPasswordUpdateErrorMessage } from './authErrors'

describe('getAuthErrorMessage', () => {
  it('maps invalid credentials', () => {
    expect(getAuthErrorMessage({ code: 'invalid_credentials' }, 'login')).toBe('Email o password non corretti.')
  })

  it('maps an existing account', () => {
    expect(getAuthErrorMessage({ message: 'User already registered' }, 'signup')).toBe('Questa email è già registrata.')
  })

  it('maps weak passwords', () => {
    expect(getAuthErrorMessage({ code: 'weak_password' }, 'signup')).toBe('La password deve contenere almeno 6 caratteri.')
  })

  it('uses action-specific generic messages', () => {
    expect(getAuthErrorMessage({}, 'login')).toBe('Non è stato possibile effettuare l’accesso. Riprova.')
    expect(getAuthErrorMessage({}, 'signup')).toBe('Non è stato possibile creare l’account. Riprova.')
  })
})

describe('getPasswordUpdateErrorMessage', () => {
  it('maps a server-side password length requirement', () => {
    expect(getPasswordUpdateErrorMessage({ code: 'weak_password' })).toBe('La password non rispetta la lunghezza minima richiesta.')
  })

  it('maps reuse of the current password', () => {
    expect(getPasswordUpdateErrorMessage({ code: 'same_password' })).toBe('Scegli una password diversa da quella attuale.')
  })

  it('does not expose unknown technical errors', () => {
    expect(getPasswordUpdateErrorMessage({ message: 'Internal auth service failure' })).toBe('Non è stato possibile aggiornare la password. Riprova.')
  })
})
