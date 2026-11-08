import { assertEquals } from 'jsr:@std/assert@1';

import {
  allergenIdForProfileRule,
  type IngredientAliasRecord,
  type IngredientFactRecord,
  projectRecipeAllergenSafety,
  resolveIngredientAlias,
  toReviewedRecipeIngredientMapping,
  type ReviewedRecipeIngredientMapping,
} from './ingredient-knowledge.ts';

const SOURCE_VERSION = '02011R1169-20250401';
const SOURCE_URL = 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02011R1169-20250401';
const REVIEWED_AT = '2026-11-08T10:00:00.000Z';

function mapping(
  itemId: string,
  ingredientIds: string[],
): ReviewedRecipeIngredientMapping {
  return {
    itemId,
    ingredientIds,
    status: 'verified',
    complete: true,
    source: 'curated',
    sourceId: `recipe-item:${itemId}`,
    sourceUrl: 'https://fam.local/recipe-review',
    sourceVersion: 'recipe-revision-2',
    currentSourceVersion: 'recipe-revision-2',
    license: 'User-provided recipe; review for this recipe only',
    evidenceSnapshot: `Full ingredient label for ${itemId}`,
    reviewedAt: REVIEWED_AT,
    reviewedBy: 'user-1',
  };
}

function fact(
  ingredientId: string,
  assessment: IngredientFactRecord['assessment'],
  overrides: Partial<IngredientFactRecord> = {},
): IngredientFactRecord {
  return {
    ingredientId,
    ingredientRevision: 1,
    allergenId: 'EU_10_MUSTARD',
    assessment,
    source: 'eu_lmiv',
    sourceId: 'annex-ii-point-10',
    sourceUrl: SOURCE_URL,
    sourceVersion: SOURCE_VERSION,
    license: 'EU legal document; attribution per Decision 2011/833/EU',
    reviewScope: 'Directly named ingredient class in Annex II, point 10',
    evidenceSnapshot: 'Mustard and products thereof.',
    confidence: 'verified',
    reviewedAt: REVIEWED_AT,
    reviewedBy: 'curator-1',
    ...overrides,
  };
}

function project(input: {
  expectedItemIds?: string[];
  mappings?: ReviewedRecipeIngredientMapping[];
  ingredients?: Array<{ ingredientId: string; revision: number }>;
  facts?: IngredientFactRecord[];
} = {}) {
  return projectRecipeAllergenSafety({
    expectedItemIds: input.expectedItemIds ?? ['item-1'],
    mappings: input.mappings ?? [mapping('item-1', ['mustard'])],
    ingredients: input.ingredients ?? [{ ingredientId: 'mustard', revision: 1 }],
    facts: input.facts ?? [fact('mustard', 'contains')],
    activeAllergenIds: ['EU_10_MUSTARD'],
    rulesUpdatedAt: '2026-11-08T09:00:00.000Z',
  });
}

function alias(overrides: Partial<IngredientAliasRecord> = {}): IngredientAliasRecord {
  return {
    ingredientId: 'ingredient-wheat-flour',
    alias: 'Weizenmehl',
    locale: 'de',
    source: 'eu_lmiv',
    sourceId: 'annex-ii-point-1',
    sourceUrl: SOURCE_URL,
    sourceVersion: SOURCE_VERSION,
    license: 'EU legal document; attribution per Decision 2011/833/EU',
    confidence: 'verified',
    reviewedAt: REVIEWED_AT,
    reviewedBy: 'curator-1',
    ...overrides,
  };
}

Deno.test('resolves only exact, reviewed aliases from the current source version', () => {
  assertEquals(
    resolveIngredientAlias({
      text: '  WEIZENMEHL ',
      locale: 'de',
      aliases: [alias()],
    }),
    {
      status: 'resolved',
      ingredientId: 'ingredient-wheat-flour',
      sourceIds: ['annex-ii-point-1'],
      sourceVersions: [SOURCE_VERSION],
    },
  );
  assertEquals(
    resolveIngredientAlias({
      text: 'Weizenmehl Type 405',
      locale: 'de',
      aliases: [alias()],
    }),
    { status: 'unknown', reason: 'no_exact_alias' },
  );
  assertEquals(
    resolveIngredientAlias({
      text: 'Weizenmehl',
      locale: 'de',
      aliases: [alias({ sourceVersion: 'old-version' })],
    }),
    { status: 'unknown', reason: 'stale_alias' },
  );
  assertEquals(
    resolveIngredientAlias({
      text: 'Weizenmehl',
      locale: 'de',
      aliases: [alias({ confidence: 'inferred', reviewedAt: null, reviewedBy: null })],
    }),
    { status: 'unknown', reason: 'unreviewed_alias' },
  );
});

Deno.test('maps only the EU allergy profile codes and their display labels', () => {
  assertEquals(allergenIdForProfileRule('peanuts'), 'EU_05_PEANUTS');
  assertEquals(allergenIdForProfileRule('Schalenfrüchte'), 'EU_08_NUTS');
  assertEquals(allergenIdForProfileRule('Milch / Milcheiweiß'), 'EU_07_MILK');
  assertEquals(allergenIdForProfileRule('Laktose'), null);
  assertEquals(allergenIdForProfileRule('Johannisbrot'), null);
});

Deno.test('an exact alias mapping to multiple ingredients stays ambiguous', () => {
  assertEquals(
    resolveIngredientAlias({
      text: 'Mehl',
      locale: 'de',
      aliases: [
        alias({ alias: 'Mehl' }),
        alias({ alias: 'Mehl', ingredientId: 'ingredient-rye-flour' }),
      ],
    }),
    {
      status: 'ambiguous',
      ingredientIds: ['ingredient-rye-flour', 'ingredient-wheat-flour'],
    },
  );
});

Deno.test('a current positive fact conflicts and missing evidence remains unknown', () => {
  assertEquals(project().status, 'conflict');
  assertEquals(project({ facts: [] }).status, 'unknown');
});

Deno.test('explicit current not-detected facts are required for every active allergen', () => {
  assertEquals(project({ facts: [fact('mustard', 'not_detected')] }).status, 'clear');
  assertEquals(
    project({
      expectedItemIds: ['item-1', 'item-2'],
      mappings: [mapping('item-1', ['mustard']), mapping('item-2', ['mustard-seed-oil'])],
      ingredients: [
        { ingredientId: 'mustard', revision: 1 },
        { ingredientId: 'mustard-seed-oil', revision: 1 },
      ],
      facts: [
        fact('mustard', 'not_detected'),
        fact('mustard-seed-oil', 'not_detected'),
      ],
    }).status,
    'clear',
  );
  assertEquals(
    project({
      expectedItemIds: ['item-1', 'item-2'],
      mappings: [mapping('item-1', ['mustard']), mapping('item-2', ['mustard-seed-oil'])],
      ingredients: [
        { ingredientId: 'mustard', revision: 1 },
        { ingredientId: 'mustard-seed-oil', revision: 1 },
      ],
      facts: [fact('mustard', 'not_detected')],
    }).status,
    'unknown',
  );
});

Deno.test('one reviewed recipe position can map to multiple canonical ingredients', () => {
  assertEquals(
    project({
      mappings: [mapping('item-1', ['mustard', 'mustard-seed-oil'])],
      ingredients: [
        { ingredientId: 'mustard', revision: 1 },
        { ingredientId: 'mustard-seed-oil', revision: 1 },
      ],
      facts: [fact('mustard', 'not_detected'), fact('mustard-seed-oil', 'not_detected')],
    }).status,
    'clear',
  );
});

Deno.test('partial, duplicate, stale, or incomplete position mappings remain unknown', () => {
  const completeMapping = mapping('item-1', ['mustard']);
  assertEquals(project({ mappings: [] }).status, 'unknown');
  assertEquals(
    project({
      expectedItemIds: ['item-1', 'item-2'],
      mappings: [completeMapping],
      facts: [fact('mustard', 'not_detected')],
    }).status,
    'unknown',
  );
  assertEquals(
    project({
      mappings: [completeMapping, completeMapping],
      facts: [fact('mustard', 'not_detected')],
    }).status,
    'unknown',
  );
  assertEquals(
    project({
      mappings: [{ ...completeMapping, complete: false }],
      facts: [fact('mustard', 'not_detected')],
    }).status,
    'unknown',
  );
  assertEquals(
    project({
      mappings: [{ ...completeMapping, sourceVersion: 'recipe-revision-1' }],
      facts: [fact('mustard', 'not_detected')],
    }).status,
    'unknown',
  );
});

Deno.test('stale positive facts do not become conflicts or clear findings', () => {
  assertEquals(
    project({
      facts: [fact('mustard', 'contains', { ingredientRevision: 0 })],
    }).status,
    'unknown',
  );
  assertEquals(
    project({
      facts: [fact('mustard', 'not_detected', { sourceVersion: 'old-version' })],
    }).status,
    'unknown',
  );
});

Deno.test('contradicting current facts fail as a conflict', () => {
  const result = project({
    facts: [
      fact('mustard', 'contains'),
      fact('mustard', 'not_detected', { sourceId: 'second-review' }),
    ],
  });
  assertEquals(result.status, 'conflict');
  assertEquals(result.conflictingAllergenIds, ['EU_10_MUSTARD']);
});

Deno.test('knowledge versions are deterministic and change when a mapping changes', () => {
  const first = project();
  const stable = project({
    mappings: [mapping('item-1', ['mustard'])],
    ingredients: [{ ingredientId: 'mustard', revision: 1 }],
    facts: [fact('mustard', 'contains')],
  });
  const changed = project({
    mappings: [mapping('item-1', ['mustard', 'mustard-seed-oil'])],
    ingredients: [
      { ingredientId: 'mustard', revision: 1 },
      { ingredientId: 'mustard-seed-oil', revision: 1 },
    ],
    facts: [fact('mustard', 'contains'), fact('mustard-seed-oil', 'contains')],
  });
  assertEquals(first.knowledgeVersion, stable.knowledgeVersion);
  assertEquals(first.knowledgeVersion === changed.knowledgeVersion, false);
});

Deno.test('recipe mapping adapter accepts only a review attached to the current source row', () => {
  const row = {
    id: 'item-1',
    ingredient_source_type: 'recipe_text',
    ingredient_source_id: 'recipe:3:item:1',
    ingredient_source_url: null,
    ingredient_source_version: 'recipe-revision-3',
    ingredient_source_license: null,
    ingredient_mapping: {
      version: 1,
      status: 'verified',
      ingredientIds: ['00000000-0000-4000-8000-000000000001'],
      complete: true,
      source: 'recipe_text',
      sourceId: 'recipe:3:item:1',
      sourceUrl: null,
      sourceVersion: 'recipe-revision-3',
      license: null,
      evidenceSnapshot: 'Vollständiger Quelltext der Zutat',
      reviewedAt: REVIEWED_AT,
      reviewedBy: '00000000-0000-4000-8000-000000000002',
    },
  };

  const current = toReviewedRecipeIngredientMapping(row);
  assertEquals(current.status, 'verified');
  assertEquals(current.currentSourceVersion, 'recipe-revision-3');

  const stale = toReviewedRecipeIngredientMapping({
    ...row,
    ingredient_source_version: 'recipe-revision-4',
  });
  assertEquals(stale.status, 'unknown');
  assertEquals(stale.ingredientIds, []);
});

Deno.test('keeps aliases and recipe mappings closed for wrong locale, stale source metadata, and invalid ids', () => {
  assertEquals(
    resolveIngredientAlias({
      text: 'Weizenmehl',
      locale: 'en',
      aliases: [alias()],
    }),
    { status: 'unknown', reason: 'no_exact_alias' },
  );

  const row = {
    id: 'item-1',
    ingredient_source_type: 'recipe_text',
    ingredient_source_id: 'recipe:3:item:1',
    ingredient_source_url: null,
    ingredient_source_version: 'recipe-revision-3',
    ingredient_source_license: null,
    ingredient_mapping: {
      version: 1,
      status: 'verified',
      ingredientIds: ['not-a-uuid', '00000000-0000-4000-8000-000000000001'],
      complete: true,
      source: 'recipe_text',
      sourceId: 'recipe:3:item:1',
      sourceUrl: null,
      sourceVersion: 'recipe-revision-3',
      license: null,
      evidenceSnapshot: 'Quelltext',
      reviewedAt: REVIEWED_AT,
      reviewedBy: 'user-1',
    },
  };
  const invalidIds = toReviewedRecipeIngredientMapping(row);
  assertEquals(invalidIds.status, 'verified');
  assertEquals(invalidIds.ingredientIds, []);
  assertEquals(invalidIds.complete, true);

  const mismatchedSource = toReviewedRecipeIngredientMapping({
    ...row,
    ingredient_mapping: {
      ...(row.ingredient_mapping as Record<string, unknown>),
      sourceId: 'different-source-row',
      ingredientIds: ['00000000-0000-4000-8000-000000000001'],
    },
  });
  assertEquals(mismatchedSource.status, 'unknown');
  assertEquals(mismatchedSource.ingredientIds, []);
  assertEquals(mismatchedSource.sourceId, '');
});

Deno.test('treats invalid or incomplete current fact reviews as unknown evidence', () => {
  const invalidAssessment = project({ facts: [fact('mustard', 'unknown_assessment')] });
  const missingEvidence = project({ facts: [fact('mustard', 'not_detected', { evidenceSnapshot: '' })] });
  const missingReview = project({
    facts: [fact('mustard', 'not_detected', { reviewedAt: null, reviewedBy: null })],
  });

  assertEquals(invalidAssessment.status, 'unknown');
  assertEquals(missingEvidence.status, 'unknown');
  assertEquals(missingReview.status, 'unknown');
});
