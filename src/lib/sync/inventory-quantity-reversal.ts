export type InventoryQuantityReversalPayload = {
  reversal_transaction_id: string;
  reversal_of: string;
  item_id: string;
  household_id: string;
  created_at: string;
  notes: string;
};

function requiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Mengen-Undo-Payload enthaelt kein gueltiges Feld ${key}.`);
  }
  return value;
}

export function parseInventoryQuantityReversalPayload(
  payload: Record<string, unknown>,
): InventoryQuantityReversalPayload {
  return {
    reversal_transaction_id: requiredString(payload, 'reversal_transaction_id'),
    reversal_of: requiredString(payload, 'reversal_of'),
    item_id: requiredString(payload, 'item_id'),
    household_id: requiredString(payload, 'household_id'),
    created_at: requiredString(payload, 'created_at'),
    notes: requiredString(payload, 'notes'),
  };
}
