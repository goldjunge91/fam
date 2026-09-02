import {
  ALLERGY_PRESETS,
  addFoodSelection,
  createCustomFoodSelection,
  EMPTY_PROFILE_FOOD_RULES,
  fromStoredProfileFoodRules,
  INTOLERANCE_PRESETS,
  profileFoodRulesSchema,
  toStoredProfileFoodRules,
} from '@/features/profile/domain/food-rules';

describe('personal food rules', () => {
  test('normalisiert freie Eingaben ohne die sichtbare Schreibweise zu verlieren', () => {
    expect(createCustomFoodSelection('  Crème   fraîche  ')).toEqual({
      source: 'custom',
      label: 'Crème fraîche',
      normalizedLabel: 'crème fraîche',
    });

    expect(createCustomFoodSelection('Ｏｌｉｖｅｎ')).toEqual({
      source: 'custom',
      label: 'Oliven',
      normalizedLabel: 'oliven',
    });
  });

  test('weist leere und zu lange freie Eingaben zurück', () => {
    expect(() => createCustomFoodSelection('   ')).toThrow('Bitte gib ein Lebensmittel ein.');
    expect(() => createCustomFoodSelection('a'.repeat(81))).toThrow(
      'Der Eintrag darf höchstens 80 Zeichen lang sein.',
    );
  });

  test('verhindert doppelte Presets und freie Einträge innerhalb einer Kategorie', () => {
    const peanut = { source: 'preset' as const, code: 'peanuts' as const };
    const firstCustom = createCustomFoodSelection('Oliven');
    const duplicateCustom = createCustomFoodSelection('  OLIVEN ');

    expect(addFoodSelection([peanut], peanut)).toEqual([peanut]);
    expect(addFoodSelection([firstCustom], duplicateCustom)).toEqual([firstCustom]);
  });

  test('bildet den logischen Vertrag verlustfrei auf die Datenbankspalten ab', () => {
    const rules = profileFoodRulesSchema.parse({
      allergies: [{ source: 'preset', code: 'peanuts' }, createCustomFoodSelection('Johannisbrot')],
      intolerances: [{ source: 'preset', code: 'lactose' }, createCustomFoodSelection('Histamin')],
      dislikedFoods: [createCustomFoodSelection('Oliven')],
    });

    const stored = toStoredProfileFoodRules(rules);
    expect(stored).toEqual({
      allergy_codes: ['peanuts'],
      custom_allergies: ['Johannisbrot'],
      intolerance_codes: ['lactose'],
      custom_intolerances: ['Histamin'],
      disliked_foods: ['Oliven'],
    });
    expect(fromStoredProfileFoodRules(stored)).toEqual(rules);
  });

  test('liefert für ein noch nicht gespeichertes Profil leere Regeln', () => {
    expect(fromStoredProfileFoodRules(null)).toEqual(EMPTY_PROFILE_FOOD_RULES);
  });

  test('hält Preset-Codes und Anzeigenamen explizit und stabil', () => {
    expect(ALLERGY_PRESETS).toHaveLength(14);
    expect(ALLERGY_PRESETS.find(({ code }) => code === 'peanuts')?.label).toBe('Erdnüsse');
    expect(ALLERGY_PRESETS.find(({ code }) => code === 'milk')?.label).toBe('Milch / Milcheiweiß');
    expect(INTOLERANCE_PRESETS.map(({ code }) => code)).toEqual([
      'lactose',
      'fructose-malabsorption',
      'sorbitol-malabsorption',
      'celiac-gluten',
    ]);
    expect(INTOLERANCE_PRESETS.find(({ code }) => code === 'celiac-gluten')?.label).toBe(
      'Zöliakie / Gluten strikt meiden',
    );
  });
});
