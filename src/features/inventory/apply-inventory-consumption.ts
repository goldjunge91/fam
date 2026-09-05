import { getDatabase } from '@/lib/db/client';
import { enqueueMutations, type EnqueueMutationInput } from '@/lib/db/outbox';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import {
  buildInventoryOutcomeTelemetry,
  type InventoryOutcomeTelemetry,
} from './inventory-outcome';

export type InventoryConsumptionPlanItem = {
  id: string;
  household_id: string;
  delta: number;
  operation: 'consume';
};

export type AppliedInventoryConsumption = {
  id: string;
  depleted: boolean;
  outcomeTelemetry: InventoryOutcomeTelemetry;
};

/**
 * Applies a confirmed consumption plan as one local/outbox transaction.
 * The current local quantity is checked again so a stale review cannot
 * silently overdraw the inventory.
 */
export async function applyInventoryConsumptionPlan(
  plan: readonly InventoryConsumptionPlanItem[],
): Promise<AppliedInventoryConsumption[]> {
  if (plan.length === 0) return [];

  const ids = new Set<string>();
  const db = await getDatabase();
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const mutations: EnqueueMutationInput[] = [];
  const applied: AppliedInventoryConsumption[] = [];

  for (const item of plan) {
    if (ids.has(item.id)) throw new Error('inventory_consumption_plan_duplicate_item');
    ids.add(item.id);

    if (!Number.isFinite(item.delta) || item.delta >= 0) {
      throw new Error('inventory_consumption_plan_invalid_delta');
    }

    const existing = await db.getFirstAsync<{
      quantity: number;
      unit: string;
      household_id: string;
    }>('select quantity, unit, household_id from fridge_items where id = ?', [item.id]);

    if (existing === null) throw new Error('inventory_item_missing');
    if (existing.household_id !== item.household_id) throw new Error('inventory_household_mismatch');
    if (!Number.isFinite(existing.quantity) || existing.quantity < 0) {
      throw new Error('inventory_quantity_invalid');
    }

    const newQuantity = existing.quantity + item.delta;
    if (newQuantity < -Number.EPSILON) throw new Error('inventory_quantity_changed');

    const boundedQuantity = Math.max(0, newQuantity);
    if (boundedQuantity === 0) {
      mutations.push({
        entity: 'fridge_items',
        entityId: item.id,
        op: 'delete',
        payload: { id: item.id, household_id: item.household_id, deleted_at: now, updated_at: now },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'fridge_items', 'delete', { id: item.id }, nowMs),
      });
    } else {
      mutations.push({
        entity: 'fridge_items',
        entityId: item.id,
        op: 'update',
        payload: {
          id: item.id,
          household_id: item.household_id,
          quantity: boundedQuantity,
          updated_at: now,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'fridge_items',
            'update',
            { id: item.id, quantity: boundedQuantity },
            nowMs,
          ),
      });
    }

    applied.push({
      id: item.id,
      depleted: boundedQuantity === 0,
      outcomeTelemetry: buildInventoryOutcomeTelemetry(Math.abs(item.delta), existing.unit),
    });
  }

  await enqueueMutations(db, mutations);
  return applied;
}
