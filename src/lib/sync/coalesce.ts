import { parseOutboxEntry } from '@/lib/db/outbox';
import type { Entity, OutboxEntry, OutboxOp } from '@/lib/db/types';

/** Reduziert mehrere Offline-Aenderungen derselben Zeile auf einen Push. */

export type CoalescedEntry = {
  entity: Entity;
  entityId: string;
  op: OutboxOp;
  payload: Record<string, unknown>;
  /** Nur diese ersetzten Outbox-Zeilen werden nach Erfolg geloescht. */
  sourceIds: number[];
  sequence: number;
};

export type CoalesceResult = {
  pushes: CoalescedEntry[];
  /** Lokal angelegte und wieder geloeschte Eintraege ohne Serverzustand. */
  discardable: number[];
};

type Group = {
  entity: Entity;
  entityId: string;
  op: OutboxOp;
  payload: Record<string, unknown>;
  sourceIds: number[];
  sequence: number;
  startedWithInsert: boolean;
};

/**
 * Updates werden gemerged, Insert plus Delete verworfen und Delete beendet
 * eine Gruppe. Die Ausgabe behaelt die urspruengliche Erstellungsreihenfolge.
 */
export function coalesce(entries: readonly OutboxEntry[]): CoalesceResult {
  const open = new Map<string, Group>();
  const closed: Group[] = [];
  const discardable: number[] = [];
  // Ein nachfolgendes Restore braucht den Payload eines verworfenen Inserts.
  const discardedInsertPayloads = new Map<string, Record<string, unknown>>();

  const finish = (group: Group): void => {
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
    const group = open.get(key);

    if (group === undefined) {
      // `insert -> delete -> restore` wird wieder zu einem Insert.
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
      // Der bisherige Payload wird fuer ein moegliches Restore benoetigt.
      finish(group);
      open.delete(key);
      continue;
    }

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
