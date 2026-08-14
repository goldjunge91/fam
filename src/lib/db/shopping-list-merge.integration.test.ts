import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { addOrMergeShoppingItem } from '@/lib/db/shopping-list-merge';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

/**
 * `addOrMergeShoppingItem` gegen eine echte SQLite-Engine — kein Mock.
 *
 * Deckt zwei Nutzer-Anforderungen ab: gleiche Artikel duerfen nicht doppelt
 * auf der Einkaufsliste landen (egal ob vom Wochenplaner oder manuell
 * hinzugefuegt), und Mengen sollen sich zusammenfuehren statt nebeneinander
 * zu existieren — auch wenn ein Artikel aus einem Rezept stammt und ein
 * anderer manuell eingetragen wurde.
 */

async function readItems(db: TestDatabase, householdId: string) {
  return db.getAllAsync<{
    id: string;
    product_id: string | null;
    name: string;
    quantity: number;
    unit: string;
    checked_at: string | null;
  }>(
    'select id, product_id, name, quantity, unit, checked_at from shopping_list_items where household_id = ? and deleted_at is null order by sort_index',
    [householdId],
  );
}

describe('addOrMergeShoppingItem', () => {
  let db: TestDatabase;
  let nextId: number;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    nextId = 1;
  });

  afterEach(() => {
    db.close();
  });

  /** Erzeugt eine im Test eindeutige id — Produktions-Code liefert `Crypto.randomUUID()`. */
  function add(input: Parameters<typeof addOrMergeShoppingItem>[2]) {
    return addOrMergeShoppingItem(db, `item-${nextId++}`, input);
  }

  it('legt einen neuen Artikel an, wenn noch keiner mit passendem Produkt/Name existiert', async () => {
    await add({
      household_id: 'hh-1',
      name: 'Mehl',
      quantity: 500,
      unit: 'g',
      product_id: 'prod-mehl',
    });

    const items = await readItems(db, 'hh-1');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: 'Mehl', quantity: 500, unit: 'g' });
  });

  it('fuehrt zwei Artikel mit demselben Produkt zusammen, statt ein Duplikat anzulegen', async () => {
    // Simuliert: Rezept A braucht 300g Mehl, Rezept B (Wochenplaner) 200g.
    await add({
      household_id: 'hh-1',
      name: 'Mehl',
      quantity: 300,
      unit: 'g',
      product_id: 'prod-mehl',
    });
    await add({
      household_id: 'hh-1',
      name: 'Mehl',
      quantity: 200,
      unit: 'g',
      product_id: 'prod-mehl',
    });

    const items = await readItems(db, 'hh-1');
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(500);
  });

  it('fuehrt auch ohne product_id anhand des normalisierten Namens zusammen', async () => {
    await add({ household_id: 'hh-1', name: 'Butter', quantity: 1, unit: 'piece' });
    await add({ household_id: 'hh-1', name: ' butter ', quantity: 2, unit: 'piece' });

    const items = await readItems(db, 'hh-1');
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
  });

  it('legt einen neuen Eintrag an, wenn sich die Einheit unterscheidet, statt falsch zu summieren', async () => {
    await add({
      household_id: 'hh-1',
      name: 'Milch',
      quantity: 1,
      unit: 'l',
      product_id: 'prod-milch',
    });
    await add({
      household_id: 'hh-1',
      name: 'Milch',
      quantity: 1,
      unit: 'package',
      product_id: 'prod-milch',
    });

    const items = await readItems(db, 'hh-1');
    expect(items).toHaveLength(2);
  });

  it('fuehrt NICHT mit einem bereits abgehakten Artikel zusammen, sondern legt einen neuen Bedarf an', async () => {
    const firstId = await add({
      household_id: 'hh-1',
      name: 'Zucker',
      quantity: 1,
      unit: 'kg',
      product_id: 'prod-zucker',
    });
    await db.runAsync('update shopping_list_items set checked_at = ? where id = ?', [
      new Date().toISOString(),
      firstId,
    ]);

    await add({
      household_id: 'hh-1',
      name: 'Zucker',
      quantity: 1,
      unit: 'kg',
      product_id: 'prod-zucker',
    });

    const items = await readItems(db, 'hh-1');
    expect(items).toHaveLength(2);
    expect(items.filter((i) => i.checked_at === null)).toHaveLength(1);
  });

  it('vermischt Artikel verschiedener Haushalte nicht', async () => {
    await add({
      household_id: 'hh-1',
      name: 'Reis',
      quantity: 1,
      unit: 'kg',
      product_id: 'prod-reis',
    });
    await add({
      household_id: 'hh-2',
      name: 'Reis',
      quantity: 1,
      unit: 'kg',
      product_id: 'prod-reis',
    });

    expect(await readItems(db, 'hh-1')).toHaveLength(1);
    expect(await readItems(db, 'hh-2')).toHaveLength(1);
  });
});
