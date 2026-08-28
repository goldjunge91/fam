import * as Linking from 'expo-linking';
import { useEffect } from 'react';

import {
  parseAuthErrorFromUrl,
  parseAuthTokensFromUrl,
} from '@/features/auth/domain/auth-deep-link';
import { setAuthDeepLinkError } from '@/lib/auth-deep-link-state';
import { savePendingInviteToken } from '@/lib/pending-invite';
import { getSupabase } from '@/lib/supabase';
import { reportError, reportWarning } from '@/lib/telemetry';

/** Verarbeitet Auth- und Einladungslinks an der zentralen App-Grenze. */
export function useAppDeepLinks(): void {
  useEffect(() => {
    function handleUrl(url: string | null) {
      if (!url) return;

      try {
        const tokens = parseAuthTokensFromUrl(url);
        if (tokens) {
          getSupabase()
            .auth.setSession({
              access_token: tokens.accessToken,
              refresh_token: tokens.refreshToken,
            })
            .catch((error) => {
              reportError(error, {
                operation: 'auth.deep_link_session',
                error_code: 'deep_link_session_failed',
              });
              console.error('Fehler beim Anwenden der Deep-Link-Session:', error);
              setAuthDeepLinkError(
                'Die Anmeldung ueber den Link hat nicht geklappt. Gib stattdessen den 6-stelligen Code aus der E-Mail ein.',
              );
            });
          return;
        }

        const authError = parseAuthErrorFromUrl(url);
        if (authError) {
          reportWarning(authError, {
            operation: 'auth.deep_link',
            error_code: 'auth_deep_link_error',
          });
          console.warn('Deep Link meldet einen Auth-Fehler:', authError);
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
        console.error('Fehler beim Parsen des Deep Links:', error);
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
