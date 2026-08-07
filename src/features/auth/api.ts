import type { AuthError } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
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
  });
}

/**
 * Speichert die Onboarding-Angaben im Profil.
 *
 * Die Profilzeile existiert bereits — der Trigger `on_auth_user_created` legt
 * sie beim Registrieren an (#34). Deshalb `update` und nicht `upsert`.
 */
export async function updateProfile(userId: string, input: ProfileInput) {
  const payload: Record<string, unknown> = {
    display_name: input.displayName ?? null,
    birth_date: input.birthDate ?? null,
    sex: input.sex ?? null,
    height_cm: input.heightCm ?? null,
    activity_level: input.activityLevel ?? null,
    onboarding_completed_at: new Date().toISOString(),
  };

  // biome-ignore lint/suspicious/noExplicitAny: generische Spalten
  let { error } = await getSupabase()
    .from('profiles')
    .update(payload as any)
    .eq('id', userId);

  if (error && error.message.includes('onboarding_completed_at')) {
    delete payload.onboarding_completed_at;
    // biome-ignore lint/suspicious/noExplicitAny: Fallback ohne neu hinzugefuegte Spalte
    const retry = await getSupabase()
      .from('profiles')
      .update(payload as any)
      .eq('id', userId);
    error = retry.error;
  }

  return { error };
}

export async function markOnboardingCompleted(userId: string) {
  // biome-ignore lint/suspicious/noExplicitAny: generische Spalten
  const { error } = await getSupabase()
    .from('profiles')
    .update({
      onboarding_completed_at: new Date().toISOString(),
    } as any)
    .eq('id', userId);

  // Stiller Fallback falls PostgREST den Schema-Cache noch nicht neu geladen hat
  return { error: error?.message.includes('onboarding_completed_at') ? null : error };
}
