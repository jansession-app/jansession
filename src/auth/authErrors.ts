type AuthAction = 'login' | 'signup'
import type { TranslationKey } from '../i18n/translations'

interface AuthErrorLike {
  code?: string
  message?: string
}

export function getAuthErrorKey(error: AuthErrorLike, action: AuthAction): TranslationKey {
  const code = error.code?.toLowerCase() ?? ''
  const message = error.message?.toLowerCase() ?? ''

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'auth.error.invalidCredentials'
  }
  if (
    code === 'user_already_exists'
    || code === 'email_exists'
    || code === 'identity_already_exists'
    || message.includes('already registered')
    || message.includes('already exists')
  ) {
    return 'auth.error.emailRegistered'
  }
  if (
    code === 'weak_password'
    || message.includes('password should be at least')
    || message.includes('password must be at least')
  ) {
    return 'auth.error.passwordTooShort'
  }

  return action === 'signup'
    ? 'auth.error.signup'
    : 'auth.error.login'
}

export function getPasswordUpdateErrorKey(error: AuthErrorLike): TranslationKey {
  const code = error.code?.toLowerCase() ?? ''
  const message = error.message?.toLowerCase() ?? ''

  if (
    code === 'weak_password'
    || message.includes('password should be at least')
    || message.includes('password must be at least')
  ) {
    return 'auth.error.passwordMinimum'
  }
  if (code === 'same_password' || message.includes('different from the old password')) {
    return 'auth.error.passwordSame'
  }

  return 'auth.error.passwordUpdate'
}
