export const EU_ALLERGEN_IDS = [
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
] as const;

export type EuAllergenId = (typeof EU_ALLERGEN_IDS)[number];
export type IngredientKnowledgeSource =
  | 'curated'
  | 'eu_lmiv'
  | 'open_food_facts'
  | 'foodon';
export type IngredientAssessment =
  | 'contains'
  | 'derived_from'
  | 'may_contain'
  | 'not_detected';

/** Update alongside the reviewed seed when a source version is replaced. */
export const CURRENT_ALLERGEN_SOURCE_VERSIONS: Readonly<
  Partial<Record<IngredientKnowledgeSource, string>>
> = {
  eu_lmiv: '02011R1169-20250401',
};

const PROFILE_RULE_TO_ALLERGEN_ID: Readonly<Record<string, EuAllergenId>> = {
  'gluten containing cereals': 'EU_01_GLUTEN_CEREALS',
  'glutenhaltiges getreide': 'EU_01_GLUTEN_CEREALS',
  crustaceans: 'EU_02_CRUSTACEANS',
  krebstiere: 'EU_02_CRUSTACEANS',
  eggs: 'EU_03_EGGS',
  eier: 'EU_03_EGGS',
  fish: 'EU_04_FISH',
  fisch: 'EU_04_FISH',
  peanuts: 'EU_05_PEANUTS',
  erdnusse: 'EU_05_PEANUTS',
  soybeans: 'EU_06_SOYBEANS',
  soja: 'EU_06_SOYBEANS',
  milk: 'EU_07_MILK',
  'milch milcheiweiss': 'EU_07_MILK',
  'tree nuts': 'EU_08_NUTS',
  schalenfruchte: 'EU_08_NUTS',
  celery: 'EU_09_CELERY',
  sellerie: 'EU_09_CELERY',
  mustard: 'EU_10_MUSTARD',
  senf: 'EU_10_MUSTARD',
  sesame: 'EU_11_SESAME',
  sesam: 'EU_11_SESAME',
  'sulphur dioxide sulphites': 'EU_12_SULPHITES',
  'schwefeldioxid und sulfite': 'EU_12_SULPHITES',
  lupin: 'EU_13_LUPIN',
  lupinen: 'EU_13_LUPIN',
  molluscs: 'EU_14_MOLLUSCS',
  weichtiere: 'EU_14_MOLLUSCS',
};

export function allergenIdForProfileRule(value: string): EuAllergenId | null {
  const key = value.trim().toLocaleLowerCase('de-DE')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replaceAll('ß', 'ss')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return PROFILE_RULE_TO_ALLERGEN_ID[key] ?? null;
}

export type IngredientAliasRecord = {
  ingredientId: string;
  alias: string;
  locale: string;
  source: string;
  sourceId: string;
  sourceUrl: string;
  sourceVersion: string;
  license: string;
  confidence: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type IngredientAliasResolution =
  | { status: 'resolved'; ingredientId: string; sourceIds: string[]; sourceVersions: string[] }
  | { status: 'ambiguous'; ingredientIds: string[] }
  | { status: 'unknown'; reason: 'no_exact_alias' | 'unreviewed_alias' | 'stale_alias' };

function normalizeIngredientText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replaceAll('ß', 'ss')
    .toLocaleLowerCase('de-DE')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isTimestamp(value: string | null): value is string {
  return value !== null && Number.isFinite(Date.parse(value));
}

function nonEmpty(value: string | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function aliasHasCurrentReview(
  alias: IngredientAliasRecord,
  currentSourceVersions: Readonly<Partial<Record<IngredientKnowledgeSource, string>>>,
): boolean {
  return alias.confidence === 'verified' &&
    isTimestamp(alias.reviewedAt) &&
    nonEmpty(alias.reviewedBy) &&
    nonEmpty(alias.sourceId) &&
    nonEmpty(alias.sourceUrl) &&
    nonEmpty(alias.license) &&
    currentSourceVersions[alias.source as IngredientKnowledgeSource] === alias.sourceVersion;
}

/** Exact normalized aliases only. Fuzzy and substring matches stay unknown. */
export function resolveIngredientAlias(input: {
  text: string;
  locale: string;
  aliases: readonly IngredientAliasRecord[];
  currentSourceVersions?: Readonly<Partial<Record<IngredientKnowledgeSource, string>>>;
}): IngredientAliasResolution {
  const query = normalizeIngredientText(input.text);
  if (!query) return { status: 'unknown', reason: 'no_exact_alias' };

  const candidates = input.aliases.filter((alias) =>
    alias.locale.toLocaleLowerCase('en-US') === input.locale.toLocaleLowerCase('en-US') &&
    normalizeIngredientText(alias.alias) === query
  );
  if (candidates.length === 0) return { status: 'unknown', reason: 'no_exact_alias' };

  const ingredientIds = [...new Set(candidates.map((candidate) => candidate.ingredientId))].sort();
  if (ingredientIds.length > 1) return { status: 'ambiguous', ingredientIds };

  const currentSourceVersions = input.currentSourceVersions ?? CURRENT_ALLERGEN_SOURCE_VERSIONS;
  const reviewed = candidates.filter((candidate) =>
    aliasHasCurrentReview(candidate, currentSourceVersions)
  );
  if (reviewed.length === 0) {
    const hasVerified = candidates.some((candidate) => candidate.confidence === 'verified');
    return {
      status: 'unknown',
      reason: hasVerified ? 'stale_alias' : 'unreviewed_alias',
    };
  }

  return {
    status: 'resolved',
    ingredientId: ingredientIds[0],
    sourceIds: [...new Set(reviewed.map((candidate) => candidate.sourceId))].sort(),
    sourceVersions: [...new Set(reviewed.map((candidate) => candidate.sourceVersion))].sort(),
  };
}

export type IngredientFactRecord = {
  ingredientId: string;
  ingredientRevision: number;
  allergenId: string;
  assessment: string;
  source: string;
  sourceId: string;
  sourceUrl: string;
  sourceVersion: string;
  license: string;
  reviewScope: string;
  evidenceSnapshot: string;
  evidenceSha256?: string | null;
  confidence: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type IngredientRevision = {
  ingredientId: string;
  revision: number;
};

export type ReviewedRecipeIngredientMapping = {
  itemId: string;
  ingredientIds: readonly string[];
  status: string;
  complete: boolean;
  source: string;
  sourceId: string;
  sourceUrl: string | null;
  sourceVersion: string;
  currentSourceVersion: string | null;
  license: string | null;
  evidenceSnapshot: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type RecipeIngredientMappingRow = {
  id: string;
  ingredient_mapping: unknown;
  ingredient_source_type: string | null;
  ingredient_source_id: string | null;
  ingredient_source_url: string | null;
  ingredient_source_version: string | null;
  ingredient_source_license: string | null;
};

/** Accept only a saved review whose source snapshot still matches its row. */
export function toReviewedRecipeIngredientMapping(
  row: RecipeIngredientMappingRow,
): ReviewedRecipeIngredientMapping {
  const value = typeof row.ingredient_mapping === 'object' &&
      row.ingredient_mapping !== null && !Array.isArray(row.ingredient_mapping)
    ? row.ingredient_mapping as Record<string, unknown>
    : {};
  const ingredientIds = Array.isArray(value.ingredientIds) &&
      value.ingredientIds.every((id) =>
        typeof id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      ) &&
      new Set(value.ingredientIds).size === value.ingredientIds.length
    ? value.ingredientIds as string[]
    : [];
  const sourceMatchesRow = value.source === row.ingredient_source_type &&
    value.sourceId === row.ingredient_source_id &&
    value.sourceUrl === row.ingredient_source_url &&
    value.sourceVersion === row.ingredient_source_version &&
    value.license === row.ingredient_source_license;

  return {
    itemId: row.id,
    ingredientIds: sourceMatchesRow ? ingredientIds : [],
    status: sourceMatchesRow ? String(value.status ?? '') : 'unknown',
    complete: sourceMatchesRow && value.complete === true,
    source: sourceMatchesRow ? String(value.source ?? '') : '',
    sourceId: sourceMatchesRow && typeof value.sourceId === 'string' ? value.sourceId : '',
    sourceUrl: sourceMatchesRow && typeof value.sourceUrl === 'string' ? value.sourceUrl : null,
    sourceVersion: sourceMatchesRow && typeof value.sourceVersion === 'string'
      ? value.sourceVersion
      : '',
    currentSourceVersion: row.ingredient_source_version,
    license: sourceMatchesRow && typeof value.license === 'string' ? value.license : null,
    evidenceSnapshot: typeof value.evidenceSnapshot === 'string' ? value.evidenceSnapshot : '',
    reviewedAt: typeof value.reviewedAt === 'string' ? value.reviewedAt : null,
    reviewedBy: typeof value.reviewedBy === 'string' ? value.reviewedBy : null,
  };
}

export type RecipeAllergenProjection = {
  status: 'clear' | 'conflict' | 'unknown';
  allergenIds: EuAllergenId[];
  conflictingAllergenIds: EuAllergenId[];
  unknownAllergenIds: EuAllergenId[];
  rulesUpdatedAt: string | null;
  knowledgeVersion: string;
};

const POSITIVE_ASSESSMENTS = new Set(['contains', 'derived_from', 'may_contain']);
const VALID_ASSESSMENTS = new Set([...POSITIVE_ASSESSMENTS, 'not_detected']);

function factHasCurrentReview(
  fact: IngredientFactRecord,
  ingredient: IngredientRevision,
  currentSourceVersions: Readonly<Partial<Record<IngredientKnowledgeSource, string>>>,
): boolean {
  return fact.ingredientRevision === ingredient.revision &&
    Number.isInteger(fact.ingredientRevision) &&
    fact.confidence === 'verified' &&
    VALID_ASSESSMENTS.has(fact.assessment) &&
    isTimestamp(fact.reviewedAt) &&
    nonEmpty(fact.reviewedBy) &&
    nonEmpty(fact.sourceId) &&
    nonEmpty(fact.sourceUrl) &&
    nonEmpty(fact.sourceVersion) &&
    nonEmpty(fact.license) &&
    nonEmpty(fact.reviewScope) &&
    nonEmpty(fact.evidenceSnapshot) &&
    currentSourceVersions[fact.source as IngredientKnowledgeSource] === fact.sourceVersion;
}

function mappingHasCurrentReview(mapping: ReviewedRecipeIngredientMapping): boolean {
  return mapping.status === 'verified' &&
    mapping.complete &&
    mapping.ingredientIds.length > 0 &&
    nonEmpty(mapping.source) &&
    nonEmpty(mapping.sourceId) &&
    nonEmpty(mapping.sourceVersion) &&
    mapping.sourceVersion === mapping.currentSourceVersion &&
    nonEmpty(mapping.evidenceSnapshot) &&
    isTimestamp(mapping.reviewedAt) &&
    nonEmpty(mapping.reviewedBy);
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function makeKnowledgeVersion(input: {
  rulesUpdatedAt: string | null;
  allergenIds: readonly EuAllergenId[];
  expectedItemIds: readonly string[];
  mappings: readonly ReviewedRecipeIngredientMapping[];
  ingredients: ReadonlyMap<string, IngredientRevision>;
  factsByIngredient: ReadonlyMap<string, readonly IngredientFactRecord[]>;
}): string {
  const mappingVersions = input.mappings
    .map((mapping) => ({
      itemId: mapping.itemId,
      ingredientIds: sortedUnique(mapping.ingredientIds),
      source: mapping.source,
      sourceId: mapping.sourceId,
      sourceUrl: mapping.sourceUrl,
      sourceVersion: mapping.sourceVersion,
      license: mapping.license,
      currentSourceVersion: mapping.currentSourceVersion,
      reviewedAt: mapping.reviewedAt,
    }))
    .sort((left, right) => left.itemId.localeCompare(right.itemId));
  const ingredientVersions = [...input.ingredients.values()]
    .map((ingredient) => ({ id: ingredient.ingredientId, revision: ingredient.revision }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const factVersions = [...input.factsByIngredient.values()].flatMap((facts) =>
    facts.map((fact) => ({
      ingredientId: fact.ingredientId,
      ingredientRevision: fact.ingredientRevision,
      allergenId: fact.allergenId,
      assessment: fact.assessment,
      source: fact.source,
      sourceId: fact.sourceId,
      sourceVersion: fact.sourceVersion,
      evidenceSha256: fact.evidenceSha256 ?? null,
      reviewedAt: fact.reviewedAt,
    }))
  ).sort((left, right) =>
    `${left.ingredientId}:${left.allergenId}:${left.source}:${left.sourceId}`.localeCompare(
      `${right.ingredientId}:${right.allergenId}:${right.source}:${right.sourceId}`,
    )
  );

  return JSON.stringify({
    rulesUpdatedAt: input.rulesUpdatedAt,
    allergenIds: sortedUnique(input.allergenIds),
    expectedItemIds: sortedUnique(input.expectedItemIds),
    mappingVersions,
    ingredientVersions,
    factVersions,
  });
}

/** Projects only explicit, current evidence. Missing facts remain unknown. */
export function projectRecipeAllergenSafety(input: {
  /** Every ingredient position in the current source recipe must be listed. */
  expectedItemIds: readonly string[];
  mappings: readonly ReviewedRecipeIngredientMapping[];
  ingredients: readonly IngredientRevision[];
  facts: readonly IngredientFactRecord[];
  activeAllergenIds: readonly EuAllergenId[];
  rulesUpdatedAt: string | null;
  currentSourceVersions?: Readonly<Partial<Record<IngredientKnowledgeSource, string>>>;
}): RecipeAllergenProjection {
  const allergenIds = sortedUnique(input.activeAllergenIds) as EuAllergenId[];
  const ingredients = new Map(
    input.ingredients.map((ingredient) => [ingredient.ingredientId, ingredient]),
  );
  const factsByIngredient = new Map<string, IngredientFactRecord[]>();
  for (const fact of input.facts) {
    const current = factsByIngredient.get(fact.ingredientId) ?? [];
    current.push(fact);
    factsByIngredient.set(fact.ingredientId, current);
  }

  const knowledgeVersion = makeKnowledgeVersion({
    rulesUpdatedAt: input.rulesUpdatedAt,
    allergenIds,
    expectedItemIds: input.expectedItemIds,
    mappings: input.mappings,
    ingredients,
    factsByIngredient,
  });
  if (allergenIds.length === 0) {
    return {
      status: 'clear',
      allergenIds,
      conflictingAllergenIds: [],
      unknownAllergenIds: [],
      rulesUpdatedAt: input.rulesUpdatedAt,
      knowledgeVersion,
    };
  }

  const currentSourceVersions = input.currentSourceVersions ?? CURRENT_ALLERGEN_SOURCE_VERSIONS;
  const expectedItemIds = sortedUnique(input.expectedItemIds);
  const mappingsByItem = new Map<string, ReviewedRecipeIngredientMapping[]>();
  for (const mapping of input.mappings) {
    const itemMappings = mappingsByItem.get(mapping.itemId) ?? [];
    itemMappings.push(mapping);
    mappingsByItem.set(mapping.itemId, itemMappings);
  }
  const mappingCoverageIsComplete = expectedItemIds.length > 0 &&
    mappingsByItem.size === expectedItemIds.length &&
    expectedItemIds.every((itemId) => mappingsByItem.get(itemId)?.length === 1) &&
    [...mappingsByItem.keys()].every((itemId) => expectedItemIds.includes(itemId));
  let mappingUnknown = !mappingCoverageIsComplete ||
    input.mappings.some((mapping) => !mappingHasCurrentReview(mapping));
  const mappedIngredientIds = sortedUnique(
    input.mappings.flatMap((mapping) => mapping.ingredientIds),
  );
  const positiveAllergens = new Set<EuAllergenId>();
  const unknownAllergens = new Set<EuAllergenId>();

  if (mappedIngredientIds.length === 0) mappingUnknown = true;
  for (const ingredientId of mappedIngredientIds) {
    const ingredient = ingredients.get(ingredientId);
    if (!ingredient || !Number.isInteger(ingredient.revision) || ingredient.revision < 1) {
      mappingUnknown = true;
      for (const allergenId of allergenIds) unknownAllergens.add(allergenId);
      continue;
    }

    const ingredientFacts = factsByIngredient.get(ingredientId) ?? [];
    for (const allergenId of allergenIds) {
      const relevantFacts = ingredientFacts.filter((fact) => fact.allergenId === allergenId);
      if (relevantFacts.length === 0) {
        unknownAllergens.add(allergenId);
        continue;
      }

      const currentFacts = relevantFacts.filter((fact) =>
        factHasCurrentReview(fact, ingredient, currentSourceVersions)
      );
      if (currentFacts.some((fact) => POSITIVE_ASSESSMENTS.has(fact.assessment))) {
        positiveAllergens.add(allergenId);
        continue;
      }

      const allFactsAreCurrent = relevantFacts.length > 0 &&
        currentFacts.length === relevantFacts.length;
      if (
        !allFactsAreCurrent ||
        !relevantFacts.every((fact) => fact.assessment === 'not_detected')
      ) {
        unknownAllergens.add(allergenId);
      }
    }
  }

  if (mappingUnknown) {
    for (const allergenId of allergenIds) unknownAllergens.add(allergenId);
  }

  const conflictingAllergenIds = allergenIds.filter((allergenId) =>
    positiveAllergens.has(allergenId)
  );
  const unknownAllergenIds = allergenIds.filter((allergenId) =>
    unknownAllergens.has(allergenId) && !positiveAllergens.has(allergenId)
  );
  const status = conflictingAllergenIds.length > 0
    ? 'conflict'
    : unknownAllergenIds.length > 0
    ? 'unknown'
    : 'clear';

  return {
    status,
    allergenIds,
    conflictingAllergenIds,
    unknownAllergenIds,
    rulesUpdatedAt: input.rulesUpdatedAt,
    knowledgeVersion,
  };
}

export function projectionIsClearForRules(
  projection: RecipeAllergenProjection | undefined,
  activeAllergenIds: readonly EuAllergenId[],
  rulesUpdatedAt?: string | null,
): boolean {
  return projection?.status === 'clear' &&
    JSON.stringify(sortedUnique(projection.allergenIds)) ===
      JSON.stringify(sortedUnique(activeAllergenIds)) &&
    (rulesUpdatedAt === undefined || projection.rulesUpdatedAt === rulesUpdatedAt);
}
