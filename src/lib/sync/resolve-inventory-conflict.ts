import { deleteOutboxEntries, enqueueMutationsInExclusiveTransaction } from '@/lib/db/outbox';
import type { FridgeItemConflict } from '@/lib/db/outbox-conflicts';
import type { SqlDatabase } from '@/lib/db/types';
import type { TypedSupabaseClient } from '@/lib/supabase';

import { createInventoryQuantityCorrectionMutation } from './inventory-quantity';
import { deleteMirrorRow, upsertMirrorRow } from './mirror-write';

/**
 * Ledger-IDs, die eine Mengenoperation bereits lokal in `transactions`
 * eingefuegt hat (siehe `applyLocally` der jeweiligen Builder). Verwirft
 * `discardInventoryConflict` die Outbox-Zeile, ist diese Ledgerzeile nie
 * bestaetigt worden und bleibt sonst als Phantom-Eintrag in der Historie
 * zurueck (fam-lem.25).
 */
function phantomLedgerIdsFor(op: string, payload: Record<string, unknown>): string[] {
  const field = (key: string) => (typeof payload[key] === 'string' ? [payload[key] as string] : []);
  switch (op) {
    case 'adjust_quantity':
    case 'correct_quantity':
      return field('transaction_id');
    case 'reverse_quantity':
      return field('reversal_transaction_id');
    case 'move':
      return [...field('out_transaction_id'), ...field('in_transaction_id')];
    default:
      return [];
  }
}

/**
 * Loescht die blockierten Outbox-Zeilen und ihre nie bestaetigten lokalen
 * Ledgerzeilen gemeinsam — ein Aufrufer allein wuerde sonst Phantom-Ledger
 * zurücklassen (fam-lem.25).
 */
async function deleteOutboxEntriesAndPhantomLedger(
  txn: SqlDatabase,
  sourceIds: readonly number[],
): Promise<void> {
  const outboxRows =
    sourceIds.length === 0
      ? []
      : await txn.getAllAsync<{ op: string; payload: string }>(
          `select op, payload from outbox where id in (${sourceIds.map(() => '?').join(', ')})`,
          sourceIds,
        );
  const phantomLedgerIds = outboxRows.flatMap((row) =>
    phantomLedgerIdsFor(row.op, JSON.parse(row.payload) as Record<string, unknown>),
  );

  await deleteOutboxEntries(txn, sourceIds);
  for (const ledgerId of phantomLedgerIds) {
    await deleteMirrorRow(txn, 'transactions', ledgerId);
  }
}

type CanonicalFridgeItem = {
  id: string;
  household_id: string;
  location_id: string | null;
  product_id: string | null;
  quantity: number;
};

async function fetchCanonicalFridgeItem(
  supabase: TypedSupabaseClient,
  itemId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('fridge_items')
    .select('*')
    .eq('id', itemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function asCanonicalFridgeItem(row: Record<string, unknown>): CanonicalFridgeItem | null {
  if (
    typeof row.id !== 'string' ||
    typeof row.household_id !== 'string' ||
    typeof row.quantity !== 'number'
  ) {
    return null;
  }
  return {
    id: row.id,
    household_id: row.household_id,
    location_id: typeof row.location_id === 'string' ? row.location_id : null,
    product_id: typeof row.product_id === 'string' ? row.product_id : null,
    quantity: row.quantity,
  };
}

/**
 * Verwirft den Konflikt: loescht alle davon blockierten Outbox-Zeilen des
 * Artikels und spiegelt den kanonischen Serverstand lokal, statt den
 * (moeglicherweise falschen) optimistischen Wert stehen zu lassen. Existiert
 * der Artikel serverseitig nicht mehr, wird er auch lokal entfernt.
 */
export async function discardInventoryConflict(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  conflict: FridgeItemConflict,
): Promise<void> {
  const canonical = await fetchCanonicalFridgeItem(supabase, conflict.itemId);
  await db.withExclusiveTransactionAsync(async (txn) => {
    await deleteOutboxEntriesAndPhantomLedger(txn, conflict.sourceIds);
    if (canonical) {
      await upsertMirrorRow(txn, 'fridge_items', canonical, { dirty: 0 });
    } else {
      await txn.runAsync('delete from fridge_items where id = ?', [conflict.itemId]);
    }
  });
}

export type ReconfirmResult = 'reconfirmed' | 'already-matches';

/**
 * Bestaetigt eine abgelehnte manuelle Korrektur neu: derselbe Zielwert, aber
 * mit dem gerade abgerufenen Serverbestand als frischer Vergleichsbasis statt
 * der veralteten lokalen Annahme — ein neuer Push, kein blinder Retry. Nur
 * fuer Konflikte moeglich, die `getFridgeItemConflicts` eindeutig einer
 * einzelnen Korrektur zuordnen konnte (`conflict.correction`).
 */
export async function reconfirmInventoryQuantityCorrection(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  conflict: FridgeItemConflict,
  args: { actor: string; operationId: string; transactionId: string; nowMs?: number },
): Promise<ReconfirmResult> {
  const correction = conflict.correction;
  if (!correction) {
    throw new Error('Dieser Konflikt laesst sich nicht als einzelne Korrektur neu bestaetigen.');
  }

  const canonicalRow = await fetchCanonicalFridgeItem(supabase, conflict.itemId);
  const canonical = canonicalRow ? asCanonicalFridgeItem(canonicalRow) : null;
  if (!canonical) {
    throw new Error('Aktueller Bestand konnte nicht ermittelt werden.');
  }

  const nowMs = args.nowMs ?? Date.now();
  const now = new Date(nowMs).toISOString();

  if (canonical.quantity === correction.new_quantity) {
    // Bereits am Zielwert (z. B. hat ein anderes Geraet inzwischen denselben
    // Wert gesetzt) — nichts anzuwenden, nur den Konflikt raeumen.
    await db.withExclusiveTransactionAsync(async (txn) => {
      await deleteOutboxEntriesAndPhantomLedger(txn, conflict.sourceIds);
      await upsertMirrorRow(txn, 'fridge_items', canonicalRow as Record<string, unknown>, {
        dirty: 0,
      });
    });
    return 'already-matches';
  }

  const correctionQuantity = Math.abs(correction.new_quantity - canonical.quantity);
  const correctionType = correction.new_quantity > canonical.quantity ? 'in' : 'out';

  // Alte Outbox-/Ledger-Zeilen entfernen und die neu bestaetigte Korrektur
  // einreihen in EINER exklusiven Transaktion — sonst wuerde ein Fehler
  // dazwischen die alte Absicht loeschen, ohne die neue zu ersetzen (fam-lem.25).
  await enqueueMutationsInExclusiveTransaction(db, async (txn) => {
    await deleteOutboxEntriesAndPhantomLedger(txn, conflict.sourceIds);
    return [
      createInventoryQuantityCorrectionMutation({
        payload: {
          operation_id: args.operationId,
          transaction_id: args.transactionId,
          item_id: conflict.itemId,
          household_id: canonical.household_id,
          expected_quantity: canonical.quantity,
          new_quantity: correction.new_quantity,
          created_at: now,
        },
        transaction: {
          id: args.transactionId,
          operation_id: args.operationId,
          household_id: canonical.household_id,
          fridge_item_id: conflict.itemId,
          product_id: canonical.product_id,
          actor: args.actor,
          type: correctionType,
          quantity: correctionQuantity,
          location_id: canonical.location_id,
          reason: null,
          previous_expiry_date: null,
          notes: '[Manual correction]',
          undone: false,
          created_at: now,
        },
        nowMs,
      }),
    ];
  });
  return 'reconfirmed';
}
