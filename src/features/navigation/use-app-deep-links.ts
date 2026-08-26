import * as Linking from 'expo-linking';
import { useEffect } from 'react';

import { parseAuthErrorFromUrl, parseAuthTokensFromUrl } from '@/features/auth/auth-deep-link';
import { setAuthDeepLinkError } from '@/lib/auth-deep-link-state';
import { savePendingInviteToken } from '@/lib/pending-invite';
import { getSupabase } from '@/lib/supabase';

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
              console.error('Fehler beim Anwenden der Deep-Link-Session:', error);
              setAuthDeepLinkError(
                'Die Anmeldung ueber den Link hat nicht geklappt. Gib stattdessen den 6-stelligen Code aus der E-Mail ein.',
              );
            });
          return;
        }

        const authError = parseAuthErrorFromUrl(url);
        if (authError) {
          console.warn('Deep Link meldet einen Auth-Fehler:', authError);
          setAuthDeepLinkError(authError);
          return;
        }

        const token = Linking.parse(url).queryParams?.token;
        if (typeof token === 'string' && token.trim()) {
          savePendingInviteToken(token.trim());
        }
      } catch (error) {
        console.error('Fehler beim Parsen des Deep Links:', error);
      }
    }

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, []);
}
