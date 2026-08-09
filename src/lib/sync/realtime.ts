import {
  REALTIME_SUBSCRIBE_STATES,
  type RealtimeChannel,
  type RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

import type { Entity, SqlDatabase } from '@/lib/db/types';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { applyRemoteRow, deleteMirrorRow } from '@/lib/sync/mirror-write';
import { clockCeiling, type ServerClock } from '@/lib/sync/server-clock';

/**
 * Realtime → SQLite Bridge (#48).
 *
 * Nur `fridge_items` und `shopping_list_items` sind in der
 * `supabase_realtime`-Publication (`supabase/schemas/10_realtime.sql`) —
 * `storage_locations` und `products` liefern keine Events. Diese Liste ist
 * bewusst hier lokal definiert, nicht in `entities.ts`: sie ist eine
 * Realtime-spezifische Tatsache, keine generische Pro-Entity-Eigenschaft wie
 * `hasServerTombstone`/`householdScoped`.
 */
const REALTIME_TABLES: readonly Entity[] = ['fridge_items', 'shopping_list_items'];

export type RealtimeRowEvent = { entity: Entity; op: 'insert' | 'update' | 'delete'; id: string };

type SubscribeHouseholdRealtimeDeps = {
  db: SqlDatabase;
  supabase: TypedSupabaseClient;
  householdIds: readonly string[];
  serverClock: ServerClock;
  /** Query-Cache-Invalidierung o.ae. — Sache des Aufrufers (Epic 4/5), hier nur ein Hook. */
  onRowApplied?: (event: RealtimeRowEvent) => void;
  /**
   * Wird bei jedem `SUBSCRIBED`-Uebergang aufgerufen, der auf eine
   * vorangegangene Verbindungsstoerung folgt (nicht beim allerersten Connect
   * — der wird bereits vom App-Start-Sync des Aufrufers abgedeckt, ein
   * zusaetzlicher Resync hier waere redundant). Typisch:
   * `() => syncHousehold({ db, supabase, serverClock, householdIds })`.
   * Bewusst caller-supplied statt intern aufgeloest — dieselbe Disziplin wie
   * push.ts/pull.ts, die auch nicht selbst wissen, was "syncHousehold" ist.
   */
  onReconnectResyncNeeded: () => Promise<void>;
  /**
   * Optionaler Hook fuer jeden Status-Uebergang eines Channels — fuer Tests
   * (auf den ersten `SUBSCRIBED` warten, bevor eine Remote-Aenderung
   * ausgeloest wird: der WS-Handshake braucht einen Moment, ein Event vor
   * `SUBSCRIBED` wird nie zugestellt) und optional fuer eine spaetere
   * Verbindungsstatus-UI. Kein Ersatz fuer `onReconnectResyncNeeded`.
   */
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
 * Abonniert Postgres-Changes fuer die uebergebenen Haushalte — ein Channel je
 * Haushalt (nicht je Tabelle, passend zur AC-Formulierung "Subscription je
 * aktivem Haushalt"), mit zwei `postgres_changes`-Bindings darauf (eine je
 * realtime-faehiger Tabelle).
 *
 * **Echo-Unterdrueckung: kein Extra-Mechanismus noetig.** `push.ts` schreibt
 * die vom Server zurueckgegebene Zeile bereits synchron mit dem Push-Erfolg
 * lokal (mit `_dirty=0`), in derselben Transaktion, die die Outbox-Zeilen
 * loescht. Ein Realtime-Echo dieses Writes trifft entweder auf eine bereits
 * identische, nicht-dirty lokale Zeile (wirkungsloser Upsert), oder — falls
 * es VOR dem lokalen Write eintrifft — auf eine dirty Zeile mit aelterem
 * Zeitstempel; `resolve()` waehlt dann zwangslaeufig 'remote' (der
 * Server-`updated_at` ist autoritativ und wurde fruehestens beim optimistischen
 * lokalen Write gestempelt). In beiden Faellen ruft dieser Pfad NIE
 * `enqueueMutation` auf — er schreibt ausschliesslich ueber
 * `applyRemoteRow`/`deleteMirrorRow` direkt in die Spiegeltabelle. Es gibt
 * damit strukturell keinen Weg zurueck in die Outbox, also keinen Weg zu
 * einer Schleife — nicht nur "im Normalfall nicht", sondern durch Konstruktion.
 * Bewiesen (nicht nur behauptet) in `realtime.integration.test.ts`.
 *
 * **Kein Modul-weites Register.** Der einzige Zustand ist der Closure ueber
 * die von DIESEM Aufruf erzeugten Channels — ein erneuter Aufruf nach
 * `unsubscribe()` ist dadurch sicher, ohne dass irgendetwas Buch fuehren muss.
 *
 * **Das Abmelden ist `async`, und darauf muss gewartet werden**, bevor
 * derselbe Haushalt erneut abonniert wird. Grund ist supabase-js:
 * `supabase.channel(topic)` legt keinen neuen Channel an, wenn zu diesem Topic
 * schon einer registriert ist — es gibt den vorhandenen zurueck
 * (`RealtimeClient.channel()`). `removeChannel()` wiederum nimmt ihn erst nach
 * einem `await channel.unsubscribe()` aus der Registry. Wer sofort neu
 * abonniert, bekommt deshalb die alte, bereits subscribte Instanz — und
 * `channel.on('postgres_changes', …)` wirft darauf
 * "cannot add `postgres_changes` callbacks … after `subscribe()`".
 */
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

  await deps.db.withExclusiveTransactionAsync(async (txn) => {
    if (op === 'delete') {
      const id = (payload.old as { id?: string }).id;
      if (typeof id !== 'string') return;
      await deleteMirrorRow(txn, entity, id);
      return;
    }

    const row = payload.new as { id: string; updated_at: string; deleted_at?: string | null };
    await applyRemoteRow(txn, entity, row, clockCeiling(deps.serverClock, nowMs));
  });

  const id =
    op === 'delete' ? (payload.old as { id?: string }).id : (payload.new as { id?: string }).id;
  if (typeof id === 'string') {
    deps.onRowApplied?.({ entity, op, id });
  }
}
