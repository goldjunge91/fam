import { AppleAuthenticationScope, signInAsync } from 'expo-apple-authentication';
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { parseOAuthCodeFromUrl } from '@/features/auth/domain/auth-deep-link';
import { AUTH_ERROR_KEYS } from '@/features/auth/domain/auth-error-message';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { reportError } from '@/lib/telemetry';

let isBrowserOAuthFlowActive = false;

export async function signInWithOAuthProvider(provider: 'apple' | 'google') {
  if (isBrowserOAuthFlowActive) {
    return { data: null, error: new Error(AUTH_ERROR_KEYS.callbackInvalid) };
  }

  isBrowserOAuthFlowActive = true;
  try {
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
        error: new Error(AUTH_ERROR_KEYS.redirectUrlMissing),
      };
    }
    if (typeof data.flowId !== 'string' || !data.flowId.trim()) {
      return { data, error: new Error(AUTH_ERROR_KEYS.callbackInvalid) };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return { data, error: null };

    const code = parseOAuthCodeFromUrl(result.url, redirectTo);
    if (!code) {
      return { data, error: new Error(AUTH_ERROR_KEYS.callbackInvalid) };
    }

    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code, {
      flowId: data.flowId,
    });

    if (sessionError) {
      reportError(sessionError, {
        operation: 'auth.oauth_session',
        error_code: sessionError.code ?? 'oauth_session_failed',
      });
    }

    return { data, error: sessionError };
  } finally {
    isBrowserOAuthFlowActive = false;
  }
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
      return { data: null, error: new Error(AUTH_ERROR_KEYS.appleTokenMissing) };
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
      error: new Error(AUTH_ERROR_KEYS.appleSignInFailed),
    };
  }
}
