import type { AuthError } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';

import type { ProfileInput } from '@/features/auth/auth-schemas';
import { isOrphanedProfileError } from '@/features/auth/orphaned-profile-error';
import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

/** Uebersetzt technische Supabase-Fehler in nutzerfreundliche Meldungen. */
export function authErrorMessage(error: AuthError | Error | null): string | null {
  if (!error) return null;

  const raw = error.message.toLowerCase();

  // Verrät nicht, ob die Adresse registriert ist.
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
  // Code und Link teilen sich denselben One-Time-Token.
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

/** Ohne Redirect bleibt die Bestaetigung unabhaengig von App und Geraet. */
export async function signUp(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  return { data, error };
}

/** Loest den vorab validierten Bestaetigungscode ein. */
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

/** Schickt eine Reset-Mail mit freigegebenem Deep Link zur App. */
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
    // Eine verwaiste Session wird durch einen Retry nicht gueltig.
    retry: (failureCount, error) => !isOrphanedProfileError(error) && failureCount < 2,
  });
}

/** Der Registrierungs-Trigger legt die Profilzeile bereits an. */
export async function updateProfile(userId: string, input: Partial<ProfileInput>) {
  const payload: Database['public']['Tables']['profiles']['Update'] = {};
  if (input.displayName !== undefined) payload.display_name = input.displayName;
  if (input.birthDate !== undefined) payload.birth_date = input.birthDate;
  if (input.sex !== undefined) payload.sex = input.sex;
  if (input.heightCm !== undefined) payload.height_cm = input.heightCm;
  if (input.activityLevel !== undefined) payload.activity_level = input.activityLevel;
  if (input.avatarUrl !== undefined) payload.avatar_url = input.avatarUrl;

  const { error } = await getSupabase().from('profiles').update(payload).eq('id', userId);

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
