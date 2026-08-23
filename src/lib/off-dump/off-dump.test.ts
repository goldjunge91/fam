describe('toOpenFoodFactsProductFromDump', () => {
  it('mappt DB-Zeile korrekt in OpenFoodFactsProduct', () => {
    const { toOpenFoodFactsProductFromDump } = require('@/lib/off-dump/off-dump');
    const product = toOpenFoodFactsProductFromDump({
      code: '4008400404127',
      product_name: 'Kinder Riegel',
      brand: 'Ferrero',
      quantity: '210 g',
      nutriscore: 'e',
      energy_kcal: 566,
      fat: 35,
      saturated_fat: 22.6,
      carbohydrates: 53.5,
      sugars: 53.3,
      proteins: 8.7,
      salt: 0.313,
    });

    expect(product).toEqual({
      barcode: '4008400404127',
      name: 'Kinder Riegel',
      brand: 'Ferrero',
      quantity: 210,
      unit: 'g',
      nutriScore: 'e',
      caloriesPer100g: 566,
      fatPer100g: 35,
      saturatedFatPer100g: 22.6,
      carbsPer100g: 53.5,
      sugarsPer100g: 53.3,
      proteinsPer100g: 8.7,
      saltPer100g: 0.313,
      categoryTags: [],
    });
  });

  it('parst categories_tags/off_last_modified_at aus Dump Schema 2 (#223 Paket 4)', () => {
    const { toOpenFoodFactsProductFromDump } = require('@/lib/off-dump/off-dump');
    const product = toOpenFoodFactsProductFromDump({
      code: '4008400404127',
      product_name: 'Kinder Riegel',
      brand: null,
      quantity: null,
      nutriscore: null,
      energy_kcal: null,
      fat: null,
      saturated_fat: null,
      carbohydrates: null,
      sugars: null,
      proteins: null,
      salt: null,
      categories_tags: '["en:snacks","en:chocolates"]',
      off_last_modified_at: '2026-01-01T00:00:00.000Z',
    });

    expect(product.categoryTags).toEqual(['en:snacks', 'en:chocolates']);
    expect(product.offLastModifiedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('liefert categoryTags: [] bei Dump Schema 1 (Spalte fehlt/ist null)', () => {
    const { toOpenFoodFactsProductFromDump } = require('@/lib/off-dump/off-dump');
    const product = toOpenFoodFactsProductFromDump({
      code: '1',
      product_name: 'Test',
      brand: null,
      quantity: null,
      nutriscore: null,
      energy_kcal: null,
      fat: null,
      saturated_fat: null,
      carbohydrates: null,
      sugars: null,
      proteins: null,
      salt: null,
    });

    expect(product.categoryTags).toEqual([]);
    expect(product.offLastModifiedAt).toBeUndefined();
  });

  it('ignoriert kaputtes JSON in categories_tags statt zu werfen', () => {
    const { toOpenFoodFactsProductFromDump } = require('@/lib/off-dump/off-dump');
    const product = toOpenFoodFactsProductFromDump({
      code: '1',
      product_name: 'Test',
      brand: null,
      quantity: null,
      nutriscore: null,
      energy_kcal: null,
      fat: null,
      saturated_fat: null,
      carbohydrates: null,
      sugars: null,
      proteins: null,
      salt: null,
      categories_tags: 'kaputt{',
    });

    expect(product.categoryTags).toEqual([]);
  });
});

describe('dedupeProductsByBarcode', () => {
  it('filtert Duplikate anhand des Barcodes heraus und behält eindeutige Produkte', () => {
    const { dedupeProductsByBarcode } = require('@/lib/off-dump/off-dump');
    const list = [
      { barcode: '111', name: 'Produkt 1 (lokal)' },
      { barcode: '222', name: 'Produkt 2' },
      { barcode: '111', name: 'Produkt 1 (remote)' },
      { barcode: '', name: 'Produkt ohne Barcode 1' },
      { barcode: '', name: 'Produkt ohne Barcode 2' },
    ];

    const deduped = dedupeProductsByBarcode(
      list as unknown as Parameters<typeof dedupeProductsByBarcode>[0],
    );
    expect(deduped).toHaveLength(4);
    expect(deduped[0].name).toBe('Produkt 1 (lokal)');
    expect(deduped[1].name).toBe('Produkt 2');
    expect(deduped[2].name).toBe('Produkt ohne Barcode 1');
    expect(deduped[3].name).toBe('Produkt ohne Barcode 2');
  });
});
