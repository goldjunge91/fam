import { assertInventoryQuantityPrecision } from '@/lib/inventory-quantity';

export type InventoryQuantityCorrectionPayload = {
  operation_id: string;
  transaction_id: string;
  item_id: string;
  household_id: string;
  expected_quantity: number;
  new_quantity: number;
  created_at: string;
};

function requiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Mengenkorrektur-Payload enthaelt kein gueltiges Feld ${key}.`);
  }
  return value;
}

function requiredQuantity(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Mengenkorrektur-Payload enthaelt keine gueltige Menge ${key}.`);
  }
  return assertInventoryQuantityPrecision(value);
}

/** Validiert den Compare-and-set-Umschlag vor dem Netzwerkzugriff. */
export function parseInventoryQuantityCorrectionPayload(
  payload: Record<string, unknown>,
): InventoryQuantityCorrectionPayload {
  const expectedQuantity = requiredQuantity(payload, 'expected_quantity');
  const newQuantity = requiredQuantity(payload, 'new_quantity');
  if (expectedQuantity < 0 || newQuantity < 0 || expectedQuantity === newQuantity) {
    throw new Error('Mengenkorrektur braucht zwei unterschiedliche, nicht negative Mengen.');
  }

  return {
    operation_id: requiredString(payload, 'operation_id'),
    transaction_id: requiredString(payload, 'transaction_id'),
    item_id: requiredString(payload, 'item_id'),
    household_id: requiredString(payload, 'household_id'),
    expected_quantity: expectedQuantity,
    new_quantity: newQuantity,
    created_at: requiredString(payload, 'created_at'),
  };
}
