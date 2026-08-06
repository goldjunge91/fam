import type { SqlDatabase } from '@/lib/db/types';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { type PullOutcome, pullHousehold } from '@/lib/sync/pull';
import { type PushResult, pushOutbox } from '@/lib/sync/push';
import { clockCeiling, type ServerClock } from '@/lib/sync/server-clock';

/**
 * Top-Level-Orchestrator der Sync-Engine (#47).
 *
 * Push laeuft VOR Pull: derselbe Lauf's Pull beobachtet danach sofort die
 * soeben gepushte Zeile (mit dem autoritativen Server-`updated_at`) und setzt
 * `_dirty` ueber den ohnehin idempotenten Upsert-Pfad zurueck auf 0 — statt
 * die Spiegelzeile bis zum naechsten Zyklus dirty zu lassen.
 *
 * Haushalts-parametrisiert, ohne App-Wiring: `supabase` muss mit
 * `serverClock.fetch` gebaut sein (siehe `server-clock.ts`), sonst bleibt
 * `clockCeiling` ohne Serverzeit-Beobachtung auf `now` zurueckfallen.
 */

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
