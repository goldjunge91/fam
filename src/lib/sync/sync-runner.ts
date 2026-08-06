import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { getDatabase } from '@/lib/db/client';
import { getSupabase } from '@/lib/supabase';
import { syncHousehold, type SyncRunResult } from '@/lib/sync/engine';
import { createServerClock } from '@/lib/sync/server-clock';

import { retryFailedOutboxEntries } from '@/lib/db/outbox-retry';

const serverClock = createServerClock();
let isSyncing = false;
let lastSyncResultSummary: {
  timestamp: number;
  pushedCount: number;
  pulledCount: number;
  hasErrors: boolean;
  lastError?: string;
} | null = null;

export function getLastSyncInfo() {
  return lastSyncResultSummary;
}

export async function triggerHouseholdSync(
  householdIds: string[],
  retryFailed = false,
): Promise<SyncRunResult | null> {
  if (isSyncing || !householdIds || householdIds.length === 0) return null;
  isSyncing = true;
  try {
    const db = await getDatabase();
    if (retryFailed) {
      await retryFailedOutboxEntries(db);
    }
    const supabase = getSupabase();
    const result = await syncHousehold({
      db,
      supabase,
      serverClock,
      householdIds,
    });

    const pushedCount = result.push.outcomes.filter((o) => o.kind === 'pushed').length;
    const pulledCount = result.pull.reduce((acc, p) => acc + (p.rowsWritten || 0), 0);
    const firstErr = result.push.outcomes.find((o) => 'error' in o && o.error);

    lastSyncResultSummary = {
      timestamp: Date.now(),
      pushedCount,
      pulledCount,
      hasErrors: Boolean(firstErr),
      lastError: firstErr && 'error' in firstErr ? (firstErr as { error: string }).error : undefined,
    };

    return result;
  } catch (err) {
    console.warn('[SyncRunner] Sync fehlgeschlagen:', err);
    return null;
  } finally {
    isSyncing = false;
  }
}

/**
 * Automatischer Sync-Hook. Startet den Sync beim Laden, periodisch alle 20s,
 * und beim Reaktivieren der App (AppState == 'active').
 */
export function useSyncEngine(householdId: string | undefined) {
  const householdIdRef = useRef(householdId);
  householdIdRef.current = householdId;

  useEffect(() => {
    if (!householdId) return;

    // 1. Initialer Sync beim App-Start / Haushalt-Laden
    triggerHouseholdSync([householdId]);

    // 2. Periodischer Timer (alle 20 Sekunden)
    const interval = setInterval(() => {
      if (householdIdRef.current) {
        triggerHouseholdSync([householdIdRef.current]);
      }
    }, 20000);

    // 3. Sync bei AppState -> 'active'
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && householdIdRef.current) {
        triggerHouseholdSync([householdIdRef.current]);
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [householdId]);
}
