import { getModelExecutionProfile } from './config.ts';

// OpenRouter soll bei Kochvorschlägen nur dieses feste Antwortformat erzeugen.
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

// OpenRouter soll bei Inventarerfassung nur ein unverbindliches Proposal erzeugen.
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
              quantity: {
                oneOf: [{ type: 'number' }, { type: 'null' }],
              },
              unit: {
                oneOf: [{ type: 'string' }, { type: 'null' }],
              },
              perishability: {
                type: 'string',
                enum: ['perishable', 'non_perishable', 'unknown'],
              },
              storage: {
                type: 'string',
                enum: ['fridge', 'freezer', 'pantry', 'unknown'],
              },
              date: {
                oneOf: [{ type: 'string' }, { type: 'null' }],
              },
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

export type OpenRouterMessage = { role: 'system' | 'user'; content: string };

// Baut den Provider-Request und wählt das passende JSON-Schema für den Skill.
export function createOpenRouterChatBody(input: {
  model: string;
  messages: OpenRouterMessage[];
  skill?: 'fam-cook-from-inventory' | 'fam-inventory-capture';
  maxTokens?: number;
  temperature?: number;
}): Record<string, unknown> {
  // Das Modellprofil liefert Temperatur, Token-Limit und optionales Reasoning.
  const profile = getModelExecutionProfile(input.model);
  const responseFormat =
    input.skill === 'fam-inventory-capture'
      ? INVENTORY_CAPTURE_RESPONSE_FORMAT
      : COOKING_SUGGESTION_RESPONSE_FORMAT;
  return {
    model: input.model,
    messages: input.messages,
    temperature: input.temperature ?? profile.temperature,
    max_tokens: input.maxTokens ?? profile.maxTokens,
    response_format: responseFormat,
    ...(profile.reasoning ? { reasoning: profile.reasoning } : {}),
  };
}
