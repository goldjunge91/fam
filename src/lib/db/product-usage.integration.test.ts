import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import {
  getFrequentProductUsage,
  type ProductUsageEntry,
  recordProductUsage,
} from '@/lib/db/product-usage';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

/**
 * Nutzungshistorie (#79) gegen eine echte SQLite-Engine — kein Mock.
 */

function usage(overrides: Partial<ProductUsageEntry> = {}): ProductUsageEntry {
  return {
    id: `usage-${Math.random()}`,
    userId: 'user-1',
    feature: 'fridge',
    name: 'Milch',
    ...overrides,
  };
}

describe('product_usage', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
  });

  afterEach(() => {
    db.close();
  });

  it('protokolliert eine Verwendung und liest sie zurueck', async () => {
    await recordProductUsage(db, usage({ id: 'u-1', name: 'Milch', unit: 'l' }));

    const rows = await getFrequentProductUsage(db, { userId: 'user-1', feature: 'fridge' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Milch', unit: 'l' });
  });

  it('trennt nach feature — Vorrat-Nutzung taucht nicht in der Einkaufsliste auf', async () => {
    await recordProductUsage(db, usage({ id: 'u-1', feature: 'fridge', name: 'Milch' }));
    await recordProductUsage(db, usage({ id: 'u-2', feature: 'shopping_list', name: 'Brot' }));

    const fridgeRows = await getFrequentProductUsage(db, { userId: 'user-1', feature: 'fridge' });
    expect(fridgeRows.map((r) => r.name)).toEqual(['Milch']);

    const shoppingRows = await getFrequentProductUsage(db, {
      userId: 'user-1',
      feature: 'shopping_list',
    });
    expect(shoppingRows.map((r) => r.name)).toEqual(['Brot']);
  });

  it('schraenkt das Tagebuch auf die angefragte Mahlzeitart ein (#79 AC)', async () => {
    await recordProductUsage(
      db,
      usage({ id: 'u-1', feature: 'diary', mealType: 'breakfast', name: 'Haferflocken' }),
    );
    await recordProductUsage(
      db,
      usage({ id: 'u-2', feature: 'diary', mealType: 'dinner', name: 'Nudeln' }),
    );

    const breakfastRows = await getFrequentProductUsage(db, {
      userId: 'user-1',
      feature: 'diary',
      mealType: 'breakfast',
    });
    expect(breakfastRows.map((r) => r.name)).toEqual(['Haferflocken']);
  });

  it('trennt nach user_id — kein Datenleck zwischen Nutzern auf demselben Geraet', async () => {
    await recordProductUsage(db, usage({ id: 'u-1', userId: 'user-1', name: 'Milch' }));
    await recordProductUsage(db, usage({ id: 'u-2', userId: 'user-2', name: 'Kaese' }));

    const rows = await getFrequentProductUsage(db, { userId: 'user-1', feature: 'fridge' });
    expect(rows.map((r) => r.name)).toEqual(['Milch']);
  });

  it('liefert neueste zuerst, damit der Aufrufer Haeufigkeit/Aktualitaet daraus ableiten kann', async () => {
    await recordProductUsage(
      db,
      usage({ id: 'u-1', name: 'Milch', usedAt: '2026-01-01T10:00:00.000Z' }),
    );
    await recordProductUsage(
      db,
      usage({ id: 'u-2', name: 'Butter', usedAt: '2026-01-01T11:00:00.000Z' }),
    );
    await recordProductUsage(
      db,
      usage({ id: 'u-3', name: 'Kaese', usedAt: '2026-01-01T12:00:00.000Z' }),
    );

    const rows = await getFrequentProductUsage(db, { userId: 'user-1', feature: 'fridge' });
    expect(rows.map((r) => r.name)).toEqual(['Kaese', 'Butter', 'Milch']);
  });
});
