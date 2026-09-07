import { assertEquals, assertThrows } from 'jsr:@std/assert@1';

import {
  allergenIdForProfileRule,
  buildCatalogRecipeAllergenProjections,
  buildRecipeAllergenProjection,
  EU_ALLERGEN_IDS,
  normalizeCuratedImport,
  normalizeFoodOnImport,
  normalizeIngredientKnowledgeImport,
  normalizeOpenFoodFactsImport,
  normalizeTaxonomyImport,
  recipeHasAllergenConflict,
} from './ingredient-knowledge.ts';

const provenance = {
  sourceUrl: 'https://example.test/source',
  sourceVersion: '2026-01',
  license: 'example-license',
};

Deno.test('normalizes FoodOn identity without changing provider IDs', () => {
  const result = normalizeIngredientKnowledgeImport({
    source: 'foodon',
    sourceId: 'FOODON:00001234',
    canonicalName: 'Mozzarella',
    foodonId: 'FOODON:00001234',
    allergenResolution: 'unknown',
    ...provenance,
    aliases: [{ alias: 'Mozzarella-Käse', locale: 'de', sourceId: 'FOODON:alias:mozzarella' }],
    mappings: [],
  });

  assertEquals(result.ingredient.source, 'foodon');
  assertEquals(result.ingredient.sourceId, 'FOODON:00001234');
  assertEquals(result.ingredient.foodonId, 'FOODON:00001234');
  assertEquals(result.aliases[0]?.sourceId, 'FOODON:alias:mozzarella');
  assertEquals(result.ingredient.allergenResolution, 'unknown');
  assertEquals(result.ingredient.allergenReviewedAt, null);
});

Deno.test('normalizes OFF evidence and preserves mapping provenance', () => {
  const result = normalizeOpenFoodFactsImport({
    source: 'open_food_facts',
    sourceId: 'off:product:123',
    canonicalName: 'Mozzarella',
    allergenResolution: 'mapped',
    ...provenance,
    aliases: [],
    mappings: [{
      allergenId: 'EU_07_MILK',
      relation: 'contains',
      sourceId: 'off:product:123:milk',
      confidence: 'external',
    }],
  });

  assertEquals(result.mappings, [{
    allergenId: 'EU_07_MILK',
    relation: 'contains',
    source: 'open_food_facts',
    sourceId: 'off:product:123:milk',
    sourceUrl: provenance.sourceUrl,
    sourceVersion: provenance.sourceVersion,
    license: provenance.license,
    confidence: 'external',
    reviewedAt: null,
  }]);
  assertEquals(result.ingredient.allergenResolution, 'mapped');
});

Deno.test('allows curated mapping evidence on a FoodOn ingredient identity', () => {
  const result = normalizeFoodOnImport({
    source: 'foodon',
    sourceId: 'FOODON:00001234',
    canonicalName: 'Mozzarella',
    allergenResolution: 'mapped',
    ...provenance,
    aliases: [],
    mappings: [{
      source: 'curated',
      sourceId: 'fam:mozzarella-milk',
      sourceUrl: 'https://fam.example/knowledge/mozzarella',
      sourceVersion: '2026-01',
      license: 'fam-curated',
      allergenId: 'EU_07_MILK',
      relation: 'contains',
      confidence: 'verified',
      reviewedAt: '2026-09-05T10:00:00.000Z',
    }],
  });

  assertEquals(result.mappings[0]?.source, 'curated');
  assertEquals(result.mappings[0]?.license, 'fam-curated');
});

Deno.test('provider adapters reject data assigned to the wrong provider', () => {
  assertEquals(normalizeFoodOnImport({
    source: 'foodon',
    sourceId: 'FOODON:00001234',
    canonicalName: 'Mozzarella',
    allergenResolution: 'unknown',
    ...provenance,
    aliases: [],
    mappings: [],
  }).ingredient.source, 'foodon');
  assertEquals(normalizeCuratedImport({
    source: 'curated',
    sourceId: 'fam:mozzarella',
    canonicalName: 'Mozzarella',
    allergenResolution: 'unknown',
    ...provenance,
    aliases: [],
    mappings: [],
  }).ingredient.source, 'curated');
  assertThrows(() => normalizeFoodOnImport({
    source: 'open_food_facts',
    sourceId: 'off:product:123',
    canonicalName: 'Mozzarella',
    allergenResolution: 'unknown',
    ...provenance,
    aliases: [],
    mappings: [],
  }));
});

Deno.test('normalizes the EU taxonomy as a separate provider contract', () => {
  const result = normalizeTaxonomyImport({
    source: 'eu_lmiv',
    id: 'EU_07_MILK',
    canonicalName: 'Milch',
    legalCode: 'annex-ii-07',
    sourceId: 'annex-ii-07',
    ...provenance,
  });

  assertEquals(result.id, 'EU_07_MILK');
  assertEquals(result.source, 'eu_lmiv');
  assertEquals(EU_ALLERGEN_IDS.length, 14);
});

Deno.test('rejects an EU taxonomy record used as an ingredient identity', () => {
  assertThrows(() => normalizeIngredientKnowledgeImport({
    source: 'eu_lmiv',
    sourceId: 'annex-ii-07',
    canonicalName: 'Milch',
    allergenResolution: 'unknown',
    ...provenance,
    aliases: [],
    mappings: [],
  }));
});

Deno.test('rejects missing provenance and unknown allergen IDs', () => {
  assertThrows(() => normalizeIngredientKnowledgeImport({
    source: 'foodon',
    sourceId: 'FOODON:00009999',
    canonicalName: 'Unbekannt',
    allergenResolution: 'unknown',
    sourceUrl: provenance.sourceUrl,
    sourceVersion: '',
    license: provenance.license,
    aliases: [],
    mappings: [],
  }));

  assertThrows(() => normalizeIngredientKnowledgeImport({
    source: 'curated',
    sourceId: 'fam:unknown-allergen',
    canonicalName: 'Testzutat',
    allergenResolution: 'mapped',
    ...provenance,
    aliases: [],
    mappings: [{
      allergenId: 'EU_99_UNKNOWN',
      relation: 'contains',
      sourceId: 'fam:unknown-allergen:mapping',
      confidence: 'verified',
      reviewedAt: '2026-09-05T10:00:00.000Z',
    }],
  }));
});

Deno.test('rejects unsafe resolution claims and unreviewed verified mappings', () => {
  assertThrows(() => normalizeIngredientKnowledgeImport({
    source: 'curated',
    sourceId: 'fam:clear-with-mapping',
    canonicalName: 'Testzutat',
    allergenResolution: 'clear',
    ...provenance,
    aliases: [],
    mappings: [{
      allergenId: 'EU_07_MILK',
      relation: 'contains',
      sourceId: 'fam:clear-with-mapping:milk',
      confidence: 'verified',
      reviewedAt: '2026-09-05T10:00:00.000Z',
    }],
  }));

  assertThrows(() => normalizeIngredientKnowledgeImport({
    source: 'curated',
    sourceId: 'fam:unreviewed',
    canonicalName: 'Testzutat',
    allergenResolution: 'mapped',
    ...provenance,
    aliases: [],
    mappings: [{
      allergenId: 'EU_07_MILK',
      relation: 'contains',
      sourceId: 'fam:unreviewed:milk',
      confidence: 'verified',
    }],
  }));

  assertThrows(() => normalizeIngredientKnowledgeImport({
    source: 'curated',
    sourceId: 'fam:unreviewed-clear',
    canonicalName: 'Testzutat',
    allergenResolution: 'clear',
    ...provenance,
    aliases: [],
    mappings: [],
  }));
});

Deno.test('maps standardized profile allergies without treating dislikes as allergies', () => {
  assertEquals(allergenIdForProfileRule('milk'), 'EU_07_MILK');
  assertEquals(allergenIdForProfileRule('lactose'), 'EU_07_MILK');
  assertEquals(allergenIdForProfileRule('not-a-taxonomy-rule'), null);
  assertEquals(recipeHasAllergenConflict(['EU_07_MILK'], ['milk']), true);
  assertEquals(recipeHasAllergenConflict(['EU_01_GLUTEN_CEREALS'], ['milk']), false);
  assertEquals(recipeHasAllergenConflict([], ['milk']), false);
});

Deno.test('fails closed for unknown profile rules and incomplete recipe evidence', () => {
  assertEquals(recipeHasAllergenConflict([], ['custom-allergy']), true);
  assertEquals(recipeHasAllergenConflict(null, ['milk']), true);
  assertEquals(recipeHasAllergenConflict(['EU_07_MILK'], []), false);
});

Deno.test('projects recipe allergens only from reviewed, complete evidence', () => {
  assertEquals(buildRecipeAllergenProjection([
    { allergenResolution: 'clear', allergenReviewedAt: '2026-09-05T10:00:00.000Z', mappings: [] },
    {
      allergenResolution: 'mapped',
      allergenReviewedAt: null,
      mappings: [{
        allergenId: 'EU_07_MILK',
        relation: 'contains',
        confidence: 'verified',
        reviewedAt: '2026-09-05T10:00:00.000Z',
      }],
    },
  ]), ['EU_07_MILK']);
  assertEquals(buildRecipeAllergenProjection([{
    allergenResolution: 'mapped',
    allergenReviewedAt: null,
    mappings: [{
      allergenId: 'EU_07_MILK',
      relation: 'may_contain',
      confidence: 'verified',
      reviewedAt: '2026-09-05T10:00:00.000Z',
    }],
  }]), ['EU_07_MILK']);
});

Deno.test('does not turn external, inferred, or unreviewed evidence into safety', () => {
  const evidence = {
    allergenResolution: 'mapped' as const,
    allergenReviewedAt: null,
    mappings: [{
      allergenId: 'EU_07_MILK' as const,
      relation: 'contains' as const,
      confidence: 'external' as const,
      reviewedAt: null,
    }],
  };
  assertEquals(buildRecipeAllergenProjection([evidence]), null);
  assertEquals(buildRecipeAllergenProjection([{
    ...evidence,
    mappings: [{ ...evidence.mappings[0], confidence: 'inferred' as const }],
  }]), null);
  assertEquals(buildRecipeAllergenProjection([{
    allergenResolution: 'clear',
    allergenReviewedAt: null,
    mappings: [],
  }]), null);
});

Deno.test('projects catalog recipe allergens from explicit item links only', () => {
  const projections = buildCatalogRecipeAllergenProjections(
    ['recipe-safe', 'recipe-unknown'],
    [
      { catalogItemId: 'item-safe-milk', recipeId: 'recipe-safe', ingredientId: 'ingredient-milk' },
      { catalogItemId: 'item-safe-tomato', recipeId: 'recipe-safe', ingredientId: 'ingredient-tomato' },
      { catalogItemId: 'item-unknown', recipeId: 'recipe-unknown', ingredientId: 'ingredient-missing' },
    ],
    [
      { id: 'ingredient-milk', allergenResolution: 'mapped', allergenReviewedAt: null },
      { id: 'ingredient-tomato', allergenResolution: 'clear', allergenReviewedAt: '2026-09-05T10:00:00.000Z' },
    ],
    [{
      ingredientId: 'ingredient-milk',
      allergenId: 'EU_07_MILK',
      relation: 'contains',
      confidence: 'verified',
      reviewedAt: '2026-09-05T10:00:00.000Z',
    }],
  );

  assertEquals(projections.get('recipe-safe'), ['EU_07_MILK']);
  assertEquals(projections.get('recipe-unknown'), null);
});
