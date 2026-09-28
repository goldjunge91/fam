import {
  customIngredientSchema,
  customIngredientUnitLabel,
  normalizeCustomIngredientUnit,
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
});
