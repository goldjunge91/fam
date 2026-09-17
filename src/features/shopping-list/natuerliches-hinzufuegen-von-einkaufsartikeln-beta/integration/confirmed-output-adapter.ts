import { enqueueMutationStepsInExclusiveTransaction } from '@/lib/db/outbox';
import {
  type AddShoppingItemInput,
  buildAddOrMergeShoppingItemMutation,
} from '@/lib/db/shopping-list-merge';
import type { SqlDatabase } from '@/lib/db/types';
import type { ConfirmedBetaOutput, ParsedShoppingItem } from '../types';

export type SaveConfirmedBetaOutputInput = {
  db: SqlDatabase;
  householdId: string;
  output: unknown;
  createItemId: () => string;
};

export type SaveConfirmedBetaOutputResult = {
  savedItemCount: number;
  mutationCount: number;
  itemIds: readonly string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isParsedShoppingItem(value: unknown): value is ParsedShoppingItem {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.quantity === 'number' &&
    Number.isFinite(value.quantity) &&
    value.quantity > 0 &&
    isStringOrNull(value.unit) &&
    isStringOrNull(value.brand)
  );
}

function isConfirmedBetaOutput(value: unknown): value is ConfirmedBetaOutput {
  return (
    isRecord(value) &&
    typeof value.betaSessionId === 'string' &&
    value.betaSessionId.trim().length > 0 &&
    (value.source === 'text' || value.source === 'speech') &&
    Array.isArray(value.items) &&
    value.items.every(
      (entry) =>
        isRecord(entry) &&
        entry.confirmation === 'confirmed' &&
        isParsedShoppingItem(entry.item) &&
        typeof entry.targetListId === 'string' &&
        entry.targetListId.trim().length > 0,
    )
  );
}

function toShoppingItemInput(
  householdId: string,
  outputItem: ConfirmedBetaOutput['items'][number],
): AddShoppingItemInput {
  return {
    household_id: householdId,
    name: outputItem.item.name.trim(),
    quantity: outputItem.item.quantity,
    unit: outputItem.item.unit ?? 'piece',
    store_id: outputItem.targetListId.trim(),
  };
}

export async function saveConfirmedBetaOutput(
  input: SaveConfirmedBetaOutputInput,
): Promise<SaveConfirmedBetaOutputResult> {
  if (!input.householdId.trim()) {
    throw new Error(
      'Confirmed Beta output may contain only confirmed items with valid target lists',
    );
  }
  if (!isConfirmedBetaOutput(input.output)) {
    throw new Error(
      'Confirmed Beta output may contain only confirmed items with valid target lists',
    );
  }

  const output = input.output;
  if (output.items.length === 0) {
    return { savedItemCount: 0, mutationCount: 0, itemIds: [] };
  }

  const mutations: Awaited<ReturnType<typeof buildAddOrMergeShoppingItemMutation>>[] = [];
  await enqueueMutationStepsInExclusiveTransaction(input.db, async (txn, append) => {
    for (const outputItem of output.items) {
      const itemId = input.createItemId();
      if (!itemId.trim()) throw new Error('Confirmed Beta output requires non-empty item ids');
      const mutation = await buildAddOrMergeShoppingItemMutation(
        txn,
        itemId,
        toShoppingItemInput(input.householdId.trim(), outputItem),
      );
      await append(mutation);
      mutations.push(mutation);
    }
  });

  return {
    savedItemCount: output.items.length,
    mutationCount: mutations.length,
    itemIds: mutations.map((mutation) => mutation.entityId),
  };
}
