import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, use, useCallback, useEffect, useState } from 'react';
import { hasSeenOnboarding } from '@/features/onboarding/onboarding-completion';
import { getSupabase, startSupabaseAutoRefresh } from '@/lib/backend/supabase/remote-client';
import { queryClient, startAccountQueryPersistence } from '@/lib/data/query-client';
import { setActiveUserId } from '@/lib/db/local-client';
import { debugLogEvent } from '@/lib/observability/debug-log';
import {
  activateEncryptedAccountStorage,
  getRememberedLocalAccountUserId,
  rememberLocalAccountUserId,
} from '@/lib/storage/local-account-storage';
import { resumeAccountSync } from '@/lib/sync/remote-sync-gate';
import {
  addDiagnosticStep,
  measureOperation,
  reportError,
  setTelemetryUserId,
} from '@/lib/telemetry';
import { clearLocalAccountData } from './sign-out';

type SessionState = {
  session: Session | null;
  /** Nur dann true, wenn der lokale Account-Bootstrap vollständig committed ist. */
  accountReady: boolean;

  isLoading: boolean;
  /**
   * `false` = App-Erstinstallation / neuer User → direkt Onboarding zeigen.
   * `true`  = bekannter User (hat Onboarding schon gesehen, evtl. ausgeloggt).
   */
  seenOnboarding: boolean;
  /** Fehler beim Initialisieren, z. B. fehlendes natives Modul oder fehlende Env-Variablen. */
  error: Error | null;
  /** Wiederholt den lokalen Session-/Account-Bootstrap ohne einen Logout. */
  retry: () => void;
};

type InternalSessionState = Omit<SessionState, 'retry'>;

const SessionContext = createContext<SessionState>({
  session: null,
  accountReady: false,
  isLoading: true,
  seenOnboarding: false,
  error: null,
  retry: () => {},
});

export function useSession(): SessionState {
  return use(SessionContext);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<InternalSessionState>({
    session: null,
    accountReady: false,
    isLoading: true,
    seenOnboarding: false,
    error: null,
  });
  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, accountReady: false, isLoading: true, error: null }));
    setRetryCount((count) => count + 1);
  }, []);

  // retryCount is an explicit restart nonce for the one-shot bootstrap effect.
  // biome-ignore lint/correctness/useExhaustiveDependencies: retryCount intentionally restarts the bootstrap effect.
  useEffect(() => {
    let active = true;
    let currentUserId: string | null = null;
    let stopQueryPersistence = () => {};
    let authTransition = Promise.resolve();
    let latestAuthEventUserId: string | null | undefined;
    let latestAuthEventSession: Session | null | undefined;
    let restoredSession: Session | null | undefined;
    let restoredSeenOnboarding: boolean | undefined;

    let supabase: ReturnType<typeof getSupabase>;
    try {
      supabase = getSupabase();
    } catch (error) {
      reportError(new Error('Auth-Client konnte nicht initialisiert werden'), {
        operation: 'auth.client.initialize',
        error_code: 'auth_client_initialize_failed',
      });
      // Bei fehlender Konfiguration oder SecureStore-Funktion bedienbar bleiben.
      setState({
        session: null,
        accountReady: false,
        isLoading: false,
        seenOnboarding: false,
        error: error as Error,
      });
      return;
    }

    const handleInitializationFailure = (error: Error): void => {
      if (!active) return;
      setActiveUserId(null);
      setTelemetryUserId(null);
      reportError(new Error('Lokaler Session-Bootstrap fehlgeschlagen'), {
        operation: 'auth.session.bootstrap',
        error_code: 'auth_session_bootstrap_failed',
      });
      const preservedSession =
        latestAuthEventSession !== undefined ? latestAuthEventSession : restoredSession;
      setState((prev) => ({
        ...prev,
        session: preservedSession === undefined ? prev.session : preservedSession,
        accountReady: false,
        isLoading: false,
        seenOnboarding: restoredSeenOnboarding ?? prev.seenOnboarding,
        error,
      }));
    };

    // `getSession()` stellt den lokal gespeicherten Snapshot wieder her und
    // macht beim Offline-Start keine Serverbestätigung. Hier dient seine ID
    // ausschließlich der lokalen Account-Zuordnung; Remote-Zugriffe werden
    // weiterhin durch Supabase Auth und RLS autorisiert. Session und
    // Onboarding-Flag werden parallel gelesen, bevor der Splash-Screen endet.
    const initialization = measureOperation('auth.session.restore', () =>
      Promise.all([supabase.auth.getSession(), hasSeenOnboarding()]),
    ).then(async ([{ data, error }, seenOnboarding]) => {
      if (!active) return;
      restoredSession = data.session;
      restoredSeenOnboarding = seenOnboarding;
      if (error) {
        reportError(new Error('Supabase-Session konnte nicht wiederhergestellt werden'), {
          operation: 'auth.session.restore',
          error_code: error.code ?? 'auth_session_restore_failed',
        });
        throw error;
      }
      const restoredLocalUserId = data.session?.user.id ?? null;
      const rememberedUserId = await getRememberedLocalAccountUserId();
      if (!active) return;
      const restoredLocalAccountUserId =
        latestAuthEventUserId === undefined || latestAuthEventUserId === restoredLocalUserId
          ? restoredLocalUserId
          : null;
      const staleSnapshotUserId =
        latestAuthEventUserId !== undefined && latestAuthEventUserId !== restoredLocalUserId
          ? restoredLocalUserId
          : null;

      const localUserIdToClear =
        rememberedUserId &&
        rememberedUserId !== restoredLocalAccountUserId &&
        rememberedUserId !== latestAuthEventUserId
          ? rememberedUserId
          : staleSnapshotUserId;
      if (localUserIdToClear) {
        setActiveUserId(null);
        await clearLocalAccountData(queryClient, localUserIdToClear);
        if (!active) return;
      }

      if (restoredLocalAccountUserId) {
        activateEncryptedAccountStorage(restoredLocalAccountUserId);
      }
      // Nutzer vor dem lokalen Datenbankzugriff im DB-Gate registrieren.
      setActiveUserId(restoredLocalAccountUserId);
      if (!active) return;

      currentUserId = restoredLocalAccountUserId;
      setTelemetryUserId(restoredLocalAccountUserId);
      if (restoredLocalAccountUserId) {
        await rememberLocalAccountUserId(restoredLocalAccountUserId);
        const stopPersistence = await startAccountQueryPersistence(
          queryClient,
          restoredLocalAccountUserId,
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
        accountReady: true,
        isLoading: false,
        seenOnboarding,
        error: error ?? null,
      });
      debugLogEvent('auth.session.account_ready', {
        source: 'session_restore',
        auth_event: 'none',
        has_session: Boolean(data.session),
        account_ready: true,
        is_loading: false,
      });
      addDiagnosticStep('auth.session.restored', {
        operation: 'auth.session.restore',
        outcome: error ? 'failed' : 'completed',
      });
    });

    const initializationResult = initialization.then(
      () => true,
      (error: Error) => {
        handleInitializationFailure(error);
        return false;
      },
    );

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null;
      latestAuthEventUserId = nextUserId;
      latestAuthEventSession = session;

      authTransition = authTransition
        .then(() => initializationResult)
        .then(async (bootstrapSucceeded) => {
          if (!active) return;
          // Automatische Auth-Events dürfen einen lokalen Bootstrap-Fehler
          // nicht implizit in einen bereiten Account umwandeln. Ein echter
          // SIGNED_OUT bleibt davon ausgenommen und muss weiter ausloggen.
          if (!bootstrapSucceeded && event !== 'SIGNED_OUT') return;
          const previousUserId = currentUserId;

          if (previousUserId && previousUserId !== nextUserId) {
            // Während des Wipes darf weder der alte noch der neue Account die
            // SQLite-Datei oder den Query-Cache rendern.
            setActiveUserId(null);
            setState((prev) => ({
              ...prev,
              session: null,
              accountReady: false,
              isLoading: true,
              error: null,
            }));
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
          setState((prev) => ({
            ...prev,
            session,
            accountReady: true,
            isLoading: false,
            error: null,
          }));
          debugLogEvent('auth.session.account_ready', {
            source: 'auth_event',
            auth_event: event,
            has_session: Boolean(session),
            account_ready: true,
            is_loading: false,
          });
          addDiagnosticStep(`auth.session.${event.toLowerCase()}`, {
            operation: 'auth.session.state_change',
            outcome: 'completed',
          });
        })
        .catch((error: Error) => {
          if (!active) return;
          setActiveUserId(null);
          setTelemetryUserId(null);
          reportError(new Error('Auth-Session-Transition fehlgeschlagen'), {
            operation: 'auth.session.transition',
            error_code: 'auth_session_transition_failed',
          });
          const switchedAccount = currentUserId !== null && currentUserId !== nextUserId;
          setState((prev) => ({
            ...prev,
            session: switchedAccount ? null : session,
            accountReady: false,
            isLoading: false,
            error,
          }));
        });
    });

    const stopAutoRefresh = startSupabaseAutoRefresh();

    return () => {
      active = false;
      stopQueryPersistence();
      subscription.subscription.unsubscribe();
      stopAutoRefresh();
    };
  }, [retryCount]);

  return <SessionContext value={{ ...state, retry }}>{children}</SessionContext>;
}
