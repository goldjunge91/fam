import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, use, useEffect, useState } from 'react';

import { setActiveUserId } from '@/lib/db/client';
import { getSupabase, startSupabaseAutoRefresh } from '@/lib/supabase';
import { hasSeenOnboarding } from './onboarding-session';

type SessionState = {
  session: Session | null;
  /** Trennt eine noch ungelesene Session von einem abgemeldeten Zustand. */
  isLoading: boolean;
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
      // Initialisierungsfehler bleiben als erklaerbarer App-Zustand sichtbar.
      setState({ session: null, isLoading: false, seenOnboarding: false, error: error as Error });
      return;
    }

    // Beide Werte muessen vor dem Ausblenden des Splash-Screens vorliegen.
    Promise.all([supabase.auth.getSession(), hasSeenOnboarding()])
      .then(([{ data, error }, seenOnboarding]) => {
        if (!active) return;
        // Vor setState pruefen, bevor neu gemountete Komponenten die DB oeffnen.
        setActiveUserId(data.session?.user.id ?? null);
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
      // Jedes Auth-Event beendet die initiale Session-Ladephase.
      setActiveUserId(session?.user.id ?? null);
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
