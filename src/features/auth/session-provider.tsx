import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, use, useEffect, useState } from 'react';
import { migrateLegacyAccountData } from '@/features/auth/migrations/legacy-account-data';
import { hasSeenOnboarding } from '@/features/onboarding/onboarding-completion';
import { setActiveUserId } from '@/lib/db/client';
import { queryClient, startAccountQueryPersistence } from '@/lib/query-client';
import {
  activateEncryptedAccountStorage,
  getRememberedLocalAccountUserId,
  rememberLocalAccountUserId,
} from '@/lib/storage/account-storage';
import { getSupabase, startSupabaseAutoRefresh } from '@/lib/supabase';
import { resumeAccountSync } from '@/lib/sync/account-sync-gate';
import {
  addDiagnosticStep,
  measureOperation,
  reportError,
  setTelemetryUserId,
} from '@/lib/telemetry';
import { clearLocalAccountData } from './sign-out';

type SessionState = {
  session: Session | null;

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
    let currentUserId: string | null = null;
    let stopQueryPersistence = () => {};
    let authTransition = Promise.resolve();
    let latestAuthEventUserId: string | null | undefined;

    let supabase: ReturnType<typeof getSupabase>;
    try {
      supabase = getSupabase();
    } catch (error) {
      reportError(error, {
        operation: 'auth.client.initialize',
        error_code: 'auth_client_initialize_failed',
      });
      // Bei fehlender Konfiguration oder SecureStore-Funktion bedienbar bleiben.
      setState({ session: null, isLoading: false, seenOnboarding: false, error: error as Error });
      return;
    }

    // Session und Onboarding-Flag parallel lesen — beides wird benoetigt,
    // bevor die Splash-Screen ausgeblendet wird.
    const initialization = measureOperation('auth.session.restore', () =>
      Promise.all([supabase.auth.getSession(), hasSeenOnboarding()]),
    )
      .then(async ([{ data, error }, seenOnboarding]) => {
        if (!active) return;
        if (error) {
          reportError(error, {
            operation: 'auth.session.restore',
            error_code: error.code ?? 'auth_session_restore_failed',
          });
        }
        const restoredUserId = data.session?.user.id ?? null;
        const rememberedUserId = await getRememberedLocalAccountUserId();
        if (!active) return;
        const authoritativeRestoredUserId =
          latestAuthEventUserId === undefined || latestAuthEventUserId === restoredUserId
            ? restoredUserId
            : null;
        const staleRestoredUserId =
          latestAuthEventUserId !== undefined && latestAuthEventUserId !== restoredUserId
            ? restoredUserId
            : null;

        // Alten lokalen Besitzer vor dem Setzen einer neuen Ownership entfernen.
        const localUserIdToClear =
          rememberedUserId && rememberedUserId !== authoritativeRestoredUserId
            ? rememberedUserId
            : staleRestoredUserId;
        if (localUserIdToClear) {
          setActiveUserId(null);
          await clearLocalAccountData(queryClient, localUserIdToClear);
          if (!active) return;
        }

        if (authoritativeRestoredUserId) {
          activateEncryptedAccountStorage(authoritativeRestoredUserId);
        }
        // Nutzer vor der Drizzle-Legacy-Migration im DB-Gate registrieren.
        setActiveUserId(authoritativeRestoredUserId);
        await migrateLegacyAccountData(authoritativeRestoredUserId);
        if (!active) return;

        currentUserId = authoritativeRestoredUserId;
        setTelemetryUserId(authoritativeRestoredUserId);
        if (authoritativeRestoredUserId) {
          await rememberLocalAccountUserId(authoritativeRestoredUserId);
          const stopPersistence = await startAccountQueryPersistence(
            queryClient,
            authoritativeRestoredUserId,
          );
          if (!active) {
            stopPersistence();
            return;
          }
          stopQueryPersistence = stopPersistence;
          resumeAccountSync();
        }

        // Auth-Events haben Vorrang vor einem veralteten getSession-Snapshot.
        if (latestAuthEventUserId !== undefined) {
          setState((prev) => ({ ...prev, seenOnboarding, error: error ?? prev.error }));
          return;
        }
        // Ownership vor dem Re-Render aktualisieren.
        setState({
          session: data.session,
          isLoading: false,
          seenOnboarding,
          error: error ?? null,
        });
        addDiagnosticStep('auth.session.restored', {
          operation: 'auth.session.restore',
          outcome: error ? 'failed' : 'completed',
        });
      })
      .catch((error: Error) => {
        if (!active) return;
        setActiveUserId(null);
        setTelemetryUserId(null);
        setState({ session: null, isLoading: false, seenOnboarding: false, error });
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null;
      latestAuthEventUserId = nextUserId;

      authTransition = authTransition
        .then(() => initialization)
        .then(async () => {
          if (!active) return;
          const previousUserId = currentUserId;

          if (previousUserId && previousUserId !== nextUserId) {
            // Während des Wipes darf weder der alte noch der neue Account die
            // SQLite-Datei oder den Query-Cache rendern.
            setActiveUserId(null);
            setState((prev) => ({ ...prev, session: null, isLoading: true, error: null }));
            stopQueryPersistence();
            stopQueryPersistence = () => {};
            await clearLocalAccountData(queryClient, previousUserId);
            if (!active) return;
          }

          currentUserId = nextUserId;
          // Ab hier ist der Ladevorgang in jedem Fall abgeschlossen: Das Event
          // feuert auch bei SIGNED_OUT und TOKEN_REFRESHED.
          setActiveUserId(nextUserId);
          setTelemetryUserId(nextUserId);
          if (nextUserId) {
            activateEncryptedAccountStorage(nextUserId);
            await rememberLocalAccountUserId(nextUserId);
            if (nextUserId !== previousUserId) {
              const stopPersistence = await startAccountQueryPersistence(queryClient, nextUserId);
              if (!active) {
                stopPersistence();
                return;
              }
              stopQueryPersistence = stopPersistence;
            }
            resumeAccountSync();
          }
          if (!active) return;
          setState((prev) => ({ ...prev, session, isLoading: false, error: null }));
          addDiagnosticStep(`auth.session.${event.toLowerCase()}`, {
            operation: 'auth.session.state_change',
            outcome: 'completed',
          });
        })
        .catch((error: Error) => {
          if (!active) return;
          setActiveUserId(null);
          setTelemetryUserId(null);
          reportError(error, {
            operation: 'auth.session.transition',
            error_code: 'auth_session_transition_failed',
          });
          setState((prev) => ({ ...prev, session: null, isLoading: false, error }));
        });
    });

    const stopAutoRefresh = startSupabaseAutoRefresh();

    return () => {
      active = false;
      stopQueryPersistence();
      subscription.subscription.unsubscribe();
      stopAutoRefresh();
    };
  }, []);

  return <SessionContext value={state}>{children}</SessionContext>;
}
