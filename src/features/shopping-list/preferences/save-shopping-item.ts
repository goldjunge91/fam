import { type EnqueueMutationInput, enqueueMutations } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { debugLog } from '@/lib/debug-log';
import { buildCategoryPreferenceMutationPlan, type CategoryPreferenceMutation } from './api';
import { type CategoryFeedbackInput, categoryFeedbackMutation } from './feedback';

/**
 * Der gemeinsame local-first Save-Vertrag fuer Formularaktionen.
 *
 * `itemMutation` ist bewusst ein fertiger lokaler Item-Write. Dadurch bleibt
 * die fachliche Merge-/Update-Logik beim jeweiligen Item-Aufrufer, waehrend
 * dieser Helper die Reihenfolge und die Transaktionsgrenze zentral garantiert.
 */
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

/**
 * Speichert Artikel, Preference und optionales Feedback in genau einem
 * exklusiven SQLite-Batch. Es gibt hier absichtlich keinen Supabase-Client:
 * Netzwerk-Push und Retry passieren spaeter ausschliesslich ueber die Outbox.
 */
export async function saveShoppingItemAtomically(
  input: AtomicShoppingItemSaveInput,
): Promise<AtomicShoppingItemSaveResult> {
  debugLog('LOG  [Placement] saveShoppingItemAtomically called', {
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
