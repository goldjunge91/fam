import { getModelExecutionProfile } from './config.ts';

export const COOKING_SUGGESTION_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'cooking_suggestion_v1',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['schema_version', 'meals'],
      properties: {
        schema_version: { type: 'integer', const: 1 },
        meals: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'title',
              'source',
              'recipe_id',
              'servings',
              'used_items',
              'additional_ingredients',
              'steps',
              'notes',
            ],
            properties: {
              title: { type: 'string', minLength: 1 },
              source: { type: 'string', enum: ['catalog', 'template', 'model_generated'] },
              recipe_id: {
                oneOf: [{ type: 'string', minLength: 1 }, { type: 'null' }],
              },
              servings: { type: 'integer', minimum: 1 },
              used_items: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['inventory_item_id', 'quantity', 'unit'],
                  properties: {
                    inventory_item_id: { type: 'string', minLength: 1 },
                    quantity: { type: 'number', exclusiveMinimum: 0 },
                    unit: { type: 'string', minLength: 1 },
                  },
                },
              },
              additional_ingredients: {
                type: 'array',
                maxItems: 2,
                items: { type: 'string', minLength: 1 },
              },
              steps: {
                type: 'array',
                minItems: 1,
                items: { type: 'string', minLength: 1 },
              },
              notes: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
} as const;

export type OpenRouterMessage = { role: 'system' | 'user'; content: string };

export function createOpenRouterChatBody(input: {
  model: string;
  messages: OpenRouterMessage[];
  maxTokens?: number;
  temperature?: number;
}): Record<string, unknown> {
  const profile = getModelExecutionProfile(input.model);
  return {
    model: input.model,
    messages: input.messages,
    temperature: input.temperature ?? profile.temperature,
    max_tokens: input.maxTokens ?? profile.maxTokens,
    response_format: COOKING_SUGGESTION_RESPONSE_FORMAT,
    ...(profile.reasoning ? { reasoning: profile.reasoning } : {}),
  };
}
