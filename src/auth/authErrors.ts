type AuthAction = 'login' | 'signup'

interface AuthErrorLike {
  code?: string
  message?: string
}

export function getAuthErrorMessage(error: AuthErrorLike, action: AuthAction): string {
  const code = error.code?.toLowerCase() ?? ''
  const message = error.message?.toLowerCase() ?? ''

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'Email o password non corretti.'
  }
  if (
    code === 'user_already_exists'
    || code === 'email_exists'
    || code === 'identity_already_exists'
    || message.includes('already registered')
    || message.includes('already exists')
  ) {
    return 'Questa email è già registrata.'
  }
  if (
    code === 'weak_password'
    || message.includes('password should be at least')
    || message.includes('password must be at least')
  ) {
    return 'La password deve contenere almeno 6 caratteri.'
  }

  return action === 'signup'
    ? 'Non è stato possibile creare l’account. Riprova.'
    : 'Non è stato possibile effettuare l’accesso. Riprova.'
}

export function getPasswordUpdateErrorMessage(error: AuthErrorLike): string {
  const code = error.code?.toLowerCase() ?? ''
  const message = error.message?.toLowerCase() ?? ''

  if (
    code === 'weak_password'
    || message.includes('password should be at least')
    || message.includes('password must be at least')
  ) {
    return 'La password non rispetta la lunghezza minima richiesta.'
  }
  if (code === 'same_password' || message.includes('different from the old password')) {
    return 'Scegli una password diversa da quella attuale.'
  }

  return 'Non è stato possibile aggiornare la password. Riprova.'
}
