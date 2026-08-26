import { RECIPE_FORM_DEFAULTS, recipeFormSchema } from './recipe-form-schema';

describe('recipeFormSchema', () => {
  it('normalisiert einen gültigen Rezepttitel', () => {
    const result = recipeFormSchema.parse({
      ...RECIPE_FORM_DEFAULTS,
      title: '  Pasta Pesto  ',
    });

    expect(result.title).toBe('Pasta Pesto');
  });

  it('weist leere Titel zurück', () => {
    const result = recipeFormSchema.safeParse(RECIPE_FORM_DEFAULTS);

    expect(result.success).toBe(false);
  });

  it('weist nicht-ganzzahlige Kochzeiten zurück', () => {
    const result = recipeFormSchema.safeParse({
      ...RECIPE_FORM_DEFAULTS,
      title: 'Suppe',
      cookTimeMinutes: '12.5',
    });

    expect(result.success).toBe(false);
  });
});
