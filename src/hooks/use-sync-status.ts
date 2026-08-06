import { onlineManager, useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { getDatabase } from '@/lib/db/client';
import type { SqlDatabase } from '@/lib/db/types';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { computeSyncStatusView, type SyncStatusView } from '@/lib/sync/sync-status';

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
 * Outbox-Zaehler werden gepollt statt ueber einen Event-Emitter aus
 * `outbox.ts`/`push.ts` beobachtet — haelt dieses Feature vollstaendig additiv
 * (keine bereits gemergte Sync-Engine-Datei wird angefasst). Die dadurch
 * moegliche Verzoegerung von bis zu drei Sekunden faellt praktisch nicht auf,
 * da ohnehin nichts haeufiger als das synchronisiert.
 */
export function useSyncStatus(getDb: () => Promise<SqlDatabase> = getDatabase): SyncStatusView {
  const isOnline = useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );

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
  });
}
