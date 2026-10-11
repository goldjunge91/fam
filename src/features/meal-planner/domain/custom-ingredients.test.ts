import {
  customIngredientSchema,
  customIngredientUnitLabel,
  normalizeCustomIngredientUnit,
  parseCustomIngredients,
} from './custom-ingredients';

describe('custom ingredient units', () => {
  it('accepts German unit labels and stores their canonical values', () => {
    const unit = normalizeCustomIngredientUnit(' Gramm (g) ');

    expect(unit).toBe('g');
    expect(customIngredientSchema.parse({ name: ' Paprika ', quantity: 2, unit })).toEqual({
      name: 'Paprika',
      quantity: 2,
      unit: 'g',
    });
  });

  it('shows the German label for a stored shopping-list unit', () => {
    expect(customIngredientUnitLabel('piece')).toBe('Stück');
  });

  it('keeps unknown units readable after normalizing them', () => {
    expect(normalizeCustomIngredientUnit('  Bund  ')).toBe('bund');
    expect(customIngredientUnitLabel('bund')).toBe('bund');
  });

  it('parses SQLite JSON and Supabase arrays, defaulting missing values to empty', () => {
    const ingredient = { name: 'Paprika', quantity: 2, unit: 'piece' };

    expect(parseCustomIngredients(JSON.stringify([ingredient]))).toEqual([ingredient]);
    expect(parseCustomIngredients([ingredient])).toEqual([ingredient]);
    expect(parseCustomIngredients(null)).toEqual([]);
    expect(() => parseCustomIngredients('not-json')).toThrow();
  });
});
