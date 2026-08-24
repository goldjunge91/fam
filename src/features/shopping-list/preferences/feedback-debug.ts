import { debugLog } from '@/lib/debug-log';
import type { CategoryPreferenceMutation } from './api';
import type { CategoryFeedbackInput } from './feedback';

/** Minimalauszug, der sowohl für `CategoryFeedbackInput` (Edit) als auch für
 * `CategoryFeedbackDraft` (Add, noch ohne `shoppingListItemId`) passt. */
type CategoryFeedbackTraceSlice = Pick<CategoryFeedbackInput, 'eventType' | 'preferenceScope'>;

/**
 * Dev-only Trace für das `shopping-category-feedback-alpha`-Flag: zeigt, ob
 * die vom Klassifikator vorhergesagte Zone, die tatsächlich gespeicherte Zone
 * und das daraus abgeleitete Feedback-Event konsistent zueinander stehen.
 * Ueber `debugLog()` an `__DEV__` und `EXPO_PUBLIC_DEBUG_LOGS` gekoppelt.
 */
export function logCategoryFeedbackAlphaTrace(input: {
  origin: 'add_form' | 'edit_form';
  featureFlagEnabled: boolean;
  predictedPlacementZone: string | null;
  savedPlacementZone: string | null;
  savedCategorySource: string;
  preference: CategoryPreferenceMutation | undefined;
  feedback: CategoryFeedbackTraceSlice | undefined;
}): void {
  debugLog(`[shopping-category-feedback-alpha:${input.origin}]`, {
    flagEnabled: input.featureFlagEnabled,
    predictedPlacementZone: input.predictedPlacementZone,
    savedPlacementZone: input.savedPlacementZone,
    savedCategorySource: input.savedCategorySource,
    preference: input.preference
      ? { type: input.preference.type, keyType: input.preference.input.keyType }
      : null,
    feedback: input.feedback
      ? { eventType: input.feedback.eventType, preferenceScope: input.feedback.preferenceScope }
      : null,
  });
}
