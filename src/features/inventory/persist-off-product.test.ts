import type { CatalogProduct } from '@/features/product-search/types';
import { getDatabase } from '@/lib/db/local-client';
import { persistOffProductIfNeeded } from './persist-off-product';
import { triggerOffEnrichment } from './trigger-off-enrichment';
import type { useAddProductMutation } from './use-product-mutations';

const mockGetFirstAsync = jest.fn();
const mockGetDatabase = jest.mocked(getDatabase);
const mockTriggerOffEnrichment = jest.mocked(triggerOffEnrichment);
const mockMutateAsync = jest.fn();

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('./trigger-off-enrichment', () => ({
  triggerOffEnrichment: jest.fn(),
}));

const mutation = { mutateAsync: mockMutateAsync } as unknown as ReturnType<
  typeof useAddProductMutation
>;

function product(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return { name: 'Haferdrink', barcode: '4006381333931', categoryTags: [], ...overrides };
}

describe('persistOffProductIfNeeded', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDatabase.mockResolvedValue({ getFirstAsync: mockGetFirstAsync } as never);
    mockGetFirstAsync.mockResolvedValue(null);
    mockMutateAsync.mockResolvedValue({ id: 'product-created' });
  });

  test('does not open the database without a user', async () => {
    await expect(persistOffProductIfNeeded(product(), undefined, mutation)).resolves.toBeNull();
    expect(mockGetDatabase).not.toHaveBeenCalled();
  });

  test('uses an existing product id before checking its barcode', async () => {
    mockGetFirstAsync.mockResolvedValueOnce({ id: 'product-existing' });

    await expect(
      persistOffProductIfNeeded(product({ productId: 'product-existing' }), 'user-1', mutation),
    ).resolves.toBe('product-existing');
    expect(mockGetFirstAsync).toHaveBeenCalledTimes(1);
    expect(mockTriggerOffEnrichment).not.toHaveBeenCalled();
  });

  test('falls back to barcode lookup when a catalog id is not in the local database', async () => {
    mockGetFirstAsync.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(
      persistOffProductIfNeeded(product({ productId: 'product-not-local' }), 'user-1', mutation),
    ).resolves.toBe('product-created');
    expect(mockGetFirstAsync).toHaveBeenCalledTimes(2);
  });

  test('skips products without a barcode and reuses barcode matches', async () => {
    await expect(
      persistOffProductIfNeeded(product({ barcode: '' }), 'user-1', mutation),
    ).resolves.toBeNull();
    expect(mockTriggerOffEnrichment).not.toHaveBeenCalled();

    mockGetFirstAsync.mockResolvedValueOnce({ id: 'product-by-barcode' });
    await expect(persistOffProductIfNeeded(product(), 'user-1', mutation)).resolves.toBe(
      'product-by-barcode',
    );
    expect(mockTriggerOffEnrichment).toHaveBeenCalledWith('4006381333931');
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  test('persists an enriched catalog product when no local match exists', async () => {
    const result = await persistOffProductIfNeeded(
      product({
        brand: 'Hafergut',
        caloriesPer100g: 46,
        proteinsPer100g: 1,
        carbsPer100g: 6,
        fatPer100g: 2,
        sugarsPer100g: 3,
        saltPer100g: 0.1,
      }),
      'user-1',
      mutation,
    );

    expect(result).toBe('product-created');
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        barcode: '4006381333931',
        name: 'Haferdrink',
        brand: 'Hafergut',
        kcal_per_100: 46,
        protein_g_per_100: 1,
        carbs_g_per_100: 6,
        fat_g_per_100: 2,
        sugar_g_per_100: 3,
        salt_g_per_100: 0.1,
        source: 'off',
        created_by: 'user-1',
      }),
    );
  });
});
