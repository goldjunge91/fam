import { formatOFFProduct } from '@/features/product-search/sources/off-api-source';

import { productFromRouteParams, productToRouteParams } from './product-route-params';

describe('productToRouteParams / productFromRouteParams', () => {
  it('sollte ein Produkt verlustfrei durch Router-Params hindurch rundtripen', () => {
    const product = formatOFFProduct({
      code: '4019300005307',
      product_name_de: 'Balance Reich an Protein',
      brands: 'Exquisa',
      image_front_small_url: 'https://images.openfoodfacts.org/1.jpg',
      nutriscore_grade: 'b',
      nova_group: 4,
      nutrient_levels: { fat: 'low', sugars: 'moderate', salt: 'high' },
      nutriments: {
        'energy-kcal_100g': 91,
        proteins_100g: 10,
        carbohydrates_100g: 3.3,
        fat_100g: 4.2,
        sugars_100g: 2.1,
        'saturated-fat_100g': 2.9,
        salt_100g: 1.1,
      },
    });
    expect(product).not.toBeNull();

    const params = productToRouteParams(product as ReturnType<typeof formatOFFProduct> & object);
    const roundTripped = productFromRouteParams(params);

    expect(roundTripped).toEqual({
      name: 'Balance Reich an Protein',
      brand: 'Exquisa',
      imageUrl: 'https://images.openfoodfacts.org/1.jpg',
      caloriesPer100g: 91,
      proteinsPer100g: 10,
      carbsPer100g: 3.3,
      fatPer100g: 4.2,
      sugarsPer100g: 2.1,
      saturatedFatPer100g: 2.9,
      saltPer100g: 1.1,
      nutriScore: 'b',
      novaGroup: 4,
      nutrientLevels: { fat: 'low', sugars: 'moderate', salt: 'high' },
      categoryTags: [],
    });
  });

  it('sollte categoryTags und offLastModifiedAt verlustfrei rundtripen', () => {
    const product = formatOFFProduct({
      code: '4019300005307',
      product_name_de: 'Schweineschnitzel',
      categories_tags: ['en:meats', 'en:porks'],
      last_modified_t: 1_700_000_000,
    });
    expect(product).not.toBeNull();

    const params = productToRouteParams(product as ReturnType<typeof formatOFFProduct> & object);
    const roundTripped = productFromRouteParams(params);

    expect(roundTripped?.categoryTags).toEqual(['en:meats', 'en:porks']);
    expect(roundTripped?.offLastModifiedAt).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });

  it('sollte ohne categoryTags im Rundtrip ein leeres Array liefern', () => {
    const product = formatOFFProduct({ code: '1', product_name: 'Test' });
    const params = productToRouteParams(product as ReturnType<typeof formatOFFProduct> & object);
    expect(productFromRouteParams(params)?.categoryTags).toEqual([]);
  });

  it('sollte ohne Namen null zurueckgeben', () => {
    expect(productFromRouteParams({})).toBeNull();
  });

  it('sollte mit expo-router-Array-Params (z.B. bei mehrfachen Query-Keys) umgehen', () => {
    expect(productFromRouteParams({ name: ['Apfel', 'Birne'], kcalPer100g: ['52'] })).toEqual(
      expect.objectContaining({ name: 'Apfel', caloriesPer100g: 52 }),
    );
  });

  it('sollte den gekapselten Produkt-Payload aus dem Lebensmittelsuche-Modal lesen', () => {
    const payload = productToRouteParams({
      barcode: '123',
      name: 'Hafermilch',
      brand: 'Oatly',
      caloriesPer100g: 59,
      proteinsPer100g: 1.1,
      carbsPer100g: 6.6,
      fatPer100g: 3,
      categoryTags: [],
    });

    expect(productFromRouteParams({ productData: JSON.stringify(payload) })).toEqual(
      expect.objectContaining({
        name: 'Hafermilch',
        caloriesPer100g: 59,
        proteinsPer100g: 1.1,
        carbsPer100g: 6.6,
        fatPer100g: 3,
      }),
    );
  });

  it('ueberlebt kaputte JSON-Parameter aus einem alten Deep-Link', () => {
    expect(
      productFromRouteParams({ name: 'Apfel', categoryTags: 'kaputt{', nutrientLevels: '][' }),
    ).toEqual(
      expect.objectContaining({ name: 'Apfel', categoryTags: [], nutrientLevels: undefined }),
    );
  });
});
