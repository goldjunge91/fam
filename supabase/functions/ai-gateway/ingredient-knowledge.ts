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

function normalizeRule(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

export function allergenIdForProfileRule(value: string): EuAllergenId | null {
  return PROFILE_RULE_TO_ALLERGEN_ID[normalizeRule(value)] ?? null;
}

/** Unknown rules and incomplete recipe evidence are unsafe by default. */
export function recipeHasAllergenConflict(
  recipeAllergens: readonly string[] | null,
  profileRules: readonly string[],
): boolean {
  if (profileRules.length === 0) return false;
  if (recipeAllergens === null) return true;

  const recipeAllergenIds = new Set(
    recipeAllergens
      .map(allergenIdForProfileRule)
      .filter((allergen): allergen is EuAllergenId => allergen !== null),
  );
  return profileRules.some((rule) => {
    const allergenId = allergenIdForProfileRule(rule);
    return allergenId === null || recipeAllergenIds.has(allergenId);
  });
}
