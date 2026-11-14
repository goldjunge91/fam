import {
  allergenIdForProfileRule,
  type EuAllergenId,
  type IngredientAliasRecord,
  type RecipeAllergenProjection,
  resolveIngredientAlias,
} from './ingredient-knowledge.ts';

export type FoodRuleCoverageStatus = 'clear' | 'conflict' | 'unknown' | 'unsupported';

export type FoodRuleCategory =
  | 'allergy_code'
  | 'custom_allergy'
  | 'intolerance_code'
  | 'custom_intolerance'
  | 'disliked_food';

export type FoodRuleCoverageEntry = {
  category: FoodRuleCategory;
  status: FoodRuleCoverageStatus;
  reason:
    | 'reviewed_allergen_conflict'
    | 'allergen_evidence_unknown'
    | 'unsupported_rule_code'
    | 'unsupported_intolerance_evidence'
    | 'custom_rule_not_mapped'
    | 'custom_rule_mapping_ambiguous'
    | 'custom_rule_mapping_stale'
    | 'recipe_ingredient_mapping_incomplete'
    | 'canonical_ingredient_conflict'
    | 'reviewed_allergen_clear'
    | 'no_matching_canonical_ingredient'
    | 'rule_version_unavailable';
  /** Stable profile code when the rule comes from a fixed, non-private enum. */
  ruleCode?: string;
};

export type FoodRuleCoverage = {
  status: FoodRuleCoverageStatus;
  rulesUpdatedAt: string | null;
  knowledgeVersion: string | null;
  ingredientMappingVersion: string | null;
  aliasSourceVersions: string[];
  /** A stable token for comparing the same request's rule/evidence snapshot at apply time. */
  coverageVersion: string;
  entries: FoodRuleCoverageEntry[];
};

export type FoodRuleSet = {
  /** Legacy display fields remain accepted for existing injected contexts. */
  allergies?: readonly string[];
  allergyCodes?: readonly string[];
  customAllergies?: readonly string[];
  intolerances?: readonly string[];
  intoleranceCodes?: readonly string[];
  customIntolerances?: readonly string[];
  avoidFoods?: readonly string[];
  dislikedFoods?: readonly string[];
  updatedAt: string | null;
};

export type FoodRuleRecipeEvidence = {
  allergenProjection?: RecipeAllergenProjection;
  ingredientDataComplete?: boolean;
  canonicalIngredientMappingComplete?: boolean;
  canonicalIngredientIds?: readonly string[];
  ingredientMappingVersion?: string | null;
};

export type RecipeIngredientMappingFingerprintItem = {
  itemId: string;
  mappingStatus: string;
  submittedMappingStatus: string;
  ingredientIds: readonly string[];
  complete: boolean;
  mappingSource: string;
  mappingSourceId: string;
  mappingSourceUrl: string | null;
  mappingSourceVersion: string;
  currentSourceVersion: string | null;
  rowSource: string | null;
  rowSourceId: string | null;
  rowSourceUrl: string | null;
  rowSourceVersion: string | null;
  rowLicense: string | null;
  mappingLicense: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  evidenceSnapshot: string;
};

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Hashes recipe mapping evidence without returning ingredient labels or evidence text. */
export async function fingerprintRecipeIngredientMappings(
  items: readonly RecipeIngredientMappingFingerprintItem[],
): Promise<string> {
  const sortedItems = [...items].sort((left, right) => left.itemId.localeCompare(right.itemId));
  const hashedItems = await Promise.all(sortedItems.map(async (item) => ({
    itemId: item.itemId,
    mappingStatus: item.mappingStatus,
    submittedMappingStatus: item.submittedMappingStatus,
    ingredientIds: [...item.ingredientIds].sort(),
    complete: item.complete,
    mappingSource: item.mappingSource,
    mappingSourceId: item.mappingSourceId,
    mappingSourceUrl: item.mappingSourceUrl,
    mappingSourceVersion: item.mappingSourceVersion,
    currentSourceVersion: item.currentSourceVersion,
    rowSource: item.rowSource,
    rowSourceId: item.rowSourceId,
    rowSourceUrl: item.rowSourceUrl,
    rowSourceVersion: item.rowSourceVersion,
    rowLicense: item.rowLicense,
    mappingLicense: item.mappingLicense,
    reviewedAt: item.reviewedAt,
    reviewedBy: item.reviewedBy,
    evidenceHash: await sha256(item.evidenceSnapshot),
  })));
  return `sha256:${await sha256(JSON.stringify(hashedItems))}`;
}

const PROFILE_ALLERGY_CODE_TO_ID: Readonly<Record<string, EuAllergenId>> = {
  'gluten-containing-cereals': 'EU_01_GLUTEN_CEREALS',
  crustaceans: 'EU_02_CRUSTACEANS',
  eggs: 'EU_03_EGGS',
  fish: 'EU_04_FISH',
  peanuts: 'EU_05_PEANUTS',
  soybeans: 'EU_06_SOYBEANS',
  milk: 'EU_07_MILK',
  'tree-nuts': 'EU_08_NUTS',
  celery: 'EU_09_CELERY',
  mustard: 'EU_10_MUSTARD',
  sesame: 'EU_11_SESAME',
  'sulphur-dioxide-sulphites': 'EU_12_SULPHITES',
  lupin: 'EU_13_LUPIN',
  molluscs: 'EU_14_MOLLUSCS',
};

function aggregateStatus(entries: readonly FoodRuleCoverageEntry[]): FoodRuleCoverageStatus {
  if (entries.some((entry) => entry.status === 'conflict')) return 'conflict';
  if (entries.some((entry) => entry.status === 'unsupported')) return 'unsupported';
  if (entries.some((entry) => entry.status === 'unknown')) return 'unknown';
  return 'clear';
}

function ruleProjectionStatus(
  projection: RecipeAllergenProjection | undefined,
  allergenId: EuAllergenId,
  rulesUpdatedAt: string | null,
): Pick<FoodRuleCoverageEntry, 'status' | 'reason'> {
  if (rulesUpdatedAt === null || !Number.isFinite(Date.parse(rulesUpdatedAt))) {
    return { status: 'unknown', reason: 'rule_version_unavailable' };
  }
  if (
    !projection || projection.rulesUpdatedAt !== rulesUpdatedAt ||
    !projection.allergenIds.includes(allergenId)
  ) {
    return { status: 'unknown', reason: 'allergen_evidence_unknown' };
  }
  if (projection.conflictingAllergenIds.includes(allergenId)) {
    return { status: 'conflict', reason: 'reviewed_allergen_conflict' };
  }
  if (projection.unknownAllergenIds.includes(allergenId)) {
    return { status: 'unknown', reason: 'allergen_evidence_unknown' };
  }
  return { status: 'clear', reason: 'reviewed_allergen_clear' };
}

function canonicalIngredientRuleStatus(input: {
  label: string;
  category: 'custom_allergy' | 'disliked_food';
  recipe: FoodRuleRecipeEvidence;
  aliases: readonly IngredientAliasRecord[];
  aliasSourceVersions: Set<string>;
}): FoodRuleCoverageEntry {
  const resolution = resolveIngredientAlias({
    text: input.label,
    locale: 'de',
    aliases: input.aliases,
  });

  if (resolution.status === 'ambiguous') {
    return {
      category: input.category,
      status: 'unsupported',
      reason: 'custom_rule_mapping_ambiguous',
    };
  }
  if (resolution.status === 'unknown') {
    return {
      category: input.category,
      status: resolution.reason === 'no_exact_alias' || resolution.reason === 'unreviewed_alias'
        ? 'unsupported'
        : 'unknown',
      reason: resolution.reason === 'stale_alias'
        ? 'custom_rule_mapping_stale'
        : 'custom_rule_not_mapped',
    };
  }

  resolution.sourceVersions.forEach((version) => input.aliasSourceVersions.add(version));
  if (
    input.recipe.ingredientDataComplete === false ||
    input.recipe.canonicalIngredientMappingComplete !== true ||
    !input.recipe.canonicalIngredientIds?.length
  ) {
    return {
      category: input.category,
      status: 'unknown',
      reason: 'recipe_ingredient_mapping_incomplete',
    };
  }

  const conflicts = resolution.ingredientId !== '' &&
    input.recipe.canonicalIngredientIds.includes(resolution.ingredientId);
  return {
    category: input.category,
    status: conflicts ? 'conflict' : 'clear',
    reason: conflicts ? 'canonical_ingredient_conflict' : 'no_matching_canonical_ingredient',
  };
}

function legacyCustomAllergies(rules: FoodRuleSet): readonly string[] {
  if (rules.customAllergies) return rules.customAllergies;
  const allergies = rules.allergies ?? [];
  return rules.allergyCodes ? allergies.slice(rules.allergyCodes.length) : allergies;
}

function legacyIntoleranceCodes(rules: FoodRuleSet): readonly string[] {
  if (rules.intoleranceCodes) return rules.intoleranceCodes;
  return rules.intolerances ?? [];
}

/** Resolves the requester's private rules against one recipe's reviewed evidence. */
export function resolveFoodRuleCoverage(input: {
  rules: FoodRuleSet;
  recipe: FoodRuleRecipeEvidence;
  aliases: readonly IngredientAliasRecord[];
}): FoodRuleCoverage {
  const { rules, recipe, aliases } = input;
  const entries: FoodRuleCoverageEntry[] = [];
  const aliasSourceVersions = new Set<string>();
  const allergyCodes = rules.allergyCodes ?? [];

  for (const code of allergyCodes) {
    const allergenId = PROFILE_ALLERGY_CODE_TO_ID[code];
    entries.push(
      allergenId
        ? {
          category: 'allergy_code',
          ruleCode: code,
          ...ruleProjectionStatus(recipe.allergenProjection, allergenId, rules.updatedAt),
        }
        : {
          category: 'allergy_code',
          ruleCode: code,
          status: 'unsupported',
          reason: 'unsupported_rule_code',
        },
    );
  }

  for (const label of legacyCustomAllergies(rules)) {
    const knownEuAllergen = allergenIdForProfileRule(label);
    entries.push(
      knownEuAllergen
        ? {
          category: 'custom_allergy',
          ...ruleProjectionStatus(recipe.allergenProjection, knownEuAllergen, rules.updatedAt),
        }
        : canonicalIngredientRuleStatus({
          label,
          category: 'custom_allergy',
          recipe,
          aliases,
          aliasSourceVersions,
        }),
    );
  }

  for (const code of legacyIntoleranceCodes(rules)) {
    entries.push({
      category: 'intolerance_code',
      ...(rules.intoleranceCodes ? { ruleCode: code } : {}),
      status: 'unsupported',
      reason: 'unsupported_intolerance_evidence',
    });
  }

  for (const _label of rules.customIntolerances ?? []) {
    entries.push({
      category: 'custom_intolerance',
      status: 'unsupported',
      reason: 'unsupported_intolerance_evidence',
    });
  }

  for (const label of rules.dislikedFoods ?? rules.avoidFoods ?? []) {
    entries.push(canonicalIngredientRuleStatus({
      label,
      category: 'disliked_food',
      recipe,
      aliases,
      aliasSourceVersions,
    }));
  }

  const hasValidRuleVersion = rules.updatedAt !== null &&
    Number.isFinite(Date.parse(rules.updatedAt));
  const versionCheckedEntries = entries.map((entry) =>
    entry.status === 'clear' && !hasValidRuleVersion
      ? {
        ...entry,
        status: 'unknown' as const,
        reason: 'rule_version_unavailable' as const,
      }
      : entry
  );
  const knowledgeVersion = recipe.allergenProjection?.knowledgeVersion ?? null;
  const aliasVersions = [...aliasSourceVersions].sort();
  const coverageVersion = JSON.stringify({
    rulesUpdatedAt: rules.updatedAt,
    knowledgeVersion,
    ingredientMappingVersion: recipe.ingredientMappingVersion ?? null,
    aliasSourceVersions: aliasVersions,
  });

  return {
    status: aggregateStatus(versionCheckedEntries),
    rulesUpdatedAt: rules.updatedAt,
    knowledgeVersion,
    ingredientMappingVersion: recipe.ingredientMappingVersion ?? null,
    aliasSourceVersions: aliasVersions,
    coverageVersion,
    entries: versionCheckedEntries,
  };
}
