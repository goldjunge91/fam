import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
import {
  type InventoryQuantityCorrectionPayload,
  parseInventoryQuantityCorrectionPayload,
} from '@/lib/sync/inventory-quantity-correction';

import type { OutboxOp, SqlDatabase } from './types';

/** Mengenoperationen auf `fridge_items` — koennen serverseitig dauerhaft abgelehnt werden (siehe push.ts). */
const QUANTITY_OPS: readonly OutboxOp[] = [
  'adjust_quantity',
  'correct_quantity',
  'reverse_quantity',
  'move',
];

export type FridgeItemConflict = {
  itemId: string;
  /** Alle Outbox-Zeilen dieses Artikels, die durch den Konflikt blockiert sind. */
  sourceIds: number[];
  lastError: string;
  /**
   * Nur gesetzt, wenn sich der gesamte Konflikt eindeutig auf eine einzelne
   * manuelle Korrektur zurueckfuehren laesst (genau eine blockierte Zeile,
   * op 'correct_quantity'). Nur dann bietet die UI "neu bestaetigen" an —
   * bei mehreren verketteten Operationen oder anderen Op-Typen ist der
   * naechste gueltige Zielwert nicht eindeutig, dort bleibt nur "verwerfen".
   */
  correction: InventoryQuantityCorrectionPayload | null;
};

type ConflictRow = {
  id: number;
  op: OutboxOp;
  payload: string;
  attempts: number;
  last_error: string | null;
};

/**
 * Liest alle Artikel mit dauerhaft gescheiterter Mengenoperation (siehe
 * `push.ts` `blockedItemIds`). Fasst pro Artikel alle blockierten Outbox-
 * Zeilen zusammen, damit eine Aufloesung (verwerfen/bestaetigen) sie
 * gemeinsam raeumt statt nur die zuerst gescheiterte Zeile.
 */
export async function getFridgeItemConflicts(db: SqlDatabase): Promise<FridgeItemConflict[]> {
  const placeholders = QUANTITY_OPS.map(() => '?').join(', ');
  const conflictedItems = await db.getAllAsync<{ entity_id: string }>(
    `select distinct entity_id
       from outbox
      where entity = 'fridge_items'
        and op in (${placeholders})
        and attempts >= ?`,
    [...QUANTITY_OPS, MAX_ATTEMPTS],
  );
  if (conflictedItems.length === 0) return [];

  const conflicts: FridgeItemConflict[] = [];
  for (const { entity_id } of conflictedItems) {
    const rows = await db.getAllAsync<ConflictRow>(
      `select id, op, payload, attempts, last_error
         from outbox
        where entity = 'fridge_items' and entity_id = ?
        order by id asc`,
      [entity_id],
    );
    const terminal = rows.find((row) => row.attempts >= MAX_ATTEMPTS) ?? rows[0];

    let correction: InventoryQuantityCorrectionPayload | null = null;
    if (rows.length === 1 && terminal.op === 'correct_quantity') {
      try {
        correction = parseInventoryQuantityCorrectionPayload(JSON.parse(terminal.payload));
      } catch {
        correction = null;
      }
    }

    conflicts.push({
      itemId: entity_id,
      sourceIds: rows.map((row) => row.id),
      lastError: terminal.last_error ?? 'Unbekannter Fehler.',
      correction,
    });
  }
  return conflicts;
}
