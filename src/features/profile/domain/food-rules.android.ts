import { z } from 'zod';

export const ALLERGY_CODES = [
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
] as const;

export const INTOLERANCE_CODES = [
  'lactose',
  'fructose-malabsorption',
  'sorbitol-malabsorption',
  'celiac-gluten',
] as const;

export type AllergyCode = (typeof ALLERGY_CODES)[number];
export type IntoleranceCode = (typeof INTOLERANCE_CODES)[number];

const ALLERGY_LABELS: Record<AllergyCode, string> = {
  'gluten-containing-cereals': 'Glutenhaltiges Getreide',
  crustaceans: 'Krebstiere',
  eggs: 'Eier',
  fish: 'Fisch',
  peanuts: 'Erdnüsse',
  soybeans: 'Soja',
  milk: 'Milch / Milcheiweiß',
  'tree-nuts': 'Schalenfrüchte',
  celery: 'Sellerie',
  mustard: 'Senf',
  sesame: 'Sesam',
  'sulphur-dioxide-sulphites': 'Schwefeldioxid und Sulfite',
  lupin: 'Lupinen',
  molluscs: 'Weichtiere',
};

const INTOLERANCE_LABELS: Record<IntoleranceCode, string> = {
  lactose: 'Laktose',
  'fructose-malabsorption': 'Fruktosemalabsorption',
  'sorbitol-malabsorption': 'Sorbitmalabsorption',
  'celiac-gluten': 'Zöliakie / Gluten strikt meiden',
};

export const ALLERGY_PRESETS = ALLERGY_CODES.map((code) => ({
  code,
  label: ALLERGY_LABELS[code],
}));

export const INTOLERANCE_PRESETS = INTOLERANCE_CODES.map((code) => ({
  code,
  label: INTOLERANCE_LABELS[code],
}));

export type CustomFoodSelection = {
  source: 'custom';
  label: string;
  normalizedLabel: string;
};

export type FoodSelection<Code extends string> =
  | { source: 'preset'; code: Code }
  | CustomFoodSelection;

export type ProfileFoodRules = {
  allergies: FoodSelection<AllergyCode>[];
  intolerances: FoodSelection<IntoleranceCode>[];
  dislikedFoods: CustomFoodSelection[];
};

export type StoredProfileFoodRules = {
  allergy_codes: AllergyCode[];
  custom_allergies: string[];
  intolerance_codes: IntoleranceCode[];
  custom_intolerances: string[];
  disliked_foods: string[];
};

function normalizeCustomFoodLabel(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

export const customFoodLabelSchema = z
  .string()
  .transform(normalizeCustomFoodLabel)
  .pipe(
    z
      .string()
      .min(1, 'Bitte gib ein Lebensmittel ein.')
      .max(80, 'Der Eintrag darf höchstens 80 Zeichen lang sein.'),
  );

export function createCustomFoodSelection(value: string): CustomFoodSelection {
  const label = customFoodLabelSchema.parse(value);
  return {
    source: 'custom',
    label,
    normalizedLabel: label.toLocaleLowerCase('de-DE'),
  };
}

const customFoodSelectionSchema = z
  .object({
    source: z.literal('custom'),
    label: customFoodLabelSchema,
    normalizedLabel: z.string(),
  })
  .superRefine((selection, context) => {
    if (selection.normalizedLabel !== selection.label.toLocaleLowerCase('de-DE')) {
      context.addIssue({
        code: 'custom',
        path: ['normalizedLabel'],
        message: 'Die normalisierte Bezeichnung passt nicht zum sichtbaren Eintrag.',
      });
    }
  });

const allergySelectionSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('preset'), code: z.enum(ALLERGY_CODES) }),
  customFoodSelectionSchema,
]);

const intoleranceSelectionSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('preset'), code: z.enum(INTOLERANCE_CODES) }),
  customFoodSelectionSchema,
]);

export const profileFoodRulesSchema = z.object({
  allergies: z.array(allergySelectionSchema).max(78),
  intolerances: z.array(intoleranceSelectionSchema).max(68),
  dislikedFoods: z.array(customFoodSelectionSchema).max(64),
});

const storedProfileFoodRulesSchema = z.object({
  allergy_codes: z.array(z.enum(ALLERGY_CODES)).max(14),
  custom_allergies: z.array(customFoodLabelSchema).max(64),
  intolerance_codes: z.array(z.enum(INTOLERANCE_CODES)).max(4),
  custom_intolerances: z.array(customFoodLabelSchema).max(64),
  disliked_foods: z.array(customFoodLabelSchema).max(64),
});

export const EMPTY_PROFILE_FOOD_RULES: ProfileFoodRules = {
  allergies: [],
  intolerances: [],
  dislikedFoods: [],
};

function selectionKey<Code extends string>(selection: FoodSelection<Code>) {
  return selection.source === 'preset'
    ? `preset:${selection.code}`
    : `custom:${selection.normalizedLabel}`;
}

export function addFoodSelection<Code extends string>(
  selections: FoodSelection<Code>[],
  selection: FoodSelection<Code>,
) {
  const key = selectionKey(selection);
  return selections.some((current) => selectionKey(current) === key)
    ? selections
    : [...selections, selection];
}

export function toStoredProfileFoodRules(rules: ProfileFoodRules): StoredProfileFoodRules {
  const validated = profileFoodRulesSchema.parse(rules);

  return {
    allergy_codes: validated.allergies.flatMap((selection) =>
      selection.source === 'preset' ? [selection.code] : [],
    ),
    custom_allergies: validated.allergies.flatMap((selection) =>
      selection.source === 'custom' ? [selection.label] : [],
    ),
    intolerance_codes: validated.intolerances.flatMap((selection) =>
      selection.source === 'preset' ? [selection.code] : [],
    ),
    custom_intolerances: validated.intolerances.flatMap((selection) =>
      selection.source === 'custom' ? [selection.label] : [],
    ),
    disliked_foods: validated.dislikedFoods.map(({ label }) => label),
  };
}

export function fromStoredProfileFoodRules(rules: unknown): ProfileFoodRules {
  if (!rules) {
    return {
      allergies: [],
      intolerances: [],
      dislikedFoods: [],
    };
  }

  const stored = storedProfileFoodRulesSchema.parse(rules);
  return profileFoodRulesSchema.parse({
    allergies: [
      ...stored.allergy_codes.map((code) => ({ source: 'preset' as const, code })),
      ...stored.custom_allergies.map(createCustomFoodSelection),
    ],
    intolerances: [
      ...stored.intolerance_codes.map((code) => ({ source: 'preset' as const, code })),
      ...stored.custom_intolerances.map(createCustomFoodSelection),
    ],
    dislikedFoods: stored.disliked_foods.map(createCustomFoodSelection),
  });
}
