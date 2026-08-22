import {
  formatOFFProduct,
  isLikelyBarcode,
  parseQuantityAndUnit,
  productFromRouteParams,
  productToRouteParams,
  SlidingWindowRateLimiter,
} from './open-food-facts';

describe('SlidingWindowRateLimiter', () => {
  it('erlaubt Anfragen bis zum Limit und blockt danach', () => {
    const limiter = new SlidingWindowRateLimiter(3, 60_000);
    const t0 = 1_000_000;

    expect(limiter.isLimited(t0)).toBe(false);
    limiter.record(t0);
    expect(limiter.isLimited(t0)).toBe(false);
    limiter.record(t0);
    expect(limiter.isLimited(t0)).toBe(false);
    limiter.record(t0);

    expect(limiter.isLimited(t0)).toBe(true);
  });

  it('laesst wieder Anfragen zu, sobald aeltere aus dem Fenster fallen', () => {
    const limiter = new SlidingWindowRateLimiter(2, 60_000);
    const t0 = 1_000_000;

    limiter.record(t0);
    limiter.record(t0 + 1_000);
    expect(limiter.isLimited(t0 + 2_000)).toBe(true);

    // Das erste Timestamp ist nach 60s aus dem Fenster raus.
    expect(limiter.isLimited(t0 + 61_000)).toBe(false);
  });

  it('startet unbelastet (kein Limit ohne vorherige Anfragen)', () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000);
    expect(limiter.isLimited()).toBe(false);
  });
});

describe('Open Food Facts Helper', () => {
  it('sollte Mengen und Einheiten korrekt parsen', () => {
    expect(parseQuantityAndUnit('500 g')).toEqual({ quantity: 500, unit: 'g' });
    expect(parseQuantityAndUnit('1.5 L')).toEqual({ quantity: 1.5, unit: 'l' });
    expect(parseQuantityAndUnit('1 kg')).toEqual({ quantity: 1, unit: 'kg' });
    expect(parseQuantityAndUnit('250 ml')).toEqual({ quantity: 250, unit: 'ml' });
    expect(parseQuantityAndUnit('1 Stück')).toEqual({ quantity: 1, unit: 'piece' });
    expect(parseQuantityAndUnit(undefined)).toEqual({ quantity: 1, unit: 'piece' });
  });

  it.each([
    ['40193000053', true], // EAN-11 artig, im 6-14-Fenster
    ['4019300005307', true], // EAN-13
    ['12345678', true], // EAN-8
    ['Haferflocken', false],
    ['123', false], // zu kurz, eher eine Mengenangabe als ein Barcode
    ['123456789012345', false], // zu lang
    ['4019 300 005 307', false], // Leerzeichen -> kein reiner Zifferncode
  ])('sollte "%s" korrekt als Barcode einstufen: %s', (value, expected) => {
    expect(isLikelyBarcode(value)).toBe(expected);
  });

  it('sollte Open Food Facts Rohdaten ordentlich formatieren', () => {
    const raw = {
      code: '4008400401027',
      product_name_de: 'Hafermilch Barista',
      brands: 'Oatly, Oatly AB',
      categories: 'Pflanzliche Lebensmittel, Getränke',
      quantity: '1 L',
      image_front_small_url: 'https://images.openfoodfacts.org/1.jpg',
      ingredients_text_de: 'Wasser, Hafer, Rapsöl',
      allergens_tags: ['en:oats', 'de:gluten'],
      nutriments: {
        'energy-kcal_100g': 59,
        proteins_100g: 1.1,
        carbohydrates_100g: 6.6,
        fat_100g: 3.0,
      },
    };

    const formatted = formatOFFProduct(raw);
    expect(formatted).toEqual({
      barcode: '4008400401027',
      name: 'Hafermilch Barista',
      brand: 'Oatly',
      quantity: 1,
      unit: 'l',
      imageUrl: 'https://images.openfoodfacts.org/1.jpg',
      caloriesPer100g: 59,
      proteinsPer100g: 1.1,
      carbsPer100g: 6.6,
      fatPer100g: 3.0,
      ingredients: 'Wasser, Hafer, Rapsöl',
      allergens: ['oats', 'gluten'],
    });
  });

  it('sollte null zurückgeben wenn kein Produktname vorhanden ist', () => {
    expect(formatOFFProduct(null)).toBeNull();
    expect(formatOFFProduct({ product_name: '' })).toBeNull();
  });

  it('sollte Nutri-Score, NOVA-Gruppe und Naehrwert-Ampel mit auslesen', () => {
    const raw = {
      code: '4019300005307',
      product_name_de: 'Balance Reich an Protein',
      nutriscore_grade: 'b',
      nova_group: 4,
      nutrient_levels: { fat: 'low', 'saturated-fat': 'low', sugars: 'moderate', salt: 'high' },
      nutriments: {
        'energy-kcal_100g': 91,
        proteins_100g: 10,
        carbohydrates_100g: 3.3,
        fat_100g: 4.2,
        sugars_100g: 2.1,
        'saturated-fat_100g': 2.9,
        salt_100g: 1.1,
      },
    };

    const formatted = formatOFFProduct(raw);
    expect(formatted?.nutriScore).toBe('b');
    expect(formatted?.novaGroup).toBe(4);
    expect(formatted?.sugarsPer100g).toBe(2.1);
    expect(formatted?.saturatedFatPer100g).toBe(2.9);
    expect(formatted?.saltPer100g).toBe(1.1);
    expect(formatted?.nutrientLevels).toEqual({
      fat: 'low',
      saturatedFat: 'low',
      sugars: 'moderate',
      salt: 'high',
    });
  });

  it('sollte nutrientLevels weglassen, wenn Open Food Facts keine Ampel liefert', () => {
    const formatted = formatOFFProduct({ code: '1', product_name: 'Test' });
    expect(formatted?.nutrientLevels).toBeUndefined();
  });
});

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
    });
  });

  it('sollte ohne Namen null zurueckgeben', () => {
    expect(productFromRouteParams({})).toBeNull();
  });

  it('sollte mit expo-router-Array-Params (z.B. bei mehrfachen Query-Keys) umgehen', () => {
    expect(productFromRouteParams({ name: ['Apfel', 'Birne'], kcalPer100g: ['52'] })).toEqual(
      expect.objectContaining({ name: 'Apfel', caloriesPer100g: 52 }),
    );
  });
});
