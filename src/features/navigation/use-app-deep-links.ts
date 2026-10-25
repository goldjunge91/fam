import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { setAuthDeepLinkError } from '@/features/auth/auth-deep-link-state';
import {
  parseAuthErrorFromUrl,
  parseAuthTokensFromUrl,
} from '@/features/auth/domain/auth-deep-link';
import { savePendingInviteToken } from '@/features/auth/pending-invite';
import { usePasswordRecoveryStore } from '@/features/auth/recovery-store';
import { debugError, debugWarn } from '@/lib/observability/debug-log';
import { reportError, reportWarning } from '@/lib/telemetry';

/** Verarbeitet Auth- und Einladungslinks an der zentralen App-Grenze. */
export function useAppDeepLinks(): void {
  useEffect(() => {
    function handleUrl(url: string | null) {
      if (!url) return;

      try {
        const tokens = parseAuthTokensFromUrl(url);
        if (tokens) {
          void usePasswordRecoveryStore
            .getState()
            .openLegacyRecoveryLink(tokens)
            .then((result) => {
              if (result !== 'failed') return;
              reportWarning('Legacy recovery link could not be applied', {
                operation: 'auth.deep_link_session',
                error_code: 'deep_link_session_failed',
              });
            });
          return;
        }

        const authError = parseAuthErrorFromUrl(url);
        if (authError) {
          reportWarning(authError, {
            operation: 'auth.deep_link',
            error_code: 'auth_deep_link_error',
          });
          debugWarn('Deep Link meldet einen Auth-Fehler:', authError);
          try {
            const parsed = new URL(url);
            if (
              parsed.protocol === 'fam:' &&
              parsed.hostname === '' &&
              parsed.pathname === '/reset-password'
            ) {
              usePasswordRecoveryStore.getState().markLegacyRecoveryLinkFailed();
              return;
            }
          } catch {
            // Other auth callback errors use the shared sign-in message below.
          }
          setAuthDeepLinkError(authError);
          return;
        }

        const token = Linking.parse(url).queryParams?.token;
        if (typeof token === 'string' && token.trim()) {
          savePendingInviteToken(token.trim());
        }
      } catch (error) {
        reportError(error, {
          operation: 'auth.deep_link_parse',
          error_code: 'deep_link_parse_failed',
        });
        debugError('Fehler beim Parsen des Deep Links:', error);
      }
    }

    Linking.getInitialURL()
      .then(handleUrl)
      .catch((error) => {
        reportError(error, {
          operation: 'auth.initial_url',
          error_code: 'initial_url_failed',
        });
      });
    const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, []);
}
