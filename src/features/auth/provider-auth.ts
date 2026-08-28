import { AppleAuthenticationScope, signInAsync } from 'expo-apple-authentication';
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { parseOAuthTokensFromUrl } from '@/features/auth/domain/auth-deep-link';
import { getSupabase } from '@/lib/supabase';
import { reportError } from '@/lib/telemetry';

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

  if (error) return { data, error };
  if (!data.url) {
    return {
      data,
      error: new Error('Der Anmeldedienst hat keine Weiterleitungs-URL geliefert.'),
    };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return { data, error: null };

  const tokens = parseOAuthTokensFromUrl(result.url, redirectTo);
  if (!tokens) {
    return { data, error: new Error('Der OAuth-Callback ist ungültig.') };
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

  return { data, error: sessionError };
}

export async function signInWithApple() {
  if (Platform.OS !== 'ios') return signInWithOAuthProvider('apple');

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

    return {
      data: null,
      error: error instanceof Error ? error : new Error('Apple-Anmeldung fehlgeschlagen.'),
    };
  }
}
