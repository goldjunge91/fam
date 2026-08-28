import type { AuthError } from '@supabase/supabase-js';

export function authErrorMessage(error: AuthError | Error | null): string | null {
  if (!error) return null;

  const raw = error.message.toLowerCase();

  // Keine kontobezogenen Hinweise ausgeben.
  if (raw.includes('invalid login credentials')) {
    return 'E-Mail oder Passwort stimmt nicht.';
  }
  if (raw.includes('email not confirmed')) {
    return 'Bitte bestätige zuerst deine E-Mail-Adresse. Wir haben dir einen Link geschickt.';
  }
  if (raw.includes('user already registered') || raw.includes('already been registered')) {
    return 'Für diese Adresse gibt es schon ein Konto. Melde dich an oder setze dein Passwort zurück.';
  }
  if (raw.includes('password should be at least')) {
    return 'Das Passwort ist zu kurz.';
  }
  if (raw.includes('email rate limit') || raw.includes('over_email_send_rate_limit')) {
    return 'Zu viele Versuche. Bitte warte einen Moment.';
  }
  if (
    raw.includes('token has expired or is invalid') ||
    raw.includes('otp_expired') ||
    raw.includes('email link is invalid or has expired')
  ) {
    return 'Der Code ist abgelaufen oder wurde schon benutzt. Fordere einen neuen an.';
  }
  if (raw.includes('network request failed') || raw.includes('fetch failed')) {
    return 'Keine Verbindung. Prüfe dein Netz und versuch es noch einmal.';
  }

  return error.message;
}
