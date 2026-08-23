import { onlineManager, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { getDatabase } from '@/lib/db/client';
import { onOutboxChanged } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { computeSyncStatusView, type SyncStatusView } from '@/lib/sync/sync-status';

// Lokale Schreibvorgaenge zeigen kurz Feedback, unabhaengig vom Push-Fortschritt.
const RECENT_WRITE_DISPLAY_MS = 1_500;

const outboxCountsQueryKey = ['sync-status', 'outbox-counts'] as const;

async function fetchOutboxCounts(db: SqlDatabase): Promise<{ pending: number; failed: number }> {
  const pending = await db.getFirstAsync<{ count: number }>(
    'select count(*) as count from outbox where attempts < ?',
    [MAX_ATTEMPTS],
  );
  const failed = await db.getFirstAsync<{ count: number }>(
    'select count(*) as count from outbox where attempts >= ?',
    [MAX_ATTEMPTS],
  );

  return { pending: pending?.count ?? 0, failed: failed?.count ?? 0 };
}

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
    let cancelled = false;
    const unsubscribe = onOutboxChanged(() => {
      // Zaehler und Schreibstatus gemeinsam aktualisieren, damit kein alter
      // Zaehlerstand fuer einzelne Frames sichtbar wird.
      void (async () => {
        const db = await getDb();
        const counts = await fetchOutboxCounts(db);
        if (cancelled) return;
        queryClient.setQueryData(outboxCountsQueryKey, counts);
        setRecentLocalWrite(true);
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => setRecentLocalWrite(false), RECENT_WRITE_DISPLAY_MS);
      })();
    });
    return () => {
      cancelled = true;
      unsubscribe();
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [queryClient, getDb]);

  const { data } = useQuery({
    queryKey: outboxCountsQueryKey,
    queryFn: async () => fetchOutboxCounts(await getDb()),
    refetchInterval: 10_000,
    // Die Outbox ist geraetelokal und braucht keinen Haushaltsfilter.
    initialData: { pending: 0, failed: 0 },
  });

  return computeSyncStatusView({
    isOnline,
    pendingCount: data.pending,
    failedCount: data.failed,
    recentLocalWrite,
  });
}
