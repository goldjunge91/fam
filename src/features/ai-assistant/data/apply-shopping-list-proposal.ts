import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/lib/db/local-client';
import { enqueueMutationStepsInExclusiveTransaction } from '@/lib/db/outbox';
import {
  type AddShoppingItemInput,
  buildAddOrMergeShoppingItemMutation,
} from '@/lib/db/shopping-list-merge';
import type { AssistantProposal } from '../types';

type ShoppingListProposal = Extract<AssistantProposal, { kind: 'shopping_list_proposal.v1' }>;

/** Applies every suggested item in one local merge/outbox transaction. */
export async function applyAssistantShoppingListProposal(input: {
  userId: string;
  householdId: string;
  proposalKey: string;
  proposal: ShoppingListProposal;
}): Promise<{ addedCount: number; alreadyApplied: boolean }> {
  const db = await getDatabase();
  let addedCount = 0;
  let alreadyApplied = false;
  await enqueueMutationStepsInExclusiveTransaction(db, async (txn, append) => {
    const receipt = await txn.getFirstAsync<{ proposal_key: string }>(
      `select proposal_key from applied_assistant_shopping_proposals
       where user_id = ? and household_id = ? and proposal_key = ?`,
      [input.userId, input.householdId, input.proposalKey],
    );
    if (receipt) {
      alreadyApplied = true;
      return;
    }

    for (const item of input.proposal.items) {
      const itemInput: AddShoppingItemInput = {
        household_id: input.householdId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        product_id: null,
        category_id: null,
        category_source: null,
      };
      const mutation = await buildAddOrMergeShoppingItemMutation(
        txn,
        Crypto.randomUUID(),
        itemInput,
      );
      await append(mutation);
      addedCount += 1;
    }
    await txn.runAsync(
      `insert into applied_assistant_shopping_proposals
       (user_id, household_id, proposal_key, applied_at) values (?, ?, ?, ?)`,
      [input.userId, input.householdId, input.proposalKey, Date.now()],
    );
  });
  return { addedCount, alreadyApplied };
}
