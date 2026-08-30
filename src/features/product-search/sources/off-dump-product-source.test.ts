import {
  createOffDumpProductSource,
  toCatalogProductFromDumpRow,
} from '@/features/product-search/sources/off-dump-product-source';

const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();

jest.mock('@/lib/db/client', () => ({
  getDatabase: async () => ({ getAllAsync: mockGetAllAsync, getFirstAsync: mockGetFirstAsync }),
}));

const row = {
  code: '4001234567890',
  product_name: 'Vollmilch',
  brand: 'Milsani',
  quantity: '1 l',
  nutriscore: 'b',
  energy_kcal: 64,
  fat: 3.5,
  saturated_fat: 2.3,
  carbohydrates: 4.8,
  sugars: 4.8,
  proteins: 3.4,
  salt: 0.1,
  categories_tags: '["en:milks"]',
  off_last_modified_at: '2026-02-02T00:00:00.000Z',
  image_url: 'https://images.off/4001234567890.jpg',
};

beforeEach(() => {
  mockGetAllAsync.mockReset().mockResolvedValue([]);
  mockGetFirstAsync.mockReset().mockResolvedValue(null);
});

describe('createOffDumpProductSource.search', () => {
  it('bildet eine Dump-Zeile inklusive Menge und Einheit ab', async () => {
    mockGetAllAsync.mockResolvedValue([row]);

    const result = await createOffDumpProductSource().search('Vollmilch', { offset: 0, limit: 20 });

    expect(result.products[0]).toMatchObject({
      barcode: '4001234567890',
      name: 'Vollmilch',
      brand: 'Milsani',
      quantity: 1,
      unit: 'l',
      caloriesPer100g: 64,
      nutriScore: 'b',
      categoryTags: ['en:milks'],
      imageUrl: 'https://images.off/4001234567890.jpg',
    });
    // Dump-Treffer haben keine lokale Produktidentitaet.
    expect(result.products[0].productId).toBeUndefined();
  });

  it('sucht mit einzelnen Tokens statt der ganzen Phrase', async () => {
    await createOffDumpProductSource().search('1l coca cola', { offset: 0, limit: 20 });

    const [, params] = mockGetAllAsync.mock.calls[0];
    expect(params.slice(0, 4)).toEqual(['%coca%', '%coca%', '%cola%', '%cola%']);
  });

  it('liefert bei nicht angehaengtem Dump ein leeres Ergebnis statt zu werfen', async () => {
    mockGetAllAsync.mockRejectedValue(new Error('no such table: off_dump.products'));

    await expect(
      createOffDumpProductSource().search('Vollmilch', { offset: 0, limit: 20 }),
    ).resolves.toEqual({ products: [], hasMore: false, failed: false });
  });
});

describe('createOffDumpProductSource.findByBarcode', () => {
  it('findet einen Barcode im Dump', async () => {
    mockGetFirstAsync.mockResolvedValue(row);

    const found = await createOffDumpProductSource().findByBarcode('4001234567890');

    expect(found?.name).toBe('Vollmilch');
  });

  it('liefert bei nicht angehaengtem Dump null', async () => {
    mockGetFirstAsync.mockRejectedValue(new Error('no such table: off_dump.products'));

    await expect(createOffDumpProductSource().findByBarcode('4001234567890')).resolves.toBeNull();
  });
});

describe('toCatalogProductFromDumpRow', () => {
  it('mappt DB-Zeile korrekt in CatalogProduct', () => {
    const product = toCatalogProductFromDumpRow({
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
    const product = toCatalogProductFromDumpRow({
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
    const product = toCatalogProductFromDumpRow({
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
    const product = toCatalogProductFromDumpRow({
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
