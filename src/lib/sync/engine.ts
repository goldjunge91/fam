import type { SqlDatabase } from '@/lib/db/types';
import type { TypedSupabaseClient } from '@/lib/supabase';
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
}): Promise<SyncRunResult> {
  const nowMs = deps.now ? deps.now() : Date.now();

  const push = await pushOutbox({ db: deps.db, supabase: deps.supabase, now: () => nowMs });

  const pull = await pullHousehold({
    db: deps.db,
    supabase: deps.supabase,
    householdIds: deps.householdIds,
    clockCeilingMs: clockCeiling(deps.serverClock, nowMs),
  });

  return { push, pull };
}
