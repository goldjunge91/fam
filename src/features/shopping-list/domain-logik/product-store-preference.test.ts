import type { SqlDatabase } from '@/lib/db/types';
import { findLastStoreForProduct } from './product-store-preference';

function createDatabase(rows: Array<{ store_id: string | null }>): SqlDatabase {
  return {
    execAsync: jest.fn(),
    runAsync: jest.fn(),
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn().mockImplementation(async () => rows.shift() ?? null),
    withExclusiveTransactionAsync: jest.fn(),
  };
}

describe('findLastStoreForProduct', () => {
  it('nimmt den letzten Markt ueber die exakte product_id', async () => {
    const db = createDatabase([{ store_id: 'store-rewe' }]);

    await expect(
      findLastStoreForProduct(db, {
        householdId: 'household-1',
        productId: 'product-1',
        barcode: '4001234567890',
        name: 'Hafermilch',
      }),
    ).resolves.toBe('store-rewe');

    expect(db.getFirstAsync).toHaveBeenCalledTimes(1);
  });

  it('faellt fuer einen neuen Scan auf EAN und danach auf Namen zurueck', async () => {
    const db = createDatabase([{ store_id: null }, { store_id: 'store-edeka' }]);

    await expect(
      findLastStoreForProduct(db, {
        householdId: 'household-1',
        barcode: '4001234567890',
        name: 'Hafermilch',
      }),
    ).resolves.toBe('store-edeka');

    expect(db.getFirstAsync).toHaveBeenCalledTimes(2);
  });
});
