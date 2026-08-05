import type { AuthError } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import type { ProfileInput } from '@/features/auth/auth-schemas';
import { getSupabase } from '@/lib/supabase';

/**
 * Uebersetzt Supabase-Fehler in Meldungen, die einem Nutzer weiterhelfen.
 *
 * Die Originalmeldungen sind englisch und technisch ("Invalid login
 * credentials", "AuthApiError"). Unuebersetzt landen sie sonst direkt im UI.
 */
export function authErrorMessage(error: AuthError | Error | null): string | null {
  if (!error) return null;

  const raw = error.message.toLowerCase();

  // Bewusst nicht verraten, ob die Adresse existiert. Eine Meldung wie
  // "Unbekannte E-Mail" waere eine Auskunft darueber, wer hier ein Konto hat.
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
  // Netzwerkfehler sind der haeufigste Fall auf dem Handy und verdienen einen
  // Hinweis auf die Ursache statt eines rohen Fetch-Fehlers.
  if (raw.includes('network request failed') || raw.includes('fetch failed')) {
    return 'Keine Verbindung. Prüfe dein Netz und versuch es noch einmal.';
  }

  return error.message;
}

export async function signUp(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  return { error };
}

/**
 * Schickt eine Reset-Mail mit Deep Link zurueck in die App.
 *
 * `fam://` ist das Scheme aus app.json. Der Link muss in der Supabase-Konsole
 * unter "Redirect URLs" freigegeben sein, sonst weist Supabase ihn ab.
 */
export async function requestPasswordReset(email: string) {
  const redirectTo = Linking.createURL('/reset-password');
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo });
  return { error, redirectTo };
}

export async function updatePassword(password: string) {
  const { error } = await getSupabase().auth.updateUser({ password });
  return { error };
}

/**
 * Speichert die Onboarding-Angaben im Profil.
 *
 * Die Profilzeile existiert bereits — der Trigger `on_auth_user_created` legt
 * sie beim Registrieren an (#34). Deshalb `update` und nicht `upsert`.
 */
export async function updateProfile(userId: string, input: ProfileInput) {
  const { error } = await getSupabase()
    .from('profiles')
    .update({
      display_name: input.displayName ?? null,
      birth_date: input.birthDate ?? null,
      sex: input.sex ?? null,
      height_cm: input.heightCm ?? null,
      activity_level: input.activityLevel ?? null,
    })
    .eq('id', userId);

  return { error };
}
