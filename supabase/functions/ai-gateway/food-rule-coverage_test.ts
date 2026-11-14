import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import type {
  EuAllergenId,
  IngredientAliasRecord,
  RecipeAllergenProjection,
} from './ingredient-knowledge.ts';
import {
  fingerprintRecipeIngredientMappings,
  type FoodRuleRecipeEvidence,
  type FoodRuleSet,
  resolveFoodRuleCoverage,
} from './food-rule-coverage.ts';

const ALLERGEN_IDS: EuAllergenId[] = [
  'EU_01_GLUTEN_CEREALS',
  'EU_02_CRUSTACEANS',
  'EU_03_EGGS',
  'EU_04_FISH',
  'EU_05_PEANUTS',
  'EU_06_SOYBEANS',
  'EU_07_MILK',
  'EU_08_NUTS',
  'EU_09_CELERY',
  'EU_10_MUSTARD',
  'EU_11_SESAME',
  'EU_12_SULPHITES',
  'EU_13_LUPIN',
  'EU_14_MOLLUSCS',
];

const SOURCE_VERSION = '02011R1169-20250401';
const RULES_UPDATED_AT = '2026-11-08T10:00:00.000Z';

function projection(
  allergenIds: EuAllergenId[],
  overrides: Partial<RecipeAllergenProjection> = {},
): RecipeAllergenProjection {
  return {
    status: 'clear',
    allergenIds,
    conflictingAllergenIds: [],
    unknownAllergenIds: [],
    rulesUpdatedAt: RULES_UPDATED_AT,
    knowledgeVersion: 'allergen-knowledge-v3',
    ...overrides,
  };
}

function alias(overrides: Partial<IngredientAliasRecord> = {}): IngredientAliasRecord {
  return {
    ingredientId: 'ingredient-oats',
    alias: 'Hafer',
    locale: 'de',
    source: 'eu_lmiv',
    sourceId: 'annex-ii-point-1:term:Hafer',
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:02011R1169-20250401',
    sourceVersion: SOURCE_VERSION,
    license: 'EU legislative text; reuse with attribution per 2011/833/EU',
    confidence: 'verified',
    reviewedAt: '2026-11-08T10:00:00.000Z',
    reviewedBy: 'curator-1',
    ...overrides,
  };
}

function rules(overrides: Partial<FoodRuleSet> = {}): FoodRuleSet {
  return { updatedAt: RULES_UPDATED_AT, ...overrides };
}

function recipe(overrides: Partial<FoodRuleRecipeEvidence> = {}): FoodRuleRecipeEvidence {
  return {
    allergenProjection: projection(ALLERGEN_IDS),
    ingredientDataComplete: true,
    canonicalIngredientMappingComplete: true,
    canonicalIngredientIds: ['ingredient-rice'],
    ...overrides,
  };
}

Deno.test('covers all fourteen profile allergy codes against their matching EU evidence', () => {
  const codes = [
    'gluten-containing-cereals',
    'crustaceans',
    'eggs',
    'fish',
    'peanuts',
    'soybeans',
    'milk',
    'tree-nuts',
    'celery',
    'mustard',
    'sesame',
    'sulphur-dioxide-sulphites',
    'lupin',
    'molluscs',
  ];
  const result = resolveFoodRuleCoverage({
    rules: rules({ allergyCodes: codes }),
    recipe: recipe(),
    aliases: [],
  });

  assertEquals(result.status, 'clear');
  assertEquals(result.entries.length, 14);
  assertEquals(result.entries.every((entry) => entry.category === 'allergy_code'), true);
  assertEquals(result.entries.every((entry) => entry.status === 'clear'), true);
  assertEquals(result.rulesUpdatedAt, RULES_UPDATED_AT);
  assertEquals(result.knowledgeVersion, 'allergen-knowledge-v3');
  assertStringIncludes(result.coverageVersion, RULES_UPDATED_AT);
});

Deno.test('milk allergy uses the EU milk group while lactose intolerance remains unsupported', () => {
  const milkProjection = projection(['EU_07_MILK']);
  const milk = resolveFoodRuleCoverage({
    rules: rules({ allergyCodes: ['milk'] }),
    recipe: recipe({ allergenProjection: milkProjection }),
    aliases: [],
  });
  const lactose = resolveFoodRuleCoverage({
    rules: rules({ intoleranceCodes: ['lactose'] }),
    recipe: recipe({ allergenProjection: milkProjection }),
    aliases: [],
  });

  assertEquals(milk.status, 'clear');
  assertEquals(lactose.status, 'unsupported');
  assertEquals(lactose.entries[0]?.reason, 'unsupported_intolerance_evidence');
});

Deno.test('recognized custom EU allergy labels use EU projection without reaching alias matching', () => {
  const result = resolveFoodRuleCoverage({
    rules: rules({ customAllergies: ['Milch / Milcheiweiß'] }),
    recipe: recipe({ allergenProjection: projection(['EU_07_MILK']) }),
    aliases: [],
  });

  assertEquals(result.status, 'clear');
  assertEquals(result.entries, [{
    category: 'custom_allergy',
    status: 'clear',
    reason: 'reviewed_allergen_clear',
  }]);
});

Deno.test('an exact reviewed custom allergy alias checks canonical recipe ingredients', () => {
  const clear = resolveFoodRuleCoverage({
    rules: rules({ customAllergies: ['  HAFER '] }),
    recipe: recipe({ canonicalIngredientIds: ['ingredient-rice', 'ingredient-wheat'] }),
    aliases: [alias()],
  });
  const conflict = resolveFoodRuleCoverage({
    rules: rules({ customAllergies: ['Hafer'] }),
    recipe: recipe({ canonicalIngredientIds: ['ingredient-oats'] }),
    aliases: [alias()],
  });

  assertEquals(clear.status, 'clear');
  assertEquals(clear.aliasSourceVersions, [SOURCE_VERSION]);
  assertEquals(conflict.status, 'conflict');
  assertEquals(conflict.entries[0]?.reason, 'canonical_ingredient_conflict');
});

Deno.test('an exact reviewed disliked-food alias remains separate from allergy rules', () => {
  const result = resolveFoodRuleCoverage({
    rules: rules({ dislikedFoods: ['Hafer'] }),
    recipe: recipe({ canonicalIngredientIds: ['ingredient-rice', 'ingredient-oats'] }),
    aliases: [alias()],
  });

  assertEquals(result.status, 'conflict');
  assertEquals(result.entries[0]?.category, 'disliked_food');
});

Deno.test('unresolved, ambiguous, stale, and incomplete custom mappings fail closed', () => {
  const unresolved = resolveFoodRuleCoverage({
    rules: rules({ customAllergies: ['Unbekanntes Lebensmittel'] }),
    recipe: recipe(),
    aliases: [alias()],
  });
  const ambiguous = resolveFoodRuleCoverage({
    rules: rules({ dislikedFoods: ['Hafer'] }),
    recipe: recipe(),
    aliases: [alias(), alias({ ingredientId: 'ingredient-another-oat' })],
  });
  const stale = resolveFoodRuleCoverage({
    rules: rules({ customAllergies: ['Hafer'] }),
    recipe: recipe(),
    aliases: [alias({ sourceVersion: 'older-source-version' })],
  });
  const incomplete = resolveFoodRuleCoverage({
    rules: rules({ dislikedFoods: ['Hafer'] }),
    recipe: recipe({ canonicalIngredientMappingComplete: false }),
    aliases: [alias()],
  });

  assertEquals(unresolved.status, 'unsupported');
  assertEquals(unresolved.entries[0]?.reason, 'custom_rule_not_mapped');
  assertEquals(ambiguous.status, 'unsupported');
  assertEquals(ambiguous.entries[0]?.reason, 'custom_rule_mapping_ambiguous');
  assertEquals(stale.status, 'unknown');
  assertEquals(stale.entries[0]?.reason, 'custom_rule_mapping_stale');
  assertEquals(incomplete.status, 'unknown');
  assertEquals(incomplete.entries[0]?.reason, 'recipe_ingredient_mapping_incomplete');
});

Deno.test('all standard and custom intolerance categories stay unsupported without quantity facts', () => {
  const result = resolveFoodRuleCoverage({
    rules: rules({
      intoleranceCodes: [
        'lactose',
        'fructose-malabsorption',
        'sorbitol-malabsorption',
        'celiac-gluten',
      ],
      customIntolerances: ['mein individuelles Limit'],
    }),
    recipe: recipe(),
    aliases: [alias({ alias: 'mein individuelles Limit' })],
  });

  assertEquals(result.status, 'unsupported');
  assertEquals(result.entries.length, 5);
  assertEquals(result.entries.every((entry) => entry.status === 'unsupported'), true);
  assertEquals(
    result.entries.every((entry) => entry.reason === 'unsupported_intolerance_evidence'),
    true,
  );
});

Deno.test('unknown or stale EU projections and changed rule versions are never clear', () => {
  const noProjection = resolveFoodRuleCoverage({
    rules: rules({ allergyCodes: ['peanuts'] }),
    recipe: recipe({ allergenProjection: undefined }),
    aliases: [],
  });
  const staleProjection = resolveFoodRuleCoverage({
    rules: rules({ allergyCodes: ['peanuts'], updatedAt: '2026-11-08T11:00:00.000Z' }),
    recipe: recipe(),
    aliases: [],
  });
  const conflict = resolveFoodRuleCoverage({
    rules: rules({ allergyCodes: ['peanuts'] }),
    recipe: recipe({
      allergenProjection: projection(['EU_05_PEANUTS'], {
        status: 'conflict',
        conflictingAllergenIds: ['EU_05_PEANUTS'],
      }),
    }),
    aliases: [],
  });

  assertEquals(noProjection.status, 'unknown');
  assertEquals(staleProjection.status, 'unknown');
  assertEquals(conflict.status, 'conflict');
  assertEquals(staleProjection.rulesUpdatedAt, '2026-11-08T11:00:00.000Z');
  assertEquals(staleProjection.coverageVersion === noProjection.coverageVersion, false);
});

Deno.test('an active rule without a version cannot produce clear coverage', () => {
  const result = resolveFoodRuleCoverage({
    rules: rules({ allergyCodes: ['peanuts'], updatedAt: null }),
    recipe: recipe({
      allergenProjection: projection(['EU_05_PEANUTS'], { rulesUpdatedAt: null }),
    }),
    aliases: [],
  });

  assertEquals(result.status, 'unknown');
  assertEquals(result.entries[0]?.reason, 'rule_version_unavailable');
});

Deno.test('coverage never contains free private labels', () => {
  const privateLabel = 'Meine sehr private Allergie';
  const result = resolveFoodRuleCoverage({
    rules: rules({
      customAllergies: [privateLabel],
      customIntolerances: [privateLabel],
      dislikedFoods: [privateLabel],
    }),
    recipe: recipe(),
    aliases: [],
  });

  assertEquals(JSON.stringify(result).includes(privateLabel), false);
});

Deno.test('mapping evidence version changes with mapping/source edits and exposes no snapshots', async () => {
  const privateSnapshot = 'private recipe note: substitute the family ingredient';
  const item = {
    itemId: 'recipe-item-1',
    mappingStatus: 'verified',
    submittedMappingStatus: 'verified',
    ingredientIds: ['ingredient-rice', 'ingredient-oats'],
    complete: true,
    mappingSource: 'curated',
    mappingSourceId: 'review-1',
    mappingSourceUrl: 'https://fam.local/recipe-review',
    mappingSourceVersion: 'recipe-revision-2',
    currentSourceVersion: 'recipe-revision-2',
    rowSource: 'curated',
    rowSourceId: 'review-1',
    rowSourceUrl: 'https://fam.local/recipe-review',
    rowSourceVersion: 'recipe-revision-2',
    rowLicense: 'User-provided recipe; review for this recipe only',
    mappingLicense: 'User-provided recipe; review for this recipe only',
    reviewedAt: '2026-11-08T10:00:00.000Z',
    reviewedBy: 'user-1',
    evidenceSnapshot: privateSnapshot,
  };
  const mappingVersion = await fingerprintRecipeIngredientMappings([item]);
  const sortedMappingVersion = await fingerprintRecipeIngredientMappings([{
    ...item,
    ingredientIds: [...item.ingredientIds].reverse(),
  }]);
  const sourceVersion = await fingerprintRecipeIngredientMappings([{
    ...item,
    rowSourceVersion: 'recipe-revision-3',
    currentSourceVersion: 'recipe-revision-3',
    mappingSourceVersion: 'recipe-revision-3',
  }]);
  const mappingStatus = await fingerprintRecipeIngredientMappings([{
    ...item,
    mappingStatus: 'unknown',
    submittedMappingStatus: 'pending',
  }]);
  const coverage = resolveFoodRuleCoverage({
    rules: rules({ customAllergies: ['Hafer'] }),
    recipe: recipe({ ingredientMappingVersion: mappingVersion }),
    aliases: [alias()],
  });
  const changedCoverage = resolveFoodRuleCoverage({
    rules: rules({ customAllergies: ['Hafer'] }),
    recipe: recipe({ ingredientMappingVersion: sourceVersion }),
    aliases: [alias()],
  });

  assertEquals(mappingVersion.startsWith('sha256:'), true);
  assertEquals(mappingVersion === sortedMappingVersion, true);
  assertEquals(mappingVersion === sourceVersion, false);
  assertEquals(mappingVersion === mappingStatus, false);
  assertEquals(mappingVersion.includes(privateSnapshot), false);
  assertEquals(JSON.stringify(coverage).includes(privateSnapshot), false);
  assertEquals(coverage.coverageVersion === changedCoverage.coverageVersion, false);
});

Deno.test('keeps unknown rule codes, invalid rule versions, and wrong-language aliases closed', () => {
  const unknownCode = resolveFoodRuleCoverage({
    rules: rules({ allergyCodes: ['future-allergy-code'] }),
    recipe: recipe(),
    aliases: [],
  });
  assertEquals(unknownCode.status, 'unsupported');
  assertEquals(unknownCode.entries, [{
    category: 'allergy_code',
    ruleCode: 'future-allergy-code',
    status: 'unsupported',
    reason: 'unsupported_rule_code',
  }]);

  const invalidVersion = resolveFoodRuleCoverage({
    rules: rules({ allergyCodes: ['peanuts'], updatedAt: 'not-a-timestamp' }),
    recipe: recipe({ allergenProjection: projection(['EU_05_PEANUTS']) }),
    aliases: [],
  });
  assertEquals(invalidVersion.status, 'unknown');
  assertEquals(invalidVersion.entries[0]?.reason, 'rule_version_unavailable');

  const wrongLanguage = resolveFoodRuleCoverage({
    rules: rules({ customAllergies: ['Weizenmehl'] }),
    recipe: recipe({ canonicalIngredientIds: ['ingredient-wheat-flour'] }),
    aliases: [alias({ locale: 'en' })],
  });
  assertEquals(wrongLanguage.status, 'unsupported');
  assertEquals(wrongLanguage.entries[0]?.reason, 'custom_rule_not_mapped');
});

Deno.test('combines allergy, custom-food, intolerance, and disliked rules with conflict precedence', () => {
  const result = resolveFoodRuleCoverage({
    rules: rules({
      allergyCodes: ['peanuts'],
      customAllergies: ['Hafer'],
      intoleranceCodes: ['lactose'],
      dislikedFoods: ['Zucker'],
    }),
    recipe: recipe({
      allergenProjection: projection(['EU_05_PEANUTS']),
      canonicalIngredientIds: ['ingredient-oats'],
    }),
    aliases: [
      alias(),
      alias({ alias: 'Zucker', ingredientId: 'ingredient-sugar' }),
    ],
  });

  assertEquals(result.status, 'conflict');
  assertEquals(result.entries.map((entry) => [entry.category, entry.status]), [
    ['allergy_code', 'clear'],
    ['custom_allergy', 'conflict'],
    ['intolerance_code', 'unsupported'],
    ['disliked_food', 'clear'],
  ]);
});

Deno.test('conflict takes precedence when a supported rule also has a conflicting projection', () => {
  const result = resolveFoodRuleCoverage({
    rules: rules({ allergyCodes: ['peanuts'], intoleranceCodes: ['lactose'] }),
    recipe: recipe({
      allergenProjection: projection(['EU_05_PEANUTS'], {
        conflictingAllergenIds: ['EU_05_PEANUTS'],
      }),
    }),
    aliases: [],
  });

  assertEquals(result.status, 'conflict');
  assertEquals(result.entries[0]?.reason, 'reviewed_allergen_conflict');
  assertEquals(result.entries[1]?.reason, 'unsupported_intolerance_evidence');
});

Deno.test('requires complete current alias provenance before a private mapping can be clear', () => {
  const missingSourceId = resolveFoodRuleCoverage({
    rules: rules({ customAllergies: ['Hafer'] }),
    recipe: recipe({ canonicalIngredientIds: ['ingredient-oats'] }),
    aliases: [alias({ sourceId: '' })],
  });
  const missingLicense = resolveFoodRuleCoverage({
    rules: rules({ customAllergies: ['Hafer'] }),
    recipe: recipe({ canonicalIngredientIds: ['ingredient-oats'] }),
    aliases: [alias({ license: '' })],
  });
  const missingReview = resolveFoodRuleCoverage({
    rules: rules({ customAllergies: ['Hafer'] }),
    recipe: recipe({ canonicalIngredientIds: ['ingredient-oats'] }),
    aliases: [alias({ reviewedAt: null, reviewedBy: null })],
  });

  for (const result of [missingSourceId, missingLicense, missingReview]) {
    assertEquals(result.status, 'unknown');
    assertEquals(result.entries[0]?.reason, 'custom_rule_mapping_stale');
    assertEquals(result.aliasSourceVersions, []);
  }
});
