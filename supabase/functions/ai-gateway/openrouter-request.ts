import { getModelExecutionProfile } from './config.ts';
import type { RecipeSuggestionContext } from './recipe-suggestion-contract.ts';

export const COOKING_SUGGESTION_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'recipe_suggestion_v1',
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
              source: {
                type: 'string',
                enum: ['catalog', 'template', 'model_generated'],
              },
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

export function createCookingSuggestionResponseFormat(context: RecipeSuggestionContext) {
  const schema = COOKING_SUGGESTION_RESPONSE_FORMAT.json_schema.schema;
  const mealSchema = schema.properties.meals.items;
  const usedItemsSchema = mealSchema.properties.used_items;
  const candidateRecipeIds = context.candidate_recipes.map(({ id }) => id);
  const candidateSources = [
    ...new Set(
      context.candidate_recipes.map(({ source }) => source),
    ),
  ];
  const inventoryItemIds = context.priority_foods.map(({ inventory_item_id }) => inventory_item_id);
  const allowedAdditionalIngredients = [
    ...new Set([
      ...context.constraints.allowed_staples,
      ...context.planned_shopping_items.map(({ name }) => name),
    ]),
  ];

  return {
    type: 'json_schema',
    json_schema: {
      ...COOKING_SUGGESTION_RESPONSE_FORMAT.json_schema,
      schema: {
        ...schema,
        properties: {
          ...schema.properties,
          meals: {
            ...schema.properties.meals,
            items: {
              ...mealSchema,
              properties: {
                ...mealSchema.properties,
                source: candidateSources.length === 0
                  ? { type: 'string', const: 'model_generated' }
                  : { type: 'string', enum: candidateSources },
                recipe_id: candidateRecipeIds.length === 0
                  ? { type: 'null' }
                  : { type: 'string', enum: candidateRecipeIds },
                used_items: {
                  ...usedItemsSchema,
                  ...(inventoryItemIds.length === 0 ? { maxItems: 0 } : {}),
                  items: {
                    ...usedItemsSchema.items,
                    properties: {
                      ...usedItemsSchema.items.properties,
                      inventory_item_id: inventoryItemIds.length === 0
                        ? { type: 'string', minLength: 1 }
                        : { type: 'string', enum: inventoryItemIds },
                    },
                  },
                },
                additional_ingredients: {
                  ...mealSchema.properties.additional_ingredients,
                  ...(allowedAdditionalIngredients.length === 0 ? { maxItems: 0 } : {}),
                  items: allowedAdditionalIngredients.length === 0
                    ? { type: 'string', minLength: 1 }
                    : { type: 'string', enum: allowedAdditionalIngredients },
                },
              },
            },
          },
        },
      },
    },
  } as const;
}

export const INVENTORY_CAPTURE_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'inventory_capture_proposal_v1',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'items', 'questions', 'warnings'],
      properties: {
        kind: { type: 'string', const: 'inventory_capture_proposal.v1' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'rawText',
              'normalizedName',
              'quantity',
              'unit',
              'perishability',
              'storage',
              'date',
              'dateKind',
              'confidence',
              'evidence',
              'missingFields',
            ],
            properties: {
              rawText: { type: 'string', minLength: 1 },
              normalizedName: { type: 'string', minLength: 1 },
              quantity: { oneOf: [{ type: 'number' }, { type: 'null' }] },
              unit: { oneOf: [{ type: 'string' }, { type: 'null' }] },
              perishability: {
                type: 'string',
                enum: ['perishable', 'non_perishable', 'unknown'],
              },
              storage: {
                type: 'string',
                enum: ['fridge', 'freezer', 'pantry', 'unknown'],
              },
              date: { oneOf: [{ type: 'string' }, { type: 'null' }] },
              dateKind: {
                oneOf: [
                  { type: 'string', enum: ['best_before', 'use_by'] },
                  { type: 'null' },
                ],
              },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              evidence: { type: 'string', minLength: 1 },
              missingFields: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['quantity', 'unit', 'storage', 'date'],
                },
              },
            },
          },
        },
        questions: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
        },
        warnings: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
        },
      },
    },
  },
} as const;

const JSON_OBJECT_RESPONSE_FORMAT = { type: 'json_object' } as const;
const GEMMA_FREE_MODELS = new Set([
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
]);

export type OpenRouterMessage = {
  role: 'system' | 'user';
  content: string;
};

export type OpenRouterCompletionResult =
  | { ok: true; content: string; model: string; usage?: unknown }
  | { ok: false; error: 'provider_empty_response' | 'provider_model_missing' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseOpenRouterChatCompletion(value: unknown): OpenRouterCompletionResult {
  if (!isRecord(value)) return { ok: false, error: 'provider_empty_response' };

  const firstChoice = Array.isArray(value.choices) ? value.choices[0] : undefined;
  const message = isRecord(firstChoice) ? firstChoice.message : undefined;
  const content = isRecord(message) ? message.content : undefined;
  if (typeof content !== 'string' || content.trim().length === 0) {
    return { ok: false, error: 'provider_empty_response' };
  }

  if (typeof value.model !== 'string' || value.model.trim().length === 0) {
    return { ok: false, error: 'provider_model_missing' };
  }

  return {
    ok: true,
    content,
    model: value.model,
    ...(value.usage === undefined ? {} : { usage: value.usage }),
  };
}

const MAX_GATEWAY_OUTPUT_TOKENS = 8_192;

function validMaxTokens(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= MAX_GATEWAY_OUTPUT_TOKENS;
}

function validTemperature(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 2;
}

export function createOpenRouterChatBody(input: {
  model: string;
  messages: OpenRouterMessage[];
  skill?: 'fam-cook-from-inventory' | 'fam-inventory-capture';
  recipeSuggestionContext?: RecipeSuggestionContext;
  maxTokens?: number;
  temperature?: number;
}) {
  const profile = getModelExecutionProfile(input.model);
  const maxTokens = input.maxTokens ?? profile.maxTokens;
  const temperature = input.temperature ?? profile.temperature;
  if (!validMaxTokens(maxTokens)) {
    throw new RangeError(`maxTokens must be between 1 and ${MAX_GATEWAY_OUTPUT_TOKENS}`);
  }
  if (!validTemperature(temperature)) {
    throw new RangeError('temperature must be between 0 and 2');
  }

  const responseFormat = GEMMA_FREE_MODELS.has(input.model)
    ? JSON_OBJECT_RESPONSE_FORMAT
    : input.skill === 'fam-inventory-capture'
    ? INVENTORY_CAPTURE_RESPONSE_FORMAT
    : input.recipeSuggestionContext === undefined
    ? COOKING_SUGGESTION_RESPONSE_FORMAT
    : createCookingSuggestionResponseFormat(input.recipeSuggestionContext);

  return {
    model: input.model,
    messages: input.messages,
    temperature,
    max_tokens: maxTokens,
    response_format: responseFormat,
    provider: { require_parameters: true },
    ...(profile.reasoning === undefined ? {} : { reasoning: profile.reasoning }),
  };
}
