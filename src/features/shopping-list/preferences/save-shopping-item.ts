import { type EnqueueMutationInput, enqueueMutations } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { debugLog } from '@/lib/debug-log';
import { buildCategoryPreferenceMutationPlan, type CategoryPreferenceMutation } from './api';
import { type CategoryFeedbackInput, categoryFeedbackMutation } from './feedback';

export type AtomicShoppingItemSaveInput = {
  db: SqlDatabase;
  itemMutation: EnqueueMutationInput;
  preference?: CategoryPreferenceMutation;
  feedback?: CategoryFeedbackInput;
  nowMs?: number;
};

export type AtomicShoppingItemSaveResult = {
  preferenceId: string | null;
  preferenceChanged: boolean;
  mutationCount: number;
};

export async function saveShoppingItemAtomically(
  input: AtomicShoppingItemSaveInput,
): Promise<AtomicShoppingItemSaveResult> {
  debugLog(' [Placement]  ℹ️ saveShoppingItemAtomically called', {
    hasPreference: !!input.preference,
    preference: input.preference,
    hasFeedback: !!input.feedback,
  });
  const nowMs = input.nowMs ?? Date.now();
  const preferencePlan = input.preference
    ? await buildCategoryPreferenceMutationPlan(input.db, input.preference, nowMs)
    : null;
  const feedbackMutation =
    input.feedback && (preferencePlan === null || preferencePlan.changed)
      ? categoryFeedbackMutation(input.feedback, nowMs)
      : null;
  const mutations = [
    input.itemMutation,
    ...(preferencePlan?.mutations ?? []),
    ...(feedbackMutation ? [feedbackMutation] : []),
  ] as const;

  await enqueueMutations(input.db, mutations);

  return {
    preferenceId: preferencePlan?.id ?? null,
    preferenceChanged: preferencePlan?.changed ?? false,
    mutationCount: mutations.length,
  };
}
