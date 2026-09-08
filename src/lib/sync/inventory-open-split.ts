import { fromInventoryQuantityUnits, toInventoryQuantityUnits } from '@/lib/inventory-quantity';

export type InventorySplitPayload = {
  transaction_id: string;
  source_item_id: string;
  opened_item_id: string;
  household_id: string;
  expected_source_quantity: number;
  open_quantity: number;
  opened_at: string;
  new_expiry_date: string | null;
  expiry_user_set: boolean;
  created_at: string;
};

function requiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Split-Payload enthaelt kein gueltiges Feld ${key}.`);
  }
  return value;
}

function requiredQuantity(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Split-Payload enthaelt keine gueltige Menge ${key}.`);
  }
  return fromInventoryQuantityUnits(toInventoryQuantityUnits(value));
}

function requiredBoolean(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (typeof value !== 'boolean') {
    throw new Error(`Split-Payload enthaelt kein gueltiges Feld ${key}.`);
  }
  return value;
}

/** Validiert den Split-Compare-and-set-Umschlag vor dem ersten Netzwerkzugriff. */
export function parseInventorySplitPayload(
  payload: Record<string, unknown>,
): InventorySplitPayload {
  const expectedSourceQuantity = requiredQuantity(payload, 'expected_source_quantity');
  const openQuantity = requiredQuantity(payload, 'open_quantity');
  if (expectedSourceQuantity <= 0 || openQuantity <= 0 || openQuantity > expectedSourceQuantity) {
    throw new Error('Die Öffnungsmenge muss größer als 0 und höchstens die Ausgangsmenge sein.');
  }

  const newExpiryDateRaw = payload.new_expiry_date;
  if (newExpiryDateRaw !== null && typeof newExpiryDateRaw !== 'string') {
    throw new Error('Split-Payload enthaelt kein gueltiges Feld new_expiry_date.');
  }

  const parsed: InventorySplitPayload = {
    transaction_id: requiredString(payload, 'transaction_id'),
    source_item_id: requiredString(payload, 'source_item_id'),
    opened_item_id: requiredString(payload, 'opened_item_id'),
    household_id: requiredString(payload, 'household_id'),
    expected_source_quantity: expectedSourceQuantity,
    open_quantity: openQuantity,
    opened_at: requiredString(payload, 'opened_at'),
    new_expiry_date: newExpiryDateRaw,
    expiry_user_set: requiredBoolean(payload, 'expiry_user_set'),
    created_at: requiredString(payload, 'created_at'),
  };

  if (parsed.source_item_id === parsed.opened_item_id) {
    throw new Error('Split-Payload braucht zwei unterschiedliche Bestands-IDs.');
  }
  return parsed;
}
