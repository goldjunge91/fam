import type { TypedSupabaseClient } from '@/lib/backend/supabase/remote-client';
import type { SqlDatabase } from '@/lib/db/types';
import { type PullOutcome, pullHousehold } from '@/lib/sync/pull';
import { type PushResult, pushOutbox } from '@/lib/sync/push';
import { clockCeiling, type ServerClock } from '@/lib/sync/server-clock';

export type SyncRunResult = {
  push: PushResult;
  pull: PullOutcome[];
};

export async function syncHousehold(deps: {
  db: SqlDatabase;
  supabase: TypedSupabaseClient;
  serverClock: ServerClock;
  householdIds: readonly string[];
  now?(): number;
  signal?: AbortSignal;
}): Promise<SyncRunResult> {
  const nowMs = deps.now ? deps.now() : Date.now();

  const push = await pushOutbox({
    db: deps.db,
    supabase: deps.supabase,
    now: () => nowMs,
    ...(deps.signal ? { signal: deps.signal } : {}),
  });

  const pull = await pullHousehold({
    db: deps.db,
    supabase: deps.supabase,
    householdIds: deps.householdIds,
    clockCeilingMs: clockCeiling(deps.serverClock, nowMs),
    serverNowMs: deps.serverClock.serverNowMs,
    ...(deps.signal ? { signal: deps.signal } : {}),
  });

  return { push, pull };
}
