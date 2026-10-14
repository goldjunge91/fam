import type { SqlDatabase, SqlParam } from '@/lib/db/types';
import {
  getFrequentProductUsage,
  type ProductUsageEntry,
  type ProductUsageRow,
  recordProductUsage,
} from './product-usage';

function createDatabase(rows: ProductUsageRow[] = []) {
  const runAsync = jest.fn(async (_source: string, _params?: readonly SqlParam[]) => ({
    changes: 1,
    lastInsertRowId: 3,
  }));
  const getAllAsync = jest.fn(async (_source: string, _params?: readonly SqlParam[]) => rows);
  return {
    db: { runAsync, getAllAsync } as unknown as SqlDatabase,
    runAsync,
    getAllAsync,
  };
}

describe('product usage persistence', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores absent optional values as null and stamps the current time', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-11T10:00:00.000Z'));
    const { db, runAsync } = createDatabase();
    const entry: ProductUsageEntry = {
      id: 'usage-1',
      userId: 'user-1',
      feature: 'fridge',
      name: 'Haferdrink',
    };

    await recordProductUsage(db, entry);

    expect(runAsync).toHaveBeenCalledWith(expect.stringContaining('insert into product_usage'), [
      'usage-1',
      'user-1',
      null,
      'fridge',
      null,
      null,
      'Haferdrink',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      '2026-10-11T10:00:00.000Z',
    ]);
  });

  it('preserves supplied product, nutrition, household, and meal values', async () => {
    const { db, runAsync } = createDatabase();

    await recordProductUsage(db, {
      id: 'usage-2',
      userId: 'user-2',
      householdId: 'household-2',
      feature: 'diary',
      mealType: 'lunch',
      productId: 'product-2',
      name: 'Joghurt',
      brand: 'Fam',
      barcode: '12345',
      unit: 'g',
      quantity: 150,
      kcal: 90,
      proteinG: 12,
      carbsG: 4,
      fatG: 2,
      usedAt: '2026-10-10T12:00:00.000Z',
    });

    expect(runAsync.mock.calls[0]?.[1]).toEqual([
      'usage-2',
      'user-2',
      'household-2',
      'diary',
      'lunch',
      'product-2',
      'Joghurt',
      'Fam',
      '12345',
      'g',
      150,
      90,
      12,
      4,
      2,
      '2026-10-10T12:00:00.000Z',
    ]);
  });

  it('queries frequent and recent usage with their respective defaults and sort orders', async () => {
    const rows: ProductUsageRow[] = [
      {
        name: 'Haferdrink',
        brand: null,
        barcode: null,
        product_id: null,
        unit: 'ml',
        quantity: 200,
        kcal: 80,
        protein_g: 2,
        carbs_g: 12,
        fat_g: 3,
        used_at: '2026-10-11T10:00:00.000Z',
      },
    ];
    const { db, getAllAsync } = createDatabase(rows);

    await expect(
      getFrequentProductUsage(db, { userId: 'user-1', feature: 'shopping_list' }),
    ).resolves.toBe(rows);
    expect(getAllAsync.mock.calls[0]?.[0]).toContain('order by freq desc, used_at desc');
    expect(getAllAsync.mock.calls[0]?.[1]).toEqual(['user-1', 'shopping_list', null, null, 200]);

    await getFrequentProductUsage(db, {
      userId: 'user-1',
      feature: 'diary',
      mealType: 'dinner',
      limit: 25,
      mode: 'recent',
    });
    expect(getAllAsync.mock.calls[1]?.[0]).toContain('order by used_at desc');
    expect(getAllAsync.mock.calls[1]?.[1]).toEqual(['user-1', 'diary', 'dinner', 'dinner', 25]);
  });
});
