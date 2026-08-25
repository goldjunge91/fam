import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';
import { normalizeProductSearchQuery, rankProductSearchResults } from './search-ranking';

function product(
  name: string,
  brand: string,
  quantity: number,
  unit: string,
): OpenFoodFactsProduct {
  return { barcode: name, name, brand, quantity, unit, categoryTags: [] };
}

describe('product search ranking', () => {
  it('separates a typed quantity and unit from the text query', () => {
    expect(normalizeProductSearchQuery('1l Coca Ccola')).toEqual({
      normalized: '1l coca ccola',
      tokens: ['coca', 'ccola'],
      quantity: 1,
      unit: 'l',
    });
  });

  it('tolerates a small typo and prefers the matching name', () => {
    const results = rankProductSearchResults(
      [
        product('Coca-Cola Classic', 'Coca-Cola', 1, 'l'),
        product('Cappy Grapefruit', 'Coca-Cola', 1, 'l'),
      ],
      '1l coca ccola',
    );

    expect(results[0]?.name).toBe('Coca-Cola Classic');
  });

  it('boosts the preferred supermarket private label', () => {
    const results = rankProductSearchResults(
      [
        product('Haferflocken kernig', 'Kölln', 500, 'g'),
        product('Haferflocken kernig', 'Edeka Bio', 500, 'g'),
      ],
      'haferflocken kernig',
      'Edeka',
    );

    expect(results[0]?.brand).toBe('Edeka Bio');
  });

  it('does not treat a private-label alias as a substring', () => {
    const results = rankProductSearchResults(
      [product('Coca-Cola Lift Orange', 'Coca-Cola', 1, 'l')],
      'coca cola',
      'REWE',
    );

    expect(results[0]?.brand).toBe('Coca-Cola');
  });
});
