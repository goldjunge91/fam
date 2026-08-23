import {
  REALTIME_SUBSCRIBE_STATES,
  type RealtimeChannel,
  type RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

import type { Entity, SqlDatabase } from '@/lib/db/types';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { toEpochMs } from '@/lib/sync/cursor';
import { applyRemoteRow, deleteMirrorRow } from '@/lib/sync/mirror-write';
import { clockCeiling, type ServerClock } from '@/lib/sync/server-clock';

// Nur Tabellen aus der `supabase_realtime`-Publication erzeugen Events.
const REALTIME_TABLES: readonly Entity[] = [
  'fridge_items',
  'shopping_list_items',
  'shopping_category_preferences',
];

export type RealtimeRowEvent = {
  entity: Entity;
  op: 'insert' | 'update' | 'delete';
  id: string;
  /** Lokale Ankunft minus Server-`updated_at`; `null` bei Deletes. */
  latencyMs: number | null;
};

type SubscribeHouseholdRealtimeDeps = {
  db: SqlDatabase;
  supabase: TypedSupabaseClient;
  householdIds: readonly string[];
  serverClock: ServerClock;
  onRowApplied?: (event: RealtimeRowEvent) => void;
  /** Resynchronisiert nach einer Verbindungsstoerung, nicht beim ersten Connect. */
  onReconnectResyncNeeded: () => Promise<void>;
  onStatusChange?: (householdId: string, status: RealtimeSubscribeState) => void;
  now?(): number;
};

export type RealtimeSubscribeState = `${REALTIME_SUBSCRIBE_STATES}`;

function eventTypeToOp(
  eventType: RealtimePostgresChangesPayload<never>['eventType'],
): 'insert' | 'update' | 'delete' {
  if (eventType === 'INSERT') return 'insert';
  if (eventType === 'DELETE') return 'delete';
  return 'update';
}

/**
 * Erstellt einen Channel je Haushalt. Remote-Zeilen umgehen die Outbox, daher
 * entstehen keine Echo-Schleifen. Vor erneutem Abonnieren muss der asynchrone
 * Unsubscribe abgeschlossen sein.
 */
export function subscribeHouseholdRealtime(
  deps: SubscribeHouseholdRealtimeDeps,
): () => Promise<void> {
  const channels: RealtimeChannel[] = [];

  for (const householdId of deps.householdIds) {
    let hasDisconnected = false;

    const topic = `household:${householdId}`;

    // Fast Refresh kann einen Channel ohne seine alte Cleanup-Closure hinterlassen.
    for (const stale of deps.supabase.getChannels()) {
      if (stale.topic === `realtime:${topic}`) {
        void deps.supabase.removeChannel(stale);
      }
    }

    const channel = deps.supabase.channel(topic);

    for (const entity of REALTIME_TABLES) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: entity, filter: `household_id=eq.${householdId}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          void handlePayload(deps, entity, payload);
        },
      );
    }

    channel.subscribe((status) => {
      deps.onStatusChange?.(householdId, status);

      if (
        status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
        status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT
      ) {
        hasDisconnected = true;
        return;
      }

      if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED && hasDisconnected) {
        hasDisconnected = false;
        void deps.onReconnectResyncNeeded();
      }
    });

    channels.push(channel);
  }

  return async () => {
    // Erst `removeChannel` gibt das Topic fuer ein neues Abonnement frei.
    for (const channel of channels) {
      await deps.supabase.removeChannel(channel);
    }
  };
}

async function handlePayload(
  deps: SubscribeHouseholdRealtimeDeps,
  entity: Entity,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): Promise<void> {
  // Fehlerhafte Teil-Payloads werden durch einen vollstaendigen Sync ersetzt.
  if (payload.errors && payload.errors.length > 0) {
    await deps.onReconnectResyncNeeded();
    return;
  }

  const op = eventTypeToOp(payload.eventType);
  const nowMs = deps.now?.() ?? Date.now();
  let latencyMs: number | null = null;

  await deps.db.withExclusiveTransactionAsync(async (txn) => {
    if (op === 'delete') {
      const id = (payload.old as { id?: string }).id;
      if (typeof id !== 'string') return;
      await deleteMirrorRow(txn, entity, id);
      return;
    }

    const row = payload.new as { id: string; updated_at: string; deleted_at?: string | null };
    await applyRemoteRow(txn, entity, row, clockCeiling(deps.serverClock, nowMs));
    latencyMs = nowMs - toEpochMs(row.updated_at);
  });

  const id =
    op === 'delete' ? (payload.old as { id?: string }).id : (payload.new as { id?: string }).id;
  if (typeof id === 'string') {
    deps.onRowApplied?.({ entity, op, id, latencyMs });
  }
}
