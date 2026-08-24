import { metaOf } from '@/lib/db/entities';
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
 * | `insert, …, delete, restore` | ein `insert` mit den urspruenglichen Daten (#69) |
 * | `update*, delete, restore` | ein `delete`, gefolgt von einem eigenstaendigen `restore` |
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
  const passthrough: CoalescedEntry[] = [];
  const discardable: number[] = [];
  // Payload einer verworfenen insert+delete-Gruppe, aufgehoben pro entity_id
  // fuer den Fall, dass ein `restore` (#69) danach folgt — siehe Randfall
  // unten bei `entry.op === 'restore'`.
  const discardedInsertPayloads = new Map<string, Record<string, unknown>>();

  const finish = (group: Group): void => {
    // Angelegt und wieder geloescht, ohne dass der Server je davon wusste:
    // Ein erfolgreicher Push loescht seine Outbox-Zeilen, also kann eine noch
    // wartende insert-Gruppe den Server nicht erreicht haben.
    if (group.op === 'delete' && group.startedWithInsert) {
      discardable.push(...group.sourceIds);
      discardedInsertPayloads.set(`${group.entity}:${group.entityId}`, group.payload);
      return;
    }
    closed.push(group);
  };

  for (const entry of [...entries].sort((a, b) => a.id - b.id)) {
    const key = `${entry.entity}:${entry.entity_id}`;
    const payload = parseOutboxEntry(entry);

    // Push-only Ereignisse sind append-only. Auch zwei Eintraege mit
    // identischer event_id duerfen hier nie in update/delete-Semantik
    // zusammenfallen; Idempotenz behandelt push.ts ausschliesslich ueber den
    // INSERT-PK (23505). Ungueltige Ops bleiben einzeln erhalten, damit der
    // Guard dort sie vor jedem Netzwerkzugriff als Programmierfehler markiert.
    if (metaOf(entry.entity).pushOnly) {
      passthrough.push({
        entity: entry.entity,
        entityId: entry.entity_id,
        op: entry.op,
        payload,
        sourceIds: [entry.id],
        sequence: entry.id,
      });
      continue;
    }

    const group = open.get(key);

    if (group === undefined) {
      // Randfall: `insert -> delete -> restore` auf derselben id, alles vor
      // dem naechsten Push. insert+delete wurden oben bereits als
      // `discardable` verworfen (Server hat nie davon erfahren) — ein
      // eigenstaendiger `restore`-Push liefe dann gegen eine auf dem Server
      // nie existente Zeile (0 Zeilen zurueck, failed-permanent). Der
      // Netto-Zustand ist stattdessen ein normaler `insert` mit den
      // urspruenglichen Daten plus allem, was der `restore`-Eintrag mitbringt.
      const discardedInsertPayload =
        entry.op === 'restore' ? discardedInsertPayloads.get(key) : undefined;

      open.set(key, {
        entity: entry.entity,
        entityId: entry.entity_id,
        op: discardedInsertPayload ? 'insert' : entry.op,
        payload: discardedInsertPayload ? { ...discardedInsertPayload, ...payload } : payload,
        sourceIds: [entry.id],
        sequence: entry.id,
        startedWithInsert: discardedInsertPayload !== undefined || entry.op === 'insert',
      });
      if (discardedInsertPayload) discardedInsertPayloads.delete(key);
      continue;
    }

    group.sourceIds.push(entry.id);

    if (entry.op === 'delete') {
      group.op = 'delete';
      // Payload NICHT auf den (meist leeren) delete-Payload ueberschreiben:
      // `attempt()` in push.ts ignoriert ihn fuer echte delete-Pushes ohnehin
      // (setzt nur `deleted_at`), aber `finish()` braucht die vollen
      // akkumulierten Daten, falls gleich ein `restore` folgt (#69) und diese
      // Gruppe discardable wird.
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

  const pushes = [
    ...closed.map(({ startedWithInsert: _startedWithInsert, ...rest }) => rest),
    ...passthrough,
  ].sort((a, b) => a.sequence - b.sequence);

  return { pushes, discardable: discardable.sort((a, b) => a - b) };
}
