import type { AuthError } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { AppleAuthenticationScope, signInAsync } from 'expo-apple-authentication';
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { parseOAuthTokensFromUrl } from '@/features/auth/auth-deep-link';
import { isOrphanedProfileError } from '@/features/auth/orphaned-profile-error';
import type { Database } from '@/lib/database.types';
import {
  type ProfileUpdateInput,
  profileUpdateSchema,
  toProfileDatabaseUpdate,
} from '@/lib/db/zod/profile.zod';
import { getSupabase } from '@/lib/supabase';
import { reportError } from '@/lib/telemetry';

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
  // Link und Code verwenden denselben One-Time-Token.
  if (
    raw.includes('token has expired or is invalid') ||
    raw.includes('otp_expired') ||
    raw.includes('email link is invalid or has expired')
  ) {
    return 'Der Code ist abgelaufen oder wurde schon benutzt. Fordere einen neuen an.';
  }
  // Netzwerkfehler in eine verständliche Meldung übersetzen.
  if (raw.includes('network request failed') || raw.includes('fetch failed')) {
    return 'Keine Verbindung. Prüfe dein Netz und versuch es noch einmal.';
  }

  return error.message;
}

export async function signInWithOAuthProvider(provider: 'apple' | 'google') {
  const redirectTo = Linking.createURL('/sign-in');
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    return { data, error };
  }

  if (!data.url) {
    return {
      data,
      error: new Error('Der Anmeldedienst hat keine Weiterleitungs-URL geliefert.'),
    };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== 'success') {
    return { data, error: null };
  }

  const tokens = parseOAuthTokensFromUrl(result.url, redirectTo);

  if (!tokens) {
    return {
      data,
      error: new Error('Der OAuth-Callback ist ungültig.'),
    };
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });

  if (sessionError) {
    reportError(sessionError, {
      operation: 'auth.oauth_session',
      error_code: sessionError.code ?? 'oauth_session_failed',
    });
  }

  return {
    data,
    error: sessionError,
  };
}

export async function signUp(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  return { data, error };
}

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
    // Verwaiste Profile nicht erneut laden.
    retry: (failureCount, error) => !isOrphanedProfileError(error) && failureCount < 2,
  });
}

export async function updateProfile(userId: string, input: ProfileUpdateInput) {
  const payload: Database['public']['Tables']['profiles']['Update'] = toProfileDatabaseUpdate(
    profileUpdateSchema.parse(input),
  );

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

export async function signInWithApple() {
  if (Platform.OS !== 'ios') {
    return signInWithOAuthProvider('apple');
  }
  try {
    const rawNonce = randomUUID();
    const hashedNonce = await digestStringAsync(CryptoDigestAlgorithm.SHA256, rawNonce);
    const credential = await signInAsync({
      requestedScopes: [AppleAuthenticationScope.FULL_NAME, AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) {
      return { data: null, error: new Error('Kein Identity-Token von Apple erhalten.') };
    }
    return await getSupabase().auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ERR_REQUEST_CANCELED'
    ) {
      return { data: null, error: null };
    }
    const authError = error instanceof Error ? error : new Error('Apple-Anmeldung fehlgeschlagen.');
    return { data: null, error: authError };
  }
}
