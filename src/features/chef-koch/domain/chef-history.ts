import { z } from 'zod';

import {
  type RecipeSuggestionResponse,
  recipeSuggestionResponseSchema,
} from '@/features/recipes/domain/recipe-suggestions';

export const CHEF_HISTORY_CONTINUATION_WINDOW_MS = 48 * 60 * 60 * 1000;
export const CHEF_HISTORY_PAGE_SIZE = 50;
export const CHEF_HISTORY_TURN_PAGE_SIZE = 100;

const nonBlankStringSchema = z.string().trim().min(1);
const timestampSchema = z.iso.datetime({ offset: true });

export const chefRequestPayloadSchema = z.strictObject({
  schema_version: z.literal(1),
  user_text: nonBlankStringSchema.max(8000),
  servings: z.number().int().min(1).max(100).nullable(),
  max_minutes: z.number().int().min(1).max(1440).nullable(),
  dietary_pattern: nonBlankStringSchema.max(8000).nullable(),
  shopping_decision: z.enum(['yes', 'no']).nullable(),
  selected_inventory_item_ids: z.array(nonBlankStringSchema).max(100),
});

export const chefResponsePayloadSchema = z
  .strictObject({
    schema_version: z.literal(1),
    skill: z.literal('fam-cook-from-inventory'),
    model: nonBlankStringSchema,
    generated_at: timestampSchema,
    priority_food_count: z.number().int().nonnegative(),
    shopping_question: nonBlankStringSchema.nullable(),
    result: recipeSuggestionResponseSchema.nullable(),
  })
  .superRefine((value, context) => {
    if ((value.result === null) === (value.shopping_question === null)) {
      context.addIssue({
        code: 'custom',
        path: ['result'],
        message: 'result and shopping_question must be mutually exclusive',
      });
    }
  });

export const chefUsedItemSnapshotSchema = z.strictObject({
  inventory_item_id: nonBlankStringSchema,
  name: nonBlankStringSchema,
  quantity: z.number().positive(),
  unit: nonBlankStringSchema,
});

export const chefRecipeHistoryPayloadSchema = z.strictObject({
  schema_version: z.literal(1),
  response: recipeSuggestionResponseSchema,
  used_item_snapshots: z.array(chefUsedItemSnapshotSchema),
});

export const chefConversationRowSchema = z.strictObject({
  id: nonBlankStringSchema,
  household_id: nonBlankStringSchema,
  created_by: nonBlankStringSchema.nullable(),
  created_at: timestampSchema,
  last_activity_at: timestampSchema,
  continued_from_id: nonBlankStringSchema.nullable(),
  updated_at: timestampSchema,
});

export const chefConversationTurnRowSchema = z.strictObject({
  id: nonBlankStringSchema,
  conversation_id: nonBlankStringSchema,
  household_id: nonBlankStringSchema,
  created_by: nonBlankStringSchema.nullable(),
  client_request_id: nonBlankStringSchema,
  request_fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  user_text: nonBlankStringSchema.max(8000),
  request_payload: chefRequestPayloadSchema,
  response_payload: chefResponsePayloadSchema,
  created_at: timestampSchema,
});

export const chefRecipeHistoryRowSchema = z.strictObject({
  id: nonBlankStringSchema,
  conversation_id: nonBlankStringSchema,
  turn_id: nonBlankStringSchema,
  household_id: nonBlankStringSchema,
  title: nonBlankStringSchema.max(8000),
  recipe_payload: chefRecipeHistoryPayloadSchema,
  created_at: timestampSchema,
});

export const chefHistoryHydrationSchema = z
  .strictObject({
    schema_version: z.literal(1),
    replayed: z.boolean(),
    conversation: chefConversationRowSchema,
    turn: chefConversationTurnRowSchema,
    recipe_history: z.array(chefRecipeHistoryRowSchema).max(1),
  })
  .superRefine((hydration, context) => {
    if (hydration.turn.conversation_id !== hydration.conversation.id) {
      context.addIssue({
        code: 'custom',
        path: ['turn', 'conversation_id'],
        message: 'turn must belong to the hydrated conversation',
      });
    }
    if (hydration.turn.household_id !== hydration.conversation.household_id) {
      context.addIssue({
        code: 'custom',
        path: ['turn', 'household_id'],
        message: 'turn must belong to the hydrated household',
      });
    }

    const expectedRecipeHistoryCount = hydration.turn.response_payload.result === null ? 0 : 1;
    if (hydration.recipe_history.length !== expectedRecipeHistoryCount) {
      context.addIssue({
        code: 'custom',
        path: ['recipe_history'],
        message: 'recipe history must match the response result',
      });
    }

    for (const [index, recipe] of hydration.recipe_history.entries()) {
      if (recipe.conversation_id !== hydration.conversation.id) {
        context.addIssue({
          code: 'custom',
          path: ['recipe_history', index, 'conversation_id'],
          message: 'recipe history must belong to the hydrated conversation',
        });
      }
      if (recipe.turn_id !== hydration.turn.id) {
        context.addIssue({
          code: 'custom',
          path: ['recipe_history', index, 'turn_id'],
          message: 'recipe history must belong to the hydrated turn',
        });
      }
      if (recipe.household_id !== hydration.conversation.household_id) {
        context.addIssue({
          code: 'custom',
          path: ['recipe_history', index, 'household_id'],
          message: 'recipe history must belong to the hydrated household',
        });
      }
      if (
        JSON.stringify(recipe.recipe_payload.response) !==
        JSON.stringify(hydration.turn.response_payload.result)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['recipe_history', index, 'recipe_payload', 'response'],
          message: 'recipe history response must match the turn response',
        });
      }
    }
  });

export type ChefRequestPayload = z.infer<typeof chefRequestPayloadSchema>;
export type ChefResponsePayload = z.infer<typeof chefResponsePayloadSchema>;
export type ChefConversationTurnView = ChefConversationTurn & {
  recipe_history_id: string | null;
};

export type ChefRecipeHistoryPayload = z.infer<typeof chefRecipeHistoryPayloadSchema>;
export type ChefConversationRow = z.infer<typeof chefConversationRowSchema>;
export type ChefConversationTurn = z.infer<typeof chefConversationTurnRowSchema>;
export type ChefRecipeHistoryRow = z.infer<typeof chefRecipeHistoryRowSchema>;
export type ChefHistoryHydration = z.infer<typeof chefHistoryHydrationSchema>;

export type ChefConversation = Omit<ChefConversationRow, 'updated_at'>;

export type ChefConversationSummary = ChefConversation & {
  first_user_text: string;
};

export type ChefHistoryCursor = {
  timestamp: string;
  id: string;
};

export type ChefHistoryPage<T> = {
  items: T[];
  nextCursor: ChefHistoryCursor | null;
};

export function canContinueChefConversation(
  conversation: Pick<ChefConversationRow, 'last_activity_at'>,
  now: Date = new Date(),
): boolean {
  const lastActivity = Date.parse(conversation.last_activity_at);
  const elapsed = now.getTime() - lastActivity;
  return (
    Number.isFinite(lastActivity) && elapsed >= 0 && elapsed <= CHEF_HISTORY_CONTINUATION_WINDOW_MS
  );
}

export function createContinuationInput(
  conversation: Pick<ChefConversationRow, 'id' | 'last_activity_at'>,
  now: Date = new Date(),
): { continuedFromConversationId: string } {
  if (!canContinueChefConversation(conversation, now)) {
    throw new Error('chef_conversation_continuation_expired');
  }
  return { continuedFromConversationId: conversation.id };
}

export function cursorAfter<T extends { id: string }>(
  items: readonly T[],
  timestampOf: (item: T) => string,
  pageSize: number,
): ChefHistoryCursor | null {
  if (items.length < pageSize) return null;
  const last = items.at(-1);
  return last === undefined ? null : { timestamp: timestampOf(last), id: last.id };
}

export function recipeHistoryTitle(result: RecipeSuggestionResponse): string {
  const titles = result.meals.map((meal) => meal.title);
  if (titles.length <= 2) return titles.join(' und ');
  return `${titles[0]}, ${titles[1]} und ${titles.length - 2} weitere`;
}
