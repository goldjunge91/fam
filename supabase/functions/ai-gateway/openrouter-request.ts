import {
  AI_GATEWAY_FLOWS,
  DEFAULT_AI_GATEWAY_PROVIDER,
  MAX_GATEWAY_OUTPUT_TOKENS,
  resolveAiGatewayFlowConfig,
} from './config.ts';
import type { RecipeSuggestionContext } from './recipe-suggestion-contract.ts';

const usedItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['inventory_item_id', 'quantity', 'unit'],
  properties: {
    inventory_item_id: { type: 'string', minLength: 1 },
    quantity: { type: 'number', exclusiveMinimum: 0 },
    unit: { type: 'string', minLength: 1 },
  },
} as const;

const shoppingNeedSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'quantity', 'unit'],
  properties: {
    name: { type: 'string', minLength: 1 },
    quantity: { type: 'number', exclusiveMinimum: 0 },
    unit: { type: 'string', minLength: 1 },
  },
} as const;

const mealSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'source',
    'recipe_id',
    'servings',
    'used_items',
    'shopping_needs',
    'additional_ingredients',
    'steps',
    'notes',
  ],
  properties: {
    title: { type: 'string', minLength: 1 },
    source: { type: 'string', enum: ['catalog', 'template', 'model_generated'] },
    recipe_id: { oneOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] },
    servings: { type: 'integer', minimum: 1 },
    used_items: {
      type: 'array',
      items: usedItemSchema,
    },
    shopping_needs: {
      type: 'array',
      maxItems: 2,
      items: shoppingNeedSchema,
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
} as const;

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
          items: mealSchema,
        },
      },
    },
  },
} as const;

export function createCookingSuggestionResponseFormat(context: RecipeSuggestionContext) {
  const schema = COOKING_SUGGESTION_RESPONSE_FORMAT.json_schema.schema;
  const candidateRecipeIds = context.candidate_recipes.map(({ id }) => id);
  const candidateSources = [...new Set(context.candidate_recipes.map(({ source }) => source))];
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
                  ...mealSchema.properties.used_items,
                  ...(inventoryItemIds.length === 0 ? { maxItems: 0 } : {}),
                  items: {
                    ...usedItemSchema,
                    properties: {
                      ...usedItemSchema.properties,
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

export type OpenRouterMessage = {
  role: 'system' | 'user';
  content: string;
};

function validMaxTokens(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= MAX_GATEWAY_OUTPUT_TOKENS;
}

function validTemperature(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 2;
}

export function createOpenRouterChatBody(input: {
  model: string;
  messages: OpenRouterMessage[];
  recipeSuggestionContext?: RecipeSuggestionContext;
  maxTokens?: number;
  temperature?: number;
}) {
  const cookingConfig = resolveAiGatewayFlowConfig(AI_GATEWAY_FLOWS.cookingFromInventory, {
    provider: DEFAULT_AI_GATEWAY_PROVIDER,
    model: input.model,
  });
  const maxTokens = input.maxTokens ?? cookingConfig.maxTokens;
  const temperature = input.temperature ?? cookingConfig.temperature;
  if (!validMaxTokens(maxTokens)) {
    throw new RangeError(`maxTokens must be between 1 and ${MAX_GATEWAY_OUTPUT_TOKENS}`);
  }
  if (!validTemperature(temperature)) {
    throw new RangeError('temperature must be between 0 and 2');
  }

  return {
    model: input.model,
    messages: input.messages,
    temperature,
    max_tokens: maxTokens,
    response_format: input.recipeSuggestionContext === undefined
      ? COOKING_SUGGESTION_RESPONSE_FORMAT
      : createCookingSuggestionResponseFormat(input.recipeSuggestionContext),
    provider: { require_parameters: true },
  } as const;
}
