import { onlineManager, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { getDatabase } from '@/lib/db/client';
import { onOutboxChanged } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { computeSyncStatusView, type SyncStatusView } from '@/lib/sync/sync-status';

/**
 * Wie lange "Synchronisiere..." nach einem lokalen Schreibvorgang sichtbar
 * bleibt — bewusst kurz und fix, nicht an den tatsaechlichen Push gekoppelt
 * (siehe Kommentar in `sync-status.ts`). Ein weiterer Schreibvorgang in
 * dieser Zeit verlaengert die Anzeige (derselbe Timer wird neu gestartet),
 * ein Schwung von Aenderungen zeigt also durchgehend "synchronisiert" statt
 * zu flackern.
 */
const RECENT_WRITE_DISPLAY_MS = 1_500;

/**
 * Liest Netzwerkstatus und Outbox-Zaehler und leitet daraus den Anzeigezustand
 * fuer #51 ab.
 *
 * Netzwerkstatus kommt aus TanStacks bereits gemountetem `onlineManager`
 * (gespeist von echten `expo-network`-Events ueber `startQueryEnvironmentSync`
 * in `src/app/_layout.tsx`) statt einem zweiten, unabhaengigen Listener — #50s
 * Anforderung, `expo-network` direkt zu verwenden, betrifft den
 * Reconnect-*Trigger*, nicht diese *Anzeige*; beide speisen sich letztlich aus
 * denselben Events.
 *
 * Die `pending`/`failed`-Zaehler (fuer die Beschriftung, `offline`/`failed`)
 * werden weiterhin per `refetchInterval` gepollt — fuer die reine Anzeige
 * reicht das. Nur der `syncing`-Ausloeser selbst haengt jetzt an
 * `onOutboxChanged()` (`lib/db/outbox.ts`), damit "Synchronisiere..." direkt
 * nach einem Schreibvorgang erscheint statt erst beim naechsten Poll-Tick.
 */
export function useSyncStatus(getDb: () => Promise<SqlDatabase> = getDatabase): SyncStatusView {
  const isOnline = useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );

  const queryClient = useQueryClient();
  const [recentLocalWrite, setRecentLocalWrite] = useState(false);
  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = onOutboxChanged(() => {
      setRecentLocalWrite(true);
      // Ohne das bliebe `pendingCount` bis zum naechsten 3s-Poll-Tick auf dem
      // alten Stand — die Anzeige spraenge sofort auf "Synchronisiere...",
      // aber mit einer veralteten (oft 0) Zahl.
      queryClient.invalidateQueries({ queryKey: ['sync-status', 'outbox-counts'] });
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setRecentLocalWrite(false), RECENT_WRITE_DISPLAY_MS);
    });
    return () => {
      unsubscribe();
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [queryClient]);

  const { data } = useQuery({
    queryKey: ['sync-status', 'outbox-counts'],
    queryFn: async () => {
      const db = await getDb();

      const pending = await db.getFirstAsync<{ count: number }>(
        'select count(*) as count from outbox where attempts < ?',
        [MAX_ATTEMPTS],
      );
      const failed = await db.getFirstAsync<{ count: number }>(
        'select count(*) as count from outbox where attempts >= ?',
        [MAX_ATTEMPTS],
      );

      return { pending: pending?.count ?? 0, failed: failed?.count ?? 0 };
    },
    refetchInterval: 3_000,
    // Kein `_dirty`/`household_id`-Filter: die Outbox ist geraetelokal, nicht
    // haushaltsgebunden — der Zaehler braucht keinen "aktiver Haushalt"-Context.
    initialData: { pending: 0, failed: 0 },
  });

  return computeSyncStatusView({
    isOnline,
    pendingCount: data.pending,
    failedCount: data.failed,
    recentLocalWrite,
  });
}
