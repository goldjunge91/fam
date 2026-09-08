export type InventoryMergeUndoPayload = {
  reversal_transaction_id: string;
  reversal_of: string;
  household_id: string;
  created_at: string;
  notes: string;
  /**
   * Nicht Teil der RPC-Argumente (der Server leitet das geoeffnete Los aus
   * reversal_of ab). Haelt die Fussabdruck-Abhaengigkeit lokal fest, damit
   * push.ts Folgeoperationen auf diesem Los zurueckhaelt, solange der
   * Merge-Undo im selben Batch offen oder dauerhaft gescheitert ist
   * (fam-lem.20).
   */
  opened_item_id: string;
};

function requiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Merge-Undo-Payload enthaelt kein gueltiges Feld ${key}.`);
  }
  return value;
}

/** Validiert den Split-Merge-Compare-and-set-Umschlag vor dem ersten Netzwerkzugriff. */
export function parseInventoryMergeUndoPayload(
  payload: Record<string, unknown>,
): InventoryMergeUndoPayload {
  return {
    reversal_transaction_id: requiredString(payload, 'reversal_transaction_id'),
    reversal_of: requiredString(payload, 'reversal_of'),
    household_id: requiredString(payload, 'household_id'),
    created_at: requiredString(payload, 'created_at'),
    notes: requiredString(payload, 'notes'),
    opened_item_id: requiredString(payload, 'opened_item_id'),
  };
}
