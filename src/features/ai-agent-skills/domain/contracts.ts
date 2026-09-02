import { z } from 'zod';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const idSchema = z.string().trim().min(1);

export const inventoryCaptureInputSchema = z
  .object({
    text: z.string().trim().min(1),
    locale: z.literal('de-DE'),
    householdId: idSchema,
    now: z.string().datetime({ offset: true }),
  })
  .strict();

export const cookingInputSchema = z
  .object({
    householdId: idSchema,
    servings: z.number().int().positive().nullable(),
    maxMinutes: z.number().int().positive().nullable(),
    dietaryPattern: z.string().trim().min(1).nullable(),
    allergies: z.array(z.string().trim().min(1)),
  })
  .strict();

const inventoryCaptureItemSchema = z
  .object({
    rawText: z.string().trim().min(1),
    normalizedName: z.string().trim().min(1).nullable(),
    quantity: z.number().nonnegative().nullable(),
    unit: z.string().trim().min(1).nullable(),
    perishability: z.enum(['perishable', 'non_perishable', 'unknown']),
    storage: z.enum(['fridge', 'freezer', 'pantry', 'unknown']),
    date: dateSchema,
    dateKind: z.enum(['best_before', 'use_by', 'unknown']).nullable(),
    confidence: z.number().min(0).max(1),
    evidence: z.string().trim().min(1),
    missingFields: z.array(z.enum(['quantity', 'unit', 'storage', 'date'])),
  })
  .strict();

export const inventoryCaptureProposalSchema = z
  .object({
    kind: z.literal('inventory_capture_proposal.v1'),
    items: z.array(inventoryCaptureItemSchema),
    questions: z.array(z.string()),
    warnings: z.array(z.string()),
  })
  .strict();

export const perishableInventoryContextLotSchema = z
  .object({
    lotId: idSchema,
    productId: idSchema.nullable(),
    normalizedName: z.string().trim().min(1),
    quantity: z.number().nonnegative().nullable(),
    unit: z.string().trim().min(1).nullable(),
    bestBefore: dateSchema,
    useBy: dateSchema,
    storage: z.enum(['fridge', 'freezer', 'pantry', 'unknown']),
  })
  .strict();

export const perishableInventoryContextSchema = z
  .object({
    source: z.literal('inventory'),
    fetchedAt: z.string().datetime({ offset: true }),
    lots: z.array(perishableInventoryContextLotSchema),
  })
  .strict();

export const cookingSuggestionSchema = z
  .object({
    kind: z.literal('cooking_suggestion.v1'),
    recipeId: idSchema,
    title: z.string().trim().min(1),
    usedLots: z.array(idSchema),
    missingIngredients: z.array(z.string().trim().min(1)),
    estimatedMinutes: z.number().int().positive().nullable(),
    servings: z.number().int().positive().nullable(),
    rationale: z.string().trim().min(1),
    constraintChecks: z
      .object({
        allergies: z.literal('pass'),
        dietaryPattern: z.enum(['pass', 'unknown']),
        time: z.enum(['pass', 'unknown']),
      })
      .strict(),
  })
  .strict();

/**
 * Request envelope for the authenticated AI gateway. The household scope is
 * supplied by the app's active household and must be re-checked by the
 * gateway before any context is built.
 */
export const aiGatewayRequestSchema = z.discriminatedUnion('skill', [
  z
    .object({
      skill: z.literal('fam-inventory-capture'),
      householdId: idSchema,
      text: z.string().trim().min(1),
      locale: z.literal('de-DE'),
      model: idSchema.optional(),
    })
    .strict(),
  z
    .object({
      skill: z.literal('fam-cook-from-inventory'),
      householdId: idSchema,
      userText: z.string().trim().min(1),
      servings: z.number().int().positive().nullable(),
      maxMinutes: z.number().int().positive().nullable(),
      dietaryPattern: z.string().trim().min(1).nullable(),
      allergies: z.array(z.string().trim().min(1)),
      model: idSchema.optional(),
    })
    .strict(),
]);

const gatewayResponseBaseSchema = {
  requestId: idSchema,
  model: idSchema,
  generatedAt: z.string().datetime({ offset: true }).optional(),
  usage: z.unknown().optional(),
} as const;

export const aiGatewayResponseSchema = z.discriminatedUnion('skill', [
  z
    .object({
      ...gatewayResponseBaseSchema,
      skill: z.literal('fam-inventory-capture'),
      result: inventoryCaptureProposalSchema,
    })
    .strict(),
  z
    .object({
      ...gatewayResponseBaseSchema,
      skill: z.literal('fam-cook-from-inventory'),
      result: cookingSuggestionSchema,
    })
    .strict(),
]);

export type InventoryCaptureProposal = z.infer<typeof inventoryCaptureProposalSchema>;
export type PerishableInventoryContext = z.infer<typeof perishableInventoryContextSchema>;
export type CookingSuggestion = z.infer<typeof cookingSuggestionSchema>;
export type InventoryCaptureInput = z.infer<typeof inventoryCaptureInputSchema>;
export type CookingInput = z.infer<typeof cookingInputSchema>;
export type AiGatewayRequest = z.infer<typeof aiGatewayRequestSchema>;
export type AiGatewayResponse = z.infer<typeof aiGatewayResponseSchema>;
