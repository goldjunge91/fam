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

const KNOWLEDGE_SOURCES = ['open_food_facts', 'foodon', 'curated'] as const;
const MAPPING_SOURCES = ['eu_lmiv', ...KNOWLEDGE_SOURCES] as const;
const KNOWLEDGE_RELATIONS = ['contains', 'derived_from', 'may_contain', 'exempt'] as const;
const KNOWLEDGE_CONFIDENCES = ['regulatory', 'verified', 'external', 'inferred'] as const;
const ALLERGEN_RESOLUTIONS = ['unknown', 'clear', 'mapped'] as const;

type EuAllergenId = (typeof EU_ALLERGEN_IDS)[number];
type KnowledgeSource = (typeof KNOWLEDGE_SOURCES)[number];
type MappingSource = (typeof MAPPING_SOURCES)[number];
type KnowledgeRelation = (typeof KNOWLEDGE_RELATIONS)[number];
type KnowledgeConfidence = (typeof KNOWLEDGE_CONFIDENCES)[number];
type AllergenResolution = (typeof ALLERGEN_RESOLUTIONS)[number];

const PROFILE_RULE_TO_ALLERGEN_ID: Readonly<Record<string, EuAllergenId>> = {
  'eu_01_gluten_cereals': 'EU_01_GLUTEN_CEREALS',
  'gluten-containing-cereals': 'EU_01_GLUTEN_CEREALS',
  'celiac-gluten': 'EU_01_GLUTEN_CEREALS',
  'eu_02_crustaceans': 'EU_02_CRUSTACEANS',
  crustaceans: 'EU_02_CRUSTACEANS',
  'eu_03_eggs': 'EU_03_EGGS',
  eggs: 'EU_03_EGGS',
  'eu_04_fish': 'EU_04_FISH',
  fish: 'EU_04_FISH',
  'eu_05_peanuts': 'EU_05_PEANUTS',
  peanuts: 'EU_05_PEANUTS',
  'eu_06_soybeans': 'EU_06_SOYBEANS',
  soybeans: 'EU_06_SOYBEANS',
  'eu_07_milk': 'EU_07_MILK',
  milk: 'EU_07_MILK',
  lactose: 'EU_07_MILK',
  'eu_08_nuts': 'EU_08_NUTS',
  'tree-nuts': 'EU_08_NUTS',
  'eu_09_celery': 'EU_09_CELERY',
  celery: 'EU_09_CELERY',
  'eu_10_mustard': 'EU_10_MUSTARD',
  mustard: 'EU_10_MUSTARD',
  'eu_11_sesame': 'EU_11_SESAME',
  sesame: 'EU_11_SESAME',
  'eu_12_sulphites': 'EU_12_SULPHITES',
  'sulphur-dioxide-sulphites': 'EU_12_SULPHITES',
  'eu_13_lupin': 'EU_13_LUPIN',
  lupin: 'EU_13_LUPIN',
  'eu_14_molluscs': 'EU_14_MOLLUSCS',
  molluscs: 'EU_14_MOLLUSCS',
};

type Provenance = {
  sourceUrl: string;
  sourceVersion: string;
  license: string;
};

export type NormalizedTaxonomyImport = Provenance & {
  source: 'eu_lmiv';
  id: EuAllergenId;
  canonicalName: string;
  legalCode: string;
  sourceId: string;
};

export type NormalizedIngredientImport = Provenance & {
  source: KnowledgeSource;
  sourceId: string;
  canonicalName: string;
  foodonId: string | null;
  allergenResolution: AllergenResolution;
  allergenReviewedAt: string | null;
};

export type NormalizedAliasImport = Provenance & {
  source: KnowledgeSource;
  sourceId: string;
  alias: string;
  locale: string;
};

export type NormalizedMappingImport = Provenance & {
  source: MappingSource;
  sourceId: string;
  allergenId: EuAllergenId;
  relation: KnowledgeRelation;
  confidence: KnowledgeConfidence;
  reviewedAt: string | null;
};

export type IngredientAllergenEvidence = {
  allergenResolution: AllergenResolution;
  allergenReviewedAt: string | null;
  mappings: ReadonlyArray<Pick<NormalizedMappingImport, 'allergenId' | 'relation' | 'confidence' | 'reviewedAt'>>;
};

export type NormalizedIngredientKnowledgeImport = {
  ingredient: NormalizedIngredientImport;
  aliases: NormalizedAliasImport[];
  mappings: NormalizedMappingImport[];
};

type RecordValue = Record<string, unknown>;

function normalizeRule(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

export function allergenIdForProfileRule(value: string): EuAllergenId | null {
  return PROFILE_RULE_TO_ALLERGEN_ID[normalizeRule(value)] ?? null;
}

/**
 * Returns true when the recipe must be excluded for at least one active
 * profile allergy/intolerance. Unknown rules and incomplete recipe evidence
 * are deliberately unsafe, so they fail closed instead of being guessed.
 */
export function recipeHasAllergenConflict(
  recipeAllergens: readonly string[] | null,
  profileRules: readonly string[],
): boolean {
  if (profileRules.length === 0) return false;
  if (recipeAllergens === null) return true;

  const recipeAllergenIds = new Set(
    recipeAllergens
      .map((allergen) => allergenIdForProfileRule(allergen))
      .filter((allergen): allergen is EuAllergenId => allergen !== null),
  );
  return profileRules.some((rule) => {
    const allergenId = allergenIdForProfileRule(rule);
    return allergenId === null || recipeAllergenIds.has(allergenId);
  });
}

/**
 * Produces the only allergen projection the gateway may expose as complete.
 * Every ingredient needs reviewed clear evidence or fully reviewed mapping
 * evidence. External-only and inferred-only data stay unknown.
 */
export function buildRecipeAllergenProjection(
  ingredients: readonly IngredientAllergenEvidence[],
): EuAllergenId[] | null {
  if (ingredients.length === 0) return null;

  const allergenIds = new Set<EuAllergenId>();
  for (const ingredient of ingredients) {
    if (ingredient.allergenResolution === 'unknown') return null;
    if (ingredient.allergenResolution === 'clear') {
      if (ingredient.allergenReviewedAt === null || ingredient.mappings.length > 0) return null;
      continue;
    }
    if (ingredient.mappings.length === 0) return null;

    for (const mapping of ingredient.mappings) {
      const reviewed = mapping.reviewedAt !== null &&
        (mapping.confidence === 'verified' || mapping.confidence === 'regulatory');
      if (!reviewed) return null;
      if (mapping.relation !== 'exempt') allergenIds.add(mapping.allergenId);
    }
  }

  return EU_ALLERGEN_IDS.filter((allergenId) => allergenIds.has(allergenId));
}

function recordValue(value: unknown, label: string): RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as RecordValue;
}

function requiredString(record: RecordValue, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(record: RecordValue, key: string): string | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  return requiredString(record, key);
}

function oneOf<const T extends readonly string[]>(
  value: unknown,
  values: T,
  label: string,
): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new Error(`${label} is not supported`);
  }
  return value as T[number];
}

function provenanceFrom(record: RecordValue): Provenance {
  const sourceUrl = requiredString(record, 'sourceUrl');
  if (!/^https?:\/\//.test(sourceUrl)) {
    throw new Error('sourceUrl must be an http(s) URL');
  }
  return {
    sourceUrl,
    sourceVersion: requiredString(record, 'sourceVersion'),
    license: requiredString(record, 'license'),
  };
}

function allergenIdFrom(value: unknown): EuAllergenId {
  return oneOf(value, EU_ALLERGEN_IDS, 'allergenId');
}

function normalizeMapping(
  value: unknown,
  source: KnowledgeSource,
  baseProvenance: Provenance,
): NormalizedMappingImport {
  const record = recordValue(value, 'mapping');
  const mappingSource = oneOf(record.source ?? source, MAPPING_SOURCES, 'mapping source');
  const confidence = oneOf(record.confidence, KNOWLEDGE_CONFIDENCES, 'confidence');
  const reviewedAt = optionalString(record, 'reviewedAt');
  if ((confidence === 'verified' || confidence === 'regulatory') && reviewedAt === null) {
    throw new Error('verified and regulatory mappings require reviewedAt');
  }
  if (confidence === 'regulatory' && mappingSource !== 'eu_lmiv') {
    throw new Error('regulatory confidence belongs to the EU taxonomy, not an ingredient import');
  }
  const mappingProvenance = {
    sourceUrl: optionalString(record, 'sourceUrl') ?? baseProvenance.sourceUrl,
    sourceVersion: optionalString(record, 'sourceVersion') ?? baseProvenance.sourceVersion,
    license: optionalString(record, 'license') ?? baseProvenance.license,
  };
  if (!/^https?:\/\//.test(mappingProvenance.sourceUrl)) {
    throw new Error('mapping sourceUrl must be an http(s) URL');
  }
  return {
    ...mappingProvenance,
    source: mappingSource,
    sourceId: requiredString(record, 'sourceId'),
    allergenId: allergenIdFrom(record.allergenId),
    relation: oneOf(record.relation, KNOWLEDGE_RELATIONS, 'relation'),
    confidence,
    reviewedAt,
  };
}

function normalizeAlias(
  value: unknown,
  source: KnowledgeSource,
  baseProvenance: Provenance,
): NormalizedAliasImport {
  const record = recordValue(value, 'alias');
  const declaredSource = record.source;
  if (declaredSource !== undefined && declaredSource !== source) {
    throw new Error('alias source must match the ingredient source');
  }
  return {
    ...baseProvenance,
    source,
    sourceId: requiredString(record, 'sourceId'),
    alias: requiredString(record, 'alias'),
    locale: optionalString(record, 'locale') ?? 'de',
  };
}

export function normalizeTaxonomyImport(input: unknown): NormalizedTaxonomyImport {
  const record = recordValue(input, 'taxonomy import');
  if (record.source !== 'eu_lmiv') {
    throw new Error('taxonomy imports must use eu_lmiv');
  }
  const id = oneOf(record.id, EU_ALLERGEN_IDS, 'taxonomy id');
  const provenance = provenanceFrom(record);
  return {
    ...provenance,
    source: 'eu_lmiv',
    id,
    canonicalName: requiredString(record, 'canonicalName'),
    legalCode: requiredString(record, 'legalCode'),
    sourceId: requiredString(record, 'sourceId'),
  };
}

export function normalizeIngredientKnowledgeImport(
  input: unknown,
): NormalizedIngredientKnowledgeImport {
  const record = recordValue(input, 'ingredient import');
  const source = oneOf(record.source, KNOWLEDGE_SOURCES, 'source');
  const provenance = provenanceFrom(record);
  const aliasesValue = record.aliases ?? [];
  const mappingsValue = record.mappings ?? [];
  if (!Array.isArray(aliasesValue) || !Array.isArray(mappingsValue)) {
    throw new Error('aliases and mappings must be arrays');
  }

  const mappings = mappingsValue.map((mapping) => normalizeMapping(mapping, source, provenance));
  const aliases = aliasesValue.map((alias) => normalizeAlias(alias, source, provenance));
  const allergenResolution = oneOf(
    record.allergenResolution ?? 'unknown',
    ALLERGEN_RESOLUTIONS,
    'allergenResolution',
  );
  const allergenReviewedAt = optionalString(record, 'allergenReviewedAt');
  if (allergenResolution === 'clear' && allergenReviewedAt === null) {
    throw new Error('clear ingredients require allergenReviewedAt');
  }
  if (allergenResolution === 'clear' && mappings.length > 0) {
    throw new Error('clear ingredients cannot contain allergen mappings');
  }
  if (allergenResolution === 'mapped' && mappings.length === 0) {
    throw new Error('mapped ingredients require allergen mappings');
  }

  return {
    ingredient: {
      ...provenance,
      source,
      sourceId: requiredString(record, 'sourceId'),
      canonicalName: requiredString(record, 'canonicalName'),
      foodonId: optionalString(record, 'foodonId'),
      allergenResolution,
      allergenReviewedAt,
    },
    aliases,
    mappings,
  };
}

function normalizeProviderImport(
  input: unknown,
  expectedSource: KnowledgeSource,
): NormalizedIngredientKnowledgeImport {
  const result = normalizeIngredientKnowledgeImport(input);
  if (result.ingredient.source !== expectedSource) {
    throw new Error(`ingredient import must use ${expectedSource}`);
  }
  return result;
}

export function normalizeOpenFoodFactsImport(input: unknown): NormalizedIngredientKnowledgeImport {
  return normalizeProviderImport(input, 'open_food_facts');
}

export function normalizeFoodOnImport(input: unknown): NormalizedIngredientKnowledgeImport {
  return normalizeProviderImport(input, 'foodon');
}

export function normalizeCuratedImport(input: unknown): NormalizedIngredientKnowledgeImport {
  return normalizeProviderImport(input, 'curated');
}
