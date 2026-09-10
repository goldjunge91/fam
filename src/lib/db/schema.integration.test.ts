import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

/**
 * Das lokale Schema gegen eine echte SQLite-Engine (#45).
 *
 * Laeuft ueber `node:sqlite`, nicht ueber `expo-sqlite` — siehe
 * `test/node-sqlite-adapter.ts`. Kein Mock: Die Tabellen entstehen wirklich,
 * Constraints greifen wirklich, ein Rollback dreht wirklich zurueck.
 */

const MIRROR_TABLES = [
  'storage_locations',
  'fridge_items',
  'transactions',
  'shopping_list_items',
  'shopping_category_preferences',
  'products',
  'households',
] as const;

type ColumnInfo = { name: string; type: string; notnull: number };

async function columnsOf(db: TestDatabase, table: string): Promise<ColumnInfo[]> {
  return db.getAllAsync<ColumnInfo>(`PRAGMA table_info(${table})`);
}

describe('lokales Schema', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runDrizzleMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('legt die Spiegeltabellen des lokalen Ziels an', async () => {
    const tables = await db.getAllAsync<{ name: string }>(
      "select name from sqlite_master where type = 'table' order by name",
    );
    const names = tables.map((t) => t.name);

    for (const table of MIRROR_TABLES) {
      expect(names).toContain(table);
    }
  });

  it('legt zusaetzlich households als lokalen Haushalts-Spiegel an', async () => {
    const tables = await db.getAllAsync<{ name: string }>(
      "select name from sqlite_master where type = 'table' and name = 'households'",
    );
    expect(tables).toHaveLength(1);
  });

  it('legt die Inventory-Lifecycle-Spalten und das v1-Transaktionsschema an', async () => {
    const itemColumns = (await columnsOf(db, 'fridge_items')).map((column) => column.name);
    expect(itemColumns).toEqual(
      expect.arrayContaining([
        'opened_at',
        'vacuum_sealed',
        'expiry_user_set',
        'quantity',
        'package_size',
        'package_size_unit',
        'location_id',
      ]),
    );
    const transactionColumns = (await columnsOf(db, 'transactions')).map((column) => column.name);
    expect(transactionColumns).toEqual(
      expect.arrayContaining([
        'id',
        'operation_id',
        'household_id',
        'fridge_item_id',
        'product_id',
        'actor',
        'type',
        'quantity',
        'unit',
        'location_id',
        'reason',
        'notes',
        'created_at',
        'reversal_of',
      ]),
    );
    expect(transactionColumns).not.toEqual(
      expect.arrayContaining([
        'previous_expiry_date',
        'undone',
        'origin_item_id',
        'origin_quantity',
      ]),
    );
  });

  it('erzwingt Lagerortnamen und Lagerorttypen in echter SQLite', async () => {
    const insertStorageLocation = (id: string, name: string, kind: string) =>
      db.runAsync(
        `insert into storage_locations
           (id, household_id, name, kind, sort_order, updated_at)
         values (?, ?, ?, ?, 0, 0)`,
        [id, 'household-1', name, kind],
      );

    for (const [id, kind] of [
      ['storage-fridge', 'fridge'],
      ['storage-freezer', 'freezer'],
      ['storage-pantry', 'pantry'],
      ['storage-custom', 'custom'],
    ] as const) {
      await expect(insertStorageLocation(id, 'Lagerort', kind)).resolves.toEqual(
        expect.objectContaining({ changes: 1 }),
      );
    }
    await expect(insertStorageLocation('storage-name-one', 'a', 'custom')).resolves.toEqual(
      expect.objectContaining({ changes: 1 }),
    );
    await expect(
      insertStorageLocation('storage-name-sixty', 'a'.repeat(60), 'custom'),
    ).resolves.toEqual(expect.objectContaining({ changes: 1 }));

    await expect(insertStorageLocation('storage-name-empty', '   ', 'custom')).rejects.toThrow();
    await expect(
      insertStorageLocation('storage-name-too-long', 'a'.repeat(61), 'custom'),
    ).rejects.toThrow();
    await expect(
      insertStorageLocation('storage-kind-invalid', 'Lagerort', 'garage'),
    ).rejects.toThrow();
  });

  it('erzwingt Namen, Einheiten und Packungseinheiten fuer Lose in echter SQLite', async () => {
    const insertFridgeItem = (
      id: string,
      name: string,
      unit: string,
      packageSize: number | null,
      packageSizeUnit: string | null,
    ) =>
      db.runAsync(
        `insert into fridge_items
           (id, household_id, name, quantity, unit, package_size, package_size_unit,
            location_id, updated_at)
         values (?, ?, ?, 1, ?, ?, ?, 'pantry', 0)`,
        [id, 'household-1', name, unit, packageSize, packageSizeUnit],
      );

    await expect(insertFridgeItem('item-name-one', 'a', 'piece', null, null)).resolves.toEqual(
      expect.objectContaining({ changes: 1 }),
    );
    await expect(
      insertFridgeItem('item-name-two-hundred', 'a'.repeat(200), 'piece', null, null),
    ).resolves.toEqual(expect.objectContaining({ changes: 1 }));
    await expect(insertFridgeItem('item-unit-valid', 'Milch', 'g', null, null)).resolves.toEqual(
      expect.objectContaining({ changes: 1 }),
    );
    await expect(
      insertFridgeItem('item-package-unit-valid', 'Milch', 'g', 1, 'g'),
    ).resolves.toEqual(expect.objectContaining({ changes: 1 }));

    await expect(insertFridgeItem('item-name-empty', '   ', 'piece', null, null)).rejects.toThrow();
    await expect(
      insertFridgeItem('item-name-too-long', 'a'.repeat(201), 'piece', null, null),
    ).rejects.toThrow();
    await expect(insertFridgeItem('item-unit-empty', 'Milch', '   ', null, null)).rejects.toThrow();
    await expect(
      insertFridgeItem('item-package-unit-empty', 'Milch', 'g', 1, '   '),
    ).rejects.toThrow();
  });

  it('erzwingt Ledger-Einheiten und die Notizgrenze in echter SQLite', async () => {
    const insertTransaction = (id: string, unit: string, notes: string | null) =>
      db.runAsync(
        `insert into transactions
           (id, operation_id, household_id, fridge_item_id, type, quantity, unit,
            location_id, notes, updated_at)
         values (?, ?, ?, ?, 'out', 1, ?, 'pantry', ?, 0)`,
        [id, `operation-${id}`, 'household-1', 'item-ledger', unit, notes],
      );

    await expect(insertTransaction('tx-unit-valid', 'piece', null)).resolves.toEqual(
      expect.objectContaining({ changes: 1 }),
    );
    await expect(
      insertTransaction('tx-notes-five-hundred', 'piece', 'a'.repeat(500)),
    ).resolves.toEqual(expect.objectContaining({ changes: 1 }));

    await expect(insertTransaction('tx-unit-empty', '   ', null)).rejects.toThrow();
    await expect(
      insertTransaction('tx-notes-five-hundred-one', 'piece', 'a'.repeat(501)),
    ).rejects.toThrow();
  });

  it('speichert Inventory-Mengen als REAL und erzwingt den Lagerort', async () => {
    const itemColumns = await columnsOf(db, 'fridge_items');
    const transactionColumns = await columnsOf(db, 'transactions');

    expect(itemColumns.find((column) => column.name === 'quantity')?.type.toUpperCase()).toBe(
      'REAL',
    );
    expect(itemColumns.find((column) => column.name === 'package_size')?.type.toUpperCase()).toBe(
      'REAL',
    );
    expect(itemColumns.find((column) => column.name === 'location_id')?.notnull).toBe(1);
    expect(
      transactionColumns.find((column) => column.name === 'quantity')?.type.toUpperCase(),
    ).toBe('REAL');
    expect(transactionColumns.find((column) => column.name === 'fridge_item_id')?.notnull).toBe(1);
    expect(transactionColumns.find((column) => column.name === 'operation_id')?.notnull).toBe(1);
    expect(transactionColumns.find((column) => column.name === 'location_id')?.notnull).toBe(1);

    await expect(
      db.runAsync(
        `insert into fridge_items
           (id, household_id, name, quantity, unit, location_id, updated_at)
         values (?, ?, ?, 1, 'piece', ?, 0)`,
        ['item-missing-location', 'household-1', 'Ohne Lagerort', null],
      ),
    ).rejects.toThrow();
    await expect(
      db.runAsync(
        `insert into transactions
           (id, operation_id, household_id, fridge_item_id, type, quantity, unit, location_id, updated_at)
         values (?, ?, ?, ?, 'out', 1, 'piece', ?, 0)`,
        ['tx-missing-location', 'operation-missing-location', 'household-1', 'item-ledger', null],
      ),
    ).rejects.toThrow();
  });

  it('koppelt sichtbare Lose und Tombstones an ihre Menge', async () => {
    await expect(
      db.runAsync(
        `insert into fridge_items
           (id, household_id, name, quantity, unit, location_id, deleted_at, updated_at)
         values (?, ?, ?, ?, 'piece', 'pantry', ?, 0)`,
        ['item-visible-empty', 'household-1', 'Leeres sichtbares Los', 0, null],
      ),
    ).rejects.toThrow();

    await expect(
      db.runAsync(
        `insert into fridge_items
           (id, household_id, name, quantity, unit, location_id, deleted_at, updated_at)
         values (?, ?, ?, ?, 'piece', 'pantry', ?, 0)`,
        ['item-tombstone-positive', 'household-1', 'Positiver Tombstone', 1, 1],
      ),
    ).rejects.toThrow();

    await expect(
      db.runAsync(
        `insert into fridge_items
           (id, household_id, name, quantity, unit, location_id, deleted_at, updated_at)
         values (?, ?, ?, ?, 'piece', 'pantry', ?, 0)`,
        ['item-tombstone-empty', 'household-1', 'Leerer Tombstone', 0, 1],
      ),
    ).resolves.toEqual(expect.objectContaining({ changes: 1 }));
  });

  it('erzwingt die Dezimal-Mengen-/Persistenzgrenze fuer Lose und Ledger', async () => {
    const overMax = 9_999_999.9 + 0.1;

    await expect(
      db.runAsync(
        `insert into fridge_items
           (id, household_id, name, quantity, unit, package_size, package_size_unit, location_id, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['item-half', 'household-1', 'Halbe Packung', 0.5, 'piece', 0.5, 'piece', 'pantry', 0],
      ),
    ).resolves.toEqual(expect.objectContaining({ changes: 1 }));
    await expect(
      db.runAsync(
        `insert into transactions
           (id, operation_id, household_id, fridge_item_id, type, quantity, unit, location_id, updated_at)
         values (?, ?, ?, ?, 'out', ?, ?, ?, ?)`,
        ['tx-half', 'operation-half', 'household-1', 'item-ledger', 0.5, 'piece', 'pantry', 0],
      ),
    ).resolves.toEqual(expect.objectContaining({ changes: 1 }));

    for (const [id, value] of [
      ['item-precise-quantity', 0.05],
      ['item-too-large', overMax],
    ] as const) {
      await expect(
        db.runAsync(
          `insert into fridge_items
             (id, household_id, name, quantity, unit, location_id, updated_at)
           values (?, ?, ?, ?, 'piece', 'pantry', 0)`,
          [id, 'household-1', 'Ungültige Menge', value],
        ),
      ).rejects.toThrow();
    }

    for (const [id, value] of [
      ['item-precise-package', 0.05],
      ['item-too-large-package', overMax],
    ] as const) {
      await expect(
        db.runAsync(
          `insert into fridge_items
             (id, household_id, name, quantity, unit, package_size, package_size_unit, location_id, updated_at)
           values (?, ?, ?, 1, 'piece', ?, 'piece', 'pantry', 0)`,
          [id, 'household-1', 'Ungültige Packung', value],
        ),
      ).rejects.toThrow();
    }

    await expect(
      db.runAsync(
        `insert into transactions
           (id, operation_id, household_id, fridge_item_id, type, quantity, unit, location_id, updated_at)
         values (?, ?, ?, ?, 'out', ?, ?, ?, ?)`,
        [
          'tx-precise',
          'operation-precise',
          'household-1',
          'item-ledger',
          0.05,
          'piece',
          'pantry',
          0,
        ],
      ),
    ).rejects.toThrow();
    await expect(
      db.runAsync(
        `insert into transactions
           (id, operation_id, household_id, fridge_item_id, type, quantity, unit, location_id, updated_at)
         values (?, ?, ?, ?, 'out', ?, ?, ?, ?)`,
        [
          'tx-too-large',
          'operation-too-large',
          'household-1',
          'item-ledger',
          overMax,
          'piece',
          'pantry',
          0,
        ],
      ),
    ).rejects.toThrow();
  });

  it('erzwingt die Ledger-Regeln auch lokal in SQLite', async () => {
    await expect(
      db.runAsync(
        `insert into transactions
           (id, operation_id, household_id, fridge_item_id, type, quantity, reason, location_id, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'tx-invalid-reason',
          'operation-invalid-reason',
          'household-1',
          'item-ledger',
          'out',
          1,
          'expired',
          'pantry',
          0,
        ],
      ),
    ).rejects.toThrow();
    await expect(
      db.runAsync(
        `insert into transactions
           (id, operation_id, household_id, fridge_item_id, type, quantity, location_id, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'tx-invalid-quantity',
          'operation-invalid-quantity',
          'household-1',
          'item-ledger',
          'in',
          0,
          'pantry',
          0,
        ],
      ),
    ).rejects.toThrow();
    await expect(
      db.runAsync(
        `insert into transactions
           (id, operation_id, household_id, fridge_item_id, type, quantity, reason, location_id, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'tx-unknown-waste-reason',
          'operation-unknown-waste-reason',
          'household-1',
          'item-ledger',
          'waste',
          1,
          'donated',
          'pantry',
          0,
        ],
      ),
    ).rejects.toThrow();
    for (const reason of ['expired', 'spoiled', 'other']) {
      await expect(
        db.runAsync(
          `insert into transactions
             (id, operation_id, household_id, fridge_item_id, type, quantity, reason, location_id, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `tx-valid-waste-${reason}`,
            `operation-valid-waste-${reason}`,
            'household-1',
            'item-ledger',
            'waste',
            1,
            reason,
            'pantry',
            0,
          ],
        ),
      ).resolves.toEqual(expect.objectContaining({ changes: 1 }));
    }
    await expect(
      db.runAsync(
        `insert into transactions
           (id, operation_id, household_id, fridge_item_id, type, quantity, location_id, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'tx-missing-waste-reason',
          'operation-missing-waste-reason',
          'household-1',
          'item-ledger',
          'waste',
          1,
          'pantry',
          0,
        ],
      ),
    ).rejects.toThrow();
  });

  it('beschraenkt Ledger-Typen auf in, out und waste', async () => {
    await expect(
      db.runAsync(
        `insert into transactions
           (id, operation_id, household_id, fridge_item_id, type, quantity, location_id, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'tx-operation-open',
          'operation-open',
          'household-1',
          'item-ledger',
          'open',
          1,
          'pantry',
          0,
        ],
      ),
    ).rejects.toThrow();

    for (const type of ['in', 'out', 'waste'] as const) {
      await expect(
        db.runAsync(
          `insert into transactions
             (id, operation_id, household_id, fridge_item_id, type, quantity, reason, location_id, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `tx-operation-${type}`,
            `operation-${type}`,
            'household-1',
            'item-ledger',
            type,
            1,
            type === 'waste' ? 'expired' : null,
            'pantry',
            0,
          ],
        ),
      ).resolves.toEqual(expect.objectContaining({ changes: 1 }));
    }
  });

  it('erlaubt pro operation_id hoechstens eine Ledgerzeile je Typ', async () => {
    for (const type of ['in', 'out', 'waste'] as const) {
      await db.runAsync(
        `insert into transactions
           (id, operation_id, household_id, fridge_item_id, type, quantity, reason, location_id, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `tx-unique-${type}-1`,
          'operation-unique',
          'household-1',
          'item-ledger',
          type,
          1,
          type === 'waste' ? 'expired' : null,
          'pantry',
          0,
        ],
      );

      await expect(
        db.runAsync(
          `insert into transactions
             (id, operation_id, household_id, fridge_item_id, type, quantity, reason, location_id, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `tx-unique-${type}-2`,
            'operation-unique',
            'household-1',
            'item-ledger',
            type,
            1,
            type === 'waste' ? 'expired' : null,
            'pantry',
            0,
          ],
        ),
      ).rejects.toThrow();
    }
  });

  it('erlaubt pro Einzelbuchung höchstens eine Gegenbuchung', async () => {
    await db.runAsync(
      `insert into transactions
         (id, operation_id, household_id, fridge_item_id, type, quantity, reversal_of, location_id, updated_at)
       values (?, ?, ?, ?, 'in', 1, ?, ?, 0)`,
      ['tx-reversal-1', 'operation-reversal-1', 'household-1', 'item-ledger', 'source-1', 'pantry'],
    );

    await expect(
      db.runAsync(
        `insert into transactions
           (id, operation_id, household_id, fridge_item_id, type, quantity, reversal_of, location_id, updated_at)
         values (?, ?, ?, ?, 'out', 1, ?, ?, 0)`,
        [
          'tx-reversal-2',
          'operation-reversal-2',
          'household-1',
          'item-ledger',
          'source-1',
          'pantry',
        ],
      ),
    ).rejects.toThrow();

    await expect(
      db.runAsync(
        `insert into transactions
         (id, operation_id, household_id, fridge_item_id, type, quantity, reversal_of, location_id, updated_at)
       values (?, ?, ?, ?, 'out', 1, ?, ?, 0)`,
        [
          'tx-reversal-move-1',
          'move-reversal',
          'household-1',
          'item-ledger',
          'source-move-out',
          'pantry',
        ],
      ),
    ).resolves.toEqual(expect.objectContaining({ changes: 1 }));
    await expect(
      db.runAsync(
        `insert into transactions
         (id, operation_id, household_id, fridge_item_id, type, quantity, reversal_of, location_id, updated_at)
       values (?, ?, ?, ?, 'in', 1, ?, ?, 0)`,
        [
          'tx-reversal-move-2',
          'move-reversal',
          'household-1',
          'item-ledger',
          'source-move-in',
          'pantry',
        ],
      ),
    ).resolves.toEqual(expect.objectContaining({ changes: 1 }));
    await expect(
      db.runAsync(
        `insert into transactions
           (id, operation_id, household_id, fridge_item_id, type, quantity, reversal_of, location_id, updated_at)
         values (?, ?, ?, ?, 'out', 1, ?, ?, 0)`,
        [
          'tx-reversal-move-3',
          'move-reversal-2',
          'household-1',
          'item-ledger',
          'source-move-out',
          'pantry',
        ],
      ),
    ).rejects.toThrow();
  });

  it('spiegelt Plus und AI getrennt und entfernt den alten Premium-Zustand', async () => {
    const names = (await columnsOf(db, 'households')).map((column) => column.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'plus_active',
        'plus_expires_at',
        'plus_updated_at',
        'ai_active',
        'ai_expires_at',
        'ai_updated_at',
        'ai_subscriber_id',
      ]),
    );
    expect(names).not.toEqual(
      expect.arrayContaining(['premium_active', 'premium_expires_at', 'premium_updated_at']),
    );
  });

  it('legt Outbox, Sync-Stand und app_meta an', async () => {
    const tables = await db.getAllAsync<{ name: string }>(
      "select name from sqlite_master where type = 'table'",
    );
    const names = tables.map((t) => t.name);

    expect(names).toContain('outbox');
    expect(names).toContain('sync_state');
    expect(names).toContain('app_meta');
  });

  it.each(MIRROR_TABLES)(
    'gibt %s die Sync-Spalten updated_at, deleted_at und _dirty',
    async (table) => {
      const names = (await columnsOf(db, table)).map((c) => c.name);

      expect(names).toContain('updated_at');
      expect(names).toContain('deleted_at');
      expect(names).toContain('_dirty');
    },
  );

  it.each(MIRROR_TABLES)(
    'speichert updated_at von %s als INTEGER (epoch ms), nicht als Text',
    async (table) => {
      // Zeitstempel als Text zu vergleichen ist unsicher: "+00:00" gegen "Z",
      // drei gegen sechs Nachkommastellen. Die Ordnung im Pull muss numerisch
      // sein, sonst sortiert der Cursor falsch.
      const updatedAt = (await columnsOf(db, table)).find((c) => c.name === 'updated_at');

      expect(updatedAt?.type.toUpperCase()).toBe('INTEGER');
      expect(updatedAt?.notnull).toBe(1);
    },
  );

  it('legt die Outbox mit genau den Spalten aus #46 an, plus next_attempt_at', async () => {
    const names = (await columnsOf(db, 'outbox')).map((c) => c.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'id',
        'entity',
        'entity_id',
        'op',
        'payload',
        'created_at',
        'attempts',
        'last_error',
        'next_attempt_at',
      ]),
    );
  });

  it('verwendet fuer Kategorie-Snapshots nur stabile IDs, Quelle und Klassifikatorversion', async () => {
    const itemColumns = (await columnsOf(db, 'shopping_list_items')).map((column) => column.name);
    const historyColumns = (await columnsOf(db, 'shopping_history')).map((column) => column.name);

    for (const columns of [itemColumns, historyColumns]) {
      expect(columns).not.toContain('category');
      expect(columns).toEqual(
        expect.arrayContaining(['category_id', 'category_source', 'category_classifier_version']),
      );
    }
  });

  it('spiegelt OFF-Tags als JSON-Text und den OFF-Zeitstempel im lokalen Products-Cache', async () => {
    const productColumns = (await columnsOf(db, 'products')).map((column) => column.name);

    expect(productColumns).toEqual(
      expect.arrayContaining(['off_category_tags', 'off_last_modified_at']),
    );

    await db.runAsync(
      `insert into products (id, name, updated_at)
       values ('product-1', 'Vollmilch', 1)`,
    );
    const row = await db.getFirstAsync<{ off_category_tags: string }>(
      `select off_category_tags from products where id = 'product-1'`,
    );
    expect(row?.off_category_tags).toBe('[]');
  });

  it('reserviert die natuerliche Preference-Identitaet auch fuer lokale Tombstones', async () => {
    const insert = (id: string, deletedAt: number | null) =>
      db.runAsync(
        `insert into shopping_category_preferences
           (id, household_id, key_type, normalized_key_value, category_id,
            created_at, updated_at, deleted_at, _dirty)
         values (?, 'household-1', 'name', 'vollmilch', null, '2026-08-22', 1, ?, 1)`,
        [id, deletedAt],
      );

    await insert('preference-1', 1);
    await expect(insert('preference-2', null)).rejects.toThrow();
  });

  it('erzwingt in der Outbox die drei erlaubten Operationen', async () => {
    // Echter CHECK-Constraint, kein nachgebautes Verhalten.
    await expect(
      db.runAsync(
        'insert into outbox (entity, entity_id, op, payload, created_at) values (?, ?, ?, ?, ?)',
        ['fridge_items', 'abc', 'sync', '{}', 1],
      ),
    ).rejects.toThrow();
  });

  it('vergibt Outbox-ids monoton — auch nachdem Eintraege geloescht wurden', async () => {
    // Ohne AUTOINCREMENT verwendet SQLite geloeschte rowids wieder. Weil ein
    // erfolgreicher Push seine Zeilen loescht, waeren neue Eintraege dann
    // kleiner als die noch wartenden — und die Erstellungsreihenfolge aus #46,
    // an der die Push-Schleife haengt, kehrte sich still um.
    const insert = async (entityId: string) =>
      db.runAsync(
        'insert into outbox (entity, entity_id, op, payload, created_at) values (?, ?, ?, ?, ?)',
        ['fridge_items', entityId, 'insert', '{}', 1],
      );

    const first = await insert('a');
    const second = await insert('b');
    await db.runAsync('delete from outbox');
    const third = await insert('c');

    expect(second.lastInsertRowId).toBeGreaterThan(first.lastInsertRowId);
    expect(third.lastInsertRowId).toBeGreaterThan(second.lastInsertRowId);
  });
});
