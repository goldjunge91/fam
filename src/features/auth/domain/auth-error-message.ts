import type { AuthError } from '@supabase/supabase-js';

export const AUTH_ERROR_KEYS = {
  invalidCredentials: 'auth.errors.invalidCredentials',
  emailNotConfirmed: 'auth.errors.emailNotConfirmed',
  alreadyRegistered: 'auth.errors.alreadyRegistered',
  passwordTooShort: 'auth.errors.passwordTooShort',
  rateLimited: 'auth.errors.rateLimited',
  codeExpired: 'auth.errors.codeExpired',
  network: 'auth.errors.network',
  redirectUrlMissing: 'auth.oauth.redirectUrlMissing',
  callbackInvalid: 'auth.oauth.callbackInvalid',
  appleTokenMissing: 'auth.oauth.appleTokenMissing',
  appleSignInFailed: 'auth.oauth.appleSignInFailed',
} as const;

type AuthErrorKey = (typeof AUTH_ERROR_KEYS)[keyof typeof AUTH_ERROR_KEYS];
type AuthErrorTranslator = (key: AuthErrorKey) => string;

function classifyAuthError(error: AuthError | Error): AuthErrorKey | null {
  for (const key of Object.values(AUTH_ERROR_KEYS)) {
    if (error.message === key) return key;
  }

  const raw = error.message.toLowerCase();

  // Keine kontobezogenen Hinweise ausgeben.
  if (raw.includes('invalid login credentials')) {
    return AUTH_ERROR_KEYS.invalidCredentials;
  }
  if (raw.includes('email not confirmed')) {
    return AUTH_ERROR_KEYS.emailNotConfirmed;
  }
  if (raw.includes('user already registered') || raw.includes('already been registered')) {
    return AUTH_ERROR_KEYS.alreadyRegistered;
  }
  if (raw.includes('password should be at least')) {
    return AUTH_ERROR_KEYS.passwordTooShort;
  }
  if (raw.includes('email rate limit') || raw.includes('over_email_send_rate_limit')) {
    return AUTH_ERROR_KEYS.rateLimited;
  }
  if (
    raw.includes('token has expired or is invalid') ||
    raw.includes('otp_expired') ||
    raw.includes('email link is invalid or has expired')
  ) {
    return AUTH_ERROR_KEYS.codeExpired;
  }
  if (raw.includes('network request failed') || raw.includes('fetch failed')) {
    return AUTH_ERROR_KEYS.network;
  }

  return null;
}

export function authErrorMessage(
  error: AuthError | Error | null,
  translate: AuthErrorTranslator,
): string | null {
  if (!error) return null;

  const key = classifyAuthError(error);
  return key ? translate(key) : error.message;
}
