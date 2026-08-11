import type { AuthError } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';

import type { ProfileInput } from '@/features/auth/auth-schemas';
import { isOrphanedProfileError } from '@/features/auth/orphaned-profile-error';
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
  // Bestaetigungscode und Bestaetigungslink teilen sich denselben One-Time-Token.
  // Wer den Link geklickt hat, entwertet damit auch den Code — und umgekehrt.
  // Beide Faelle melden dasselbe, weil sie fuer den Nutzer dasselbe bedeuten.
  if (
    raw.includes('token has expired or is invalid') ||
    raw.includes('otp_expired') ||
    raw.includes('email link is invalid or has expired')
  ) {
    return 'Der Code ist abgelaufen oder wurde schon benutzt. Fordere einen neuen an.';
  }
  // Netzwerkfehler sind der haeufigste Fall auf dem Handy und verdienen einen
  // Hinweis auf die Ursache statt eines rohen Fetch-Fehlers.
  if (raw.includes('network request failed') || raw.includes('fetch failed')) {
    return 'Keine Verbindung. Prüfe dein Netz und versuch es noch einmal.';
  }

  return error.message;
}

export async function signInWithOAuthProvider(provider: 'apple' | 'google') {
  const redirectTo = Linking.createURL('/(app)');
  const { data, error } = await getSupabase().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
    },
  });
  return { data, error };
}

/**
 * Registrierung. **Bewusst ohne `emailRedirectTo`** — der Bestaetigungslink
 * fuehrt nicht in die App zurueck.
 *
 * Ein `fam://`-Deep-Link als Redirect-Ziel war genau die Ursache des Problems:
 * Er reicht die Session ueber das URL-Fragment eines One-Time-Tokens zurueck.
 * Verpasst die App diesen einen Versuch — Kaltstart-Race, Browser-Preload, oder
 * schlicht weil die Mail auf einem anderen Geraet geoeffnet wurde —, ist der
 * Token verbrannt und jeder weitere Klick meldet "Email link is invalid or has
 * expired". Auf einem Rechner ohne installierte App liess sich das Scheme
 * ohnehin nie aufloesen.
 *
 * Ohne Redirect hat der Link nur noch eine Aufgabe: serverseitig
 * `email_confirmed_at` zu setzen. Das gelingt aus **jedem** Browser und von
 * jedem Geraet aus. Dass die App davon erfaehrt, ist ihre eigene Sache —
 * `PendingAuthBanner` fragt den Server aktiv, und der 6-stellige Code aus
 * derselben Mail (`confirmSignUpWithCode`) ist der direkte Weg.
 */
export async function signUp(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  return { data, error };
}

/**
 * Loest den 6-stelligen Code aus der Bestaetigungsmail ein.
 *
 * Der verlaessliche Bestaetigungsweg: er braucht weder Browser noch Deep Link
 * noch registriertes URL-Scheme und funktioniert damit von jedem Geraet und
 * jedem Mailclient aus. Bei Erfolg liefert `verifyOtp` direkt eine Session —
 * der `onAuthStateChange`-Listener im PendingAuthBanner feuert dadurch von
 * selbst, ein zusaetzliches `setSession` waere doppelt.
 *
 * Der Aufrufer validiert den Code vorher mit `confirmationCodeSchema`.
 */
export async function confirmSignUpWithCode(email: string, token: string) {
  const { data, error } = await getSupabase().auth.verifyOtp({
    email,
    token,
    type: 'signup',
  });
  return { data, error };
}

export async function resendConfirmationEmail(email: string) {
  const { error } = await getSupabase().auth.resend({ type: 'signup', email });
  return { error };
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
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await getSupabase()
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(userId),
    // PGRST116 (verwaiste Session, siehe orphaned-session.ts) ist
    // deterministisch — ein Retry aendert das Ergebnis nie, verzoegert nur
    // die automatische Abmeldung.
    retry: (failureCount, error) => !isOrphanedProfileError(error) && failureCount < 2,
  });
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
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', userId);

  return { error };
}

export async function markOnboardingCompleted(userId: string) {
  const { error } = await getSupabase()
    .from('profiles')
    .update({
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', userId);

  return { error };
}
