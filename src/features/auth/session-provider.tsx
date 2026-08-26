import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, use, useEffect, useState } from 'react';

import { setActiveUserId } from '@/lib/db/client';
import { queryClient, startAccountQueryPersistence } from '@/lib/query-client';
import {
  activateEncryptedAccountStorage,
  getRememberedLocalAccountUserId,
  rememberLocalAccountUserId,
} from '@/lib/storage/account-storage';
import { getSupabase, startSupabaseAutoRefresh } from '@/lib/supabase';
import { resumeAccountSync } from '@/lib/sync/account-sync-gate';
import { migrateLegacyAccountData } from './legacy-account-data';
import { hasSeenOnboarding } from './onboarding-session';
import { clearLocalAccountData } from './sign-out';

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
    let currentUserId: string | null = null;
    let stopQueryPersistence = () => {};
    let authTransition = Promise.resolve();
    let latestAuthEventUserId: string | null | undefined;

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
    const initialization = Promise.all([supabase.auth.getSession(), hasSeenOnboarding()])
      .then(async ([{ data, error }, seenOnboarding]) => {
        if (!active) return;
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

        // Kaltstart mit abgelaufener Session oder zwischenzeitlich gewechseltem
        // Supabase-Account: Erst den tatsächlich gemerkten lokalen Besitzer
        // entfernen, bevor irgendeine neue Ownership gesetzt wird.
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
        // Die Rezept-Legacy-Migration schreibt über Drizzle in SQLite. Das
        // DB-Gate muss den wiederhergestellten Nutzer deshalb bereits kennen,
        // bevor die Migration startet. Der catch-Pfad sperrt es wieder mit
        // `null`, falls die Migration fehlschlägt.
        setActiveUserId(authoritativeRestoredUserId);
        await migrateLegacyAccountData(authoritativeRestoredUserId);
        if (!active) return;

        currentUserId = authoritativeRestoredUserId;
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

        // Ein Auth-Event ist aktueller als der parallel gestartete getSession-
        // Snapshot. Es darf nicht durch dessen inzwischen veraltetes Ergebnis
        // überschrieben werden (z. B. SIGNED_OUT während des Kaltstarts).
        if (latestAuthEventUserId !== undefined) {
          setState((prev) => ({ ...prev, seenOnboarding, error: error ?? prev.error }));
          return;
        }
        // Vor setState: Das Re-Render kann Komponenten mounten, die sofort
        // `getDatabase()` aufrufen. Stuende dort noch der vorige Nutzer, wuerde
        // dieser erste Aufruf die Eigentumspruefung ueberspringen.
        setState({
          session: data.session,
          isLoading: false,
          seenOnboarding,
          error: error ?? null,
        });
      })
      .catch((error: Error) => {
        if (!active) return;
        setActiveUserId(null);
        setState({ session: null, isLoading: false, seenOnboarding: false, error });
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
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
        })
        .catch((error: Error) => {
          if (!active) return;
          setActiveUserId(null);
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
