import { createLocalProductSource } from '@/features/product-search/sources/local-product-source';

const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();

jest.mock('@/lib/db/client', () => ({
  getDatabase: async () => ({ getAllAsync: mockGetAllAsync, getFirstAsync: mockGetFirstAsync }),
}));

const row = {
  id: 'p1',
  barcode: '400',
  name: 'Hafermilch',
  brand: 'Marke',
  kcal_per_100: 45,
  protein_g_per_100: 1,
  carbs_g_per_100: 6,
  fat_g_per_100: 1.5,
  off_category_tags: '["en:plant-milks"]',
  off_last_modified_at: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  mockGetAllAsync.mockReset().mockResolvedValue([]);
  mockGetFirstAsync.mockReset().mockResolvedValue(null);
});

describe('createLocalProductSource.search', () => {
  it('bildet eine Zeile auf ein CatalogProduct mit lokaler Identitaet ab', async () => {
    mockGetAllAsync.mockResolvedValue([row]);

    const result = await createLocalProductSource().search('Hafermilch', { offset: 0, limit: 20 });

    expect(result.products).toEqual([
      expect.objectContaining({
        productId: 'p1',
        barcode: '400',
        name: 'Hafermilch',
        brand: 'Marke',
        caloriesPer100g: 45,
        categoryTags: ['en:plant-milks'],
      }),
    ]);
  });

  it('reicht Offset und Limit an die Abfrage durch', async () => {
    await createLocalProductSource().search('Hafer Milch', { offset: 40, limit: 20 });

    const [, params] = mockGetAllAsync.mock.calls[0];
    expect(params.slice(-2)).toEqual([20, 40]);
  });

  it('meldet hasMore, wenn die Seite voll ist', async () => {
    mockGetAllAsync.mockResolvedValue([row, row]);

    const result = await createLocalProductSource().search('Hafermilch', { offset: 0, limit: 2 });

    expect(result.hasMore).toBe(true);
  });

  it('sucht nicht, wenn die Eingabe nur aus einer Mengenangabe besteht', async () => {
    const result = await createLocalProductSource().search('1 l', { offset: 0, limit: 20 });

    expect(mockGetAllAsync).not.toHaveBeenCalled();
    expect(result.products).toEqual([]);
  });

  it('liefert bei einem Datenbankfehler ein leeres Ergebnis statt zu werfen', async () => {
    mockGetAllAsync.mockRejectedValue(new Error('database is locked'));

    await expect(
      createLocalProductSource().search('Hafermilch', { offset: 0, limit: 20 }),
    ).resolves.toEqual({ products: [], hasMore: false, failed: false });
  });
});

describe('createLocalProductSource.findByBarcode', () => {
  it('findet ein eigenes Produkt ueber seinen Barcode', async () => {
    mockGetFirstAsync.mockResolvedValue(row);

    const found = await createLocalProductSource().findByBarcode(' 400 ');

    expect(mockGetFirstAsync.mock.calls[0][1]).toEqual(['400']);
    expect(found?.productId).toBe('p1');
  });

  it('liefert null, wenn der Barcode unbekannt ist', async () => {
    await expect(createLocalProductSource().findByBarcode('999')).resolves.toBeNull();
  });

  it('liefert bei einem Datenbankfehler null', async () => {
    mockGetFirstAsync.mockRejectedValue(new Error('no such table'));

    await expect(createLocalProductSource().findByBarcode('400')).resolves.toBeNull();
  });
});
