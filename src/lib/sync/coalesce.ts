import { parseOutboxEntry } from '@/lib/db/outbox';
import type { Entity, OutboxEntry, OutboxOp } from '@/lib/db/types';

/**
 * Outbox-Reduktion (#49).
 *
 * Rein: keine Datenbank, kein Netz, keine Uhr. Wer offline zehnmal an derselben
 * Menge dreht, soll beim Reconnect einen Push ausloesen und nicht zehn.
 *
 * Die Reduktion ist nicht nur Sparsamkeit. Jeder zusaetzliche Push ist ein
 * eigener Fehlerfall mit eigenem Backoff; je weniger Eintraege, desto weniger
 * Zustaende, in denen die Queue haengen bleiben kann.
 */

export type CoalescedEntry = {
  entity: Entity;
  entityId: string;
  op: OutboxOp;
  payload: Record<string, unknown>;
  /**
   * Die Outbox-Zeilen, die dieser eine Push ersetzt. Bei Erfolg werden genau
   * diese geloescht — nach id, nicht per `delete from outbox`. Sonst
   * verschwaenden Eintraege, die waehrend des Pushs dazugekommen sind.
   */
  sourceIds: number[];
  /** id des ersten Eintrags der Gruppe. Bestimmt die Position im Ergebnis. */
  sequence: number;
};

export type CoalesceResult = {
  /** Was tatsaechlich gepusht wird, in Erstellungsreihenfolge. */
  pushes: CoalescedEntry[];
  /**
   * Outbox-ids, die ohne einen einzigen Netzwerkaufruf geloescht werden
   * koennen — angelegt und wieder geloescht, bevor der Server je davon
   * gehoert hat. Wichtig, dass sie zurueckkommen: Bliebe die Zeile stehen,
   * wuerde sie ewig erneut versucht.
   */
  discardable: number[];
};

type Group = {
  entity: Entity;
  entityId: string;
  op: OutboxOp;
  payload: Record<string, unknown>;
  sourceIds: number[];
  sequence: number;
  /** true, sobald die Gruppe mit einem insert begonnen hat. */
  startedWithInsert: boolean;
};

/**
 * Fasst die Outbox je Zeile zu hoechstens einem Push zusammen.
 *
 * Erwartet die Eintraege in aufsteigender `id` — das ist die
 * Erstellungsreihenfolge aus #46.
 *
 * | Folge | Ergebnis |
 * |---|---|
 * | `update, update, update` | ein `update`, Payloads flach gemerged, spaeter gewinnt |
 * | `insert, update*` | ein `insert` mit allen Aenderungen eingearbeitet |
 * | `insert, …, delete` | faellt komplett weg → `discardable` |
 * | `update*, delete` | ein `delete` |
 *
 * Ein `delete` schliesst die Gruppe. Ein danach folgender Eintrag mit
 * derselben id beginnt eine neue — mit frischen UUIDs kommt das nicht vor, aber
 * die Regel haelt die Faltung total.
 *
 * Die Ausgabe ist nach `sequence` sortiert, also nach dem ersten Eintrag jeder
 * Gruppe. Damit bleibt die zeilenuebergreifende Erstellungsreihenfolge
 * erhalten: Ein `storage_location` wird vor dem `fridge_item` gepusht, das
 * darauf zeigt.
 */
export function coalesce(entries: readonly OutboxEntry[]): CoalesceResult {
  const open = new Map<string, Group>();
  const closed: Group[] = [];
  const discardable: number[] = [];

  const finish = (group: Group): void => {
    // Angelegt und wieder geloescht, ohne dass der Server je davon wusste:
    // Ein erfolgreicher Push loescht seine Outbox-Zeilen, also kann eine noch
    // wartende insert-Gruppe den Server nicht erreicht haben.
    if (group.op === 'delete' && group.startedWithInsert) {
      discardable.push(...group.sourceIds);
      return;
    }
    closed.push(group);
  };

  for (const entry of [...entries].sort((a, b) => a.id - b.id)) {
    const key = `${entry.entity}:${entry.entity_id}`;
    const payload = parseOutboxEntry(entry);
    const group = open.get(key);

    if (group === undefined) {
      open.set(key, {
        entity: entry.entity,
        entityId: entry.entity_id,
        op: entry.op,
        payload,
        sourceIds: [entry.id],
        sequence: entry.id,
        startedWithInsert: entry.op === 'insert',
      });
      continue;
    }

    group.sourceIds.push(entry.id);

    if (entry.op === 'delete') {
      group.op = 'delete';
      group.payload = payload;
      finish(group);
      open.delete(key);
      continue;
    }

    // insert bleibt insert, auch wenn danach noch geaendert wurde — der Server
    // hat die Zeile ja noch nie gesehen. Nur der Inhalt waechst zusammen.
    group.payload = { ...group.payload, ...payload };
  }

  for (const group of open.values()) {
    finish(group);
  }

  const pushes = closed
    .sort((a, b) => a.sequence - b.sequence)
    .map(({ startedWithInsert: _startedWithInsert, ...rest }) => rest);

  return { pushes, discardable: discardable.sort((a, b) => a - b) };
}
