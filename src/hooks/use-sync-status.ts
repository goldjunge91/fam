import { onlineManager, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { getDatabase } from '@/lib/db/client';
import { onOutboxChanged } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { computeSyncStatusView, type SyncStatusView } from '@/lib/sync/sync-status';

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

export function useSyncStatus(
  getDb: () => Promise<SqlDatabase> = getDatabase,
  enabled = true,
): SyncStatusView {
  const isOnline = useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );

  const queryClient = useQueryClient();
  const [recentLocalWrite, setRecentLocalWrite] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const unsubscribe = onOutboxChanged(() => {
      // Erst den aktuellen Outbox-Stand lesen, dann Cache und Hinweis gemeinsam aktualisieren.
      void (async () => {
        const db = await getDb();
        const counts = await fetchOutboxCounts(db);
        if (cancelled) return;
        queryClient.setQueryData(outboxCountsQueryKey, counts);
        setRecentLocalWrite(true);
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => setRecentLocalWrite(false), RECENT_WRITE_DISPLAY_MS);
      })().catch(() => {
        // Ein paralleler Logout sperrt die DB; der nächste authentifizierte Mount liest neu.
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [queryClient, getDb, enabled]);

  const { data } = useQuery({
    queryKey: outboxCountsQueryKey,
    queryFn: async () => fetchOutboxCounts(await getDb()),
    enabled,
    refetchInterval: 10_000,
    // Die Outbox ist gerätelokal und nicht an den aktiven Haushalt gebunden.
    initialData: { pending: 0, failed: 0 },
  });

  if (!enabled) return { kind: 'hidden' };

  return computeSyncStatusView({
    isOnline,
    pendingCount: data.pending,
    failedCount: data.failed,
    recentLocalWrite,
  });
}
