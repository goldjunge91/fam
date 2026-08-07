import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, use, useEffect, useState } from 'react';

import { getSupabase, startSupabaseAutoRefresh } from '@/lib/supabase';
import { hasSeenOnboarding } from './onboarding-session';

type SessionState = {
  session: Session | null;
  /**
   * `true`, solange die gespeicherte Session noch gelesen wird UND
   * der Onboarding-Flag noch nicht aus SecureStore gelesen wurde.
   *
   * Der Unterschied zu `session === null` ist wesentlich: "noch nicht geladen"
   * und "nicht angemeldet" fuehren sonst beide zum Login-Screen, und ein
   * angemeldeter Nutzer saehe ihn beim Start kurz aufblitzen.
   */
  isLoading: boolean;
  /**
   * `false` = App-Erstinstallation / neuer User → direkt Onboarding zeigen.
   * `true`  = bekannter User (hat Onboarding schon gesehen, evtl. ausgeloggt).
   */
  seenOnboarding: boolean;
  /** Fehler beim Initialisieren, z. B. fehlendes natives Modul oder fehlende Env-Variablen. */
  error: Error | null;
};

const SessionContext = createContext<SessionState>({
  session: null,
  isLoading: true,
  seenOnboarding: false,
  error: null,
});

export function useSession(): SessionState {
  return use(SessionContext);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    session: null,
    isLoading: true,
    seenOnboarding: false,
    error: null,
  });

  useEffect(() => {
    let active = true;

    let supabase: ReturnType<typeof getSupabase>;
    try {
      supabase = getSupabase();
    } catch (error) {
      // Fehlende Env-Variablen oder ein Development Build ohne das native
      // SecureStore-Modul. Die App bleibt bedienbar und zeigt die Ursache, statt
      // beim Start mit einem Folgefehler abzubrechen.
      setState({ session: null, isLoading: false, seenOnboarding: false, error: error as Error });
      return;
    }

    // Session und Onboarding-Flag parallel lesen — beides wird benoetigt,
    // bevor die Splash-Screen ausgeblendet wird.
    Promise.all([supabase.auth.getSession(), hasSeenOnboarding()])
      .then(([{ data, error }, seenOnboarding]) => {
        if (!active) return;
        setState({
          session: data.session,
          isLoading: false,
          seenOnboarding,
          error: error ?? null,
        });
      })
      .catch((error: Error) => {
        if (!active) return;
        setState({ session: null, isLoading: false, seenOnboarding: false, error });
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      // Ab hier ist der Ladevorgang in jedem Fall abgeschlossen: Das Event
      // feuert auch bei SIGNED_OUT und TOKEN_REFRESHED.
      // seenOnboarding bleibt unveraendert (wurde bereits gelesen).
      setState((prev) => ({ ...prev, session, isLoading: false, error: null }));
    });

    const stopAutoRefresh = startSupabaseAutoRefresh();

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
      stopAutoRefresh();
    };
  }, []);

  return <SessionContext value={state}>{children}</SessionContext>;
}
