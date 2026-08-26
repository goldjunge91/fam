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

const REALTIME_TABLES: readonly Entity[] = [
  'fridge_items',
  'shopping_list_items',
  'shopping_category_preferences',
];

export type RealtimeRowEvent = {
  entity: Entity;
  op: 'insert' | 'update' | 'delete';
  id: string;

  latencyMs: number | null;
};

type SubscribeHouseholdRealtimeDeps = {
  db: SqlDatabase;
  supabase: TypedSupabaseClient;
  householdIds: readonly string[];
  serverClock: ServerClock;
  /** Query-Cache-Invalidierung o.ae. — Sache des Aufrufers (Epic 4/5), hier nur ein Hook. */
  onRowApplied?: (event: RealtimeRowEvent) => void;

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

export function subscribeHouseholdRealtime(
  deps: SubscribeHouseholdRealtimeDeps,
): () => Promise<void> {
  const channels: RealtimeChannel[] = [];

  for (const householdId of deps.householdIds) {
    let hasDisconnected = false;

    const topic = `household:${householdId}`;

    // Einen stehengebliebenen Channel zu diesem Topic zuerst abraeumen.
    //
    // `supabase.channel(topic)` legt nichts Neues an, wenn zu dem Topic schon
    // etwas registriert ist — es gibt die vorhandene Instanz zurueck
    // (`RealtimeClient.channel()`). Ist die bereits subscribt, wirft das
    // `channel.on('postgres_changes', …)` weiter unten mit "cannot add
    // `postgres_changes` callbacks … after `subscribe()`".
    //
    // Stehen bleiben kann einer, wenn das Modul mit der unsubscribe-Closure
    // ersetzt wird, der Supabase-Client aber weiterlebt — im Dev-Build bei
    // jedem Fast Refresh. Die Cleanup-Funktion dieses Aufrufs laeuft dann nie.
    // `removeChannel()` nimmt den Channel synchron aus der Registry (der
    // await darin betrifft nur das Leave zum Server), deshalb genuegt hier
    // fire-and-forget: die naechste Zeile bekommt garantiert eine frische
    // Instanz.
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
    // Sequenziell und abgewartet: Erst wenn `removeChannel` durch ist, ist der
    // Channel aus der Registry des Clients raus und das Topic wieder frei.
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
  // Kann bei replica identity full eigentlich nicht vorkommen, aber ein
  // Payload mit errors ist nicht vertrauenswuerdig — lieber vollstaendig
  // nachziehen als eine kaputte Teilzeile anzuwenden.
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
    // Ankunft minus Server-Commit-Zeit — die eigentliche Ende-zu-Ende-Latenz,
    // die der Nutzer als "wie lange bis eine Aenderung ankommt" erlebt.
    latencyMs = nowMs - toEpochMs(row.updated_at);
  });

  const id =
    op === 'delete' ? (payload.old as { id?: string }).id : (payload.new as { id?: string }).id;
  if (typeof id === 'string') {
    deps.onRowApplied?.({ entity, op, id, latencyMs });
  }
}
