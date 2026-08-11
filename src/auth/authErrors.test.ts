import { describe, expect, it } from 'vitest'
import { getAuthErrorKey, getPasswordUpdateErrorKey } from './authErrors'

describe('getAuthErrorMessage', () => {
  it('maps invalid credentials', () => {
    expect(getAuthErrorKey({ code: 'invalid_credentials' }, 'login')).toBe('auth.error.invalidCredentials')
  })

  it('maps an existing account', () => {
    expect(getAuthErrorKey({ message: 'User already registered' }, 'signup')).toBe('auth.error.emailRegistered')
  })

  it('maps weak passwords', () => {
    expect(getAuthErrorKey({ code: 'weak_password' }, 'signup')).toBe('auth.error.passwordTooShort')
  })

  it('uses action-specific generic messages', () => {
    expect(getAuthErrorKey({}, 'login')).toBe('auth.error.login')
    expect(getAuthErrorKey({}, 'signup')).toBe('auth.error.signup')
  })
})

describe('getPasswordUpdateErrorMessage', () => {
  it('maps a server-side password length requirement', () => {
    expect(getPasswordUpdateErrorKey({ code: 'weak_password' })).toBe('auth.error.passwordMinimum')
  })

  it('maps reuse of the current password', () => {
    expect(getPasswordUpdateErrorKey({ code: 'same_password' })).toBe('auth.error.passwordSame')
  })

  it('does not expose unknown technical errors', () => {
    expect(getPasswordUpdateErrorKey({ message: 'Internal auth service failure' })).toBe('auth.error.passwordUpdate')
  })
})
