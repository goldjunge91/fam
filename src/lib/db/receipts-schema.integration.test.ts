import {
  applyLocalSchema,
  createTestDatabase,
  type TestDatabase,
} from '../../../test/node-sqlite-adapter';

type ColumnInfo = { name: string; type: string; notnull: number };

async function columnsOf(db: TestDatabase, table: string): Promise<ColumnInfo[]> {
  return db.getAllAsync<ColumnInfo>(`PRAGMA table_info(${table})`);
}

async function migrateFreshDatabase(): Promise<TestDatabase> {
  const db = createTestDatabase();
  await applyLocalSchema(db);
  return db;
}

describe('lokaler Receipt-Spiegel', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await migrateFreshDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('legt Receipts und Items mit Sync-, EUR- und Lifecycle-Vertrag an', async () => {
    expect(await columnsOf(db, 'purchase_receipts')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'id' }),
        expect.objectContaining({ name: 'household_id' }),
        expect.objectContaining({ name: 'store_id' }),
        expect.objectContaining({ name: 'purchase_date' }),
        expect.objectContaining({ name: 'currency' }),
        expect.objectContaining({ name: 'total_cents' }),
        expect.objectContaining({ name: 'processing_status' }),
        expect.objectContaining({ name: 'created_by' }),
        expect.objectContaining({ name: 'confirmed_by' }),
        expect.objectContaining({ name: 'confirmed_at' }),
        expect.objectContaining({ name: 'created_at' }),
        expect.objectContaining({ name: 'updated_at' }),
        expect.objectContaining({ name: 'deleted_at' }),
        expect.objectContaining({ name: '_dirty' }),
      ]),
    );
    expect(await columnsOf(db, 'purchase_receipt_items')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'id' }),
        expect.objectContaining({ name: 'receipt_id' }),
        expect.objectContaining({ name: 'household_id' }),
        expect.objectContaining({ name: 'position' }),
        expect.objectContaining({ name: 'name' }),
        expect.objectContaining({ name: 'product_id' }),
        expect.objectContaining({ name: 'category_id' }),
        expect.objectContaining({ name: 'quantity' }),
        expect.objectContaining({ name: 'unit' }),
        expect.objectContaining({ name: 'package_size' }),
        expect.objectContaining({ name: 'package_size_unit' }),
        expect.objectContaining({ name: 'line_total_cents' }),
        expect.objectContaining({ name: 'review_status' }),
        expect.objectContaining({ name: 'created_at' }),
        expect.objectContaining({ name: 'updated_at' }),
        expect.objectContaining({ name: 'deleted_at' }),
        expect.objectContaining({ name: '_dirty' }),
      ]),
    );

    await expect(
      db.runAsync(
        `insert into purchase_receipts
          (id, household_id, currency, total_cents, processing_status, updated_at, _dirty)
         values (?, ?, ?, ?, ?, ?, ?)`,
        ['receipt-valid', 'household-1', 'EUR', 1299, 'draft', 1, 1],
      ),
    ).resolves.toEqual(expect.objectContaining({ changes: 1 }));
    await expect(
      db.runAsync(
        `insert into purchase_receipt_items
          (id, receipt_id, household_id, position, name, line_total_cents, review_status, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['item-valid', 'receipt-valid', 'household-1', 0, 'Milch', 1299, 'needs_review', 1],
      ),
    ).resolves.toEqual(expect.objectContaining({ changes: 1 }));

    for (const values of [
      ['receipt-invalid-currency', 'household-1', 'USD', 100, 'draft', 1, 1],
      ['receipt-invalid-total', 'household-1', 'EUR', -1, 'draft', 1, 1],
      ['receipt-invalid-status', 'household-1', 'EUR', 100, 'confirmed-ish', 1, 1],
    ]) {
      await expect(
        db.runAsync(
          `insert into purchase_receipts
            (id, household_id, currency, total_cents, processing_status, updated_at, _dirty)
           values (?, ?, ?, ?, ?, ?, ?)`,
          values,
        ),
      ).rejects.toThrow();
    }

    for (const values of [
      [
        'item-invalid-position',
        'receipt-valid',
        'household-1',
        -1,
        'Joghurt',
        null,
        'needs_review',
        1,
      ],
      ['item-invalid-total', 'receipt-valid', 'household-1', 1, 'Brot', -1, 'needs_review', 1],
      ['item-invalid-status', 'receipt-valid', 'household-1', 2, 'Käse', 100, 'draft', 1],
    ]) {
      await expect(
        db.runAsync(
          `insert into purchase_receipt_items
            (id, receipt_id, household_id, position, name, line_total_cents, review_status, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?)`,
          values,
        ),
      ).rejects.toThrow();
    }
  });

  it('unterstützt Offline-Update, Soft-Delete und Restore ohne Assets', async () => {
    await db.runAsync(
      `insert into purchase_receipts
        (id, household_id, currency, processing_status, updated_at, _dirty)
       values (?, ?, ?, ?, ?, ?)`,
      ['receipt-lifecycle', 'household-1', 'EUR', 'draft', 1, 1],
    );

    await db.runAsync(
      `insert into purchase_receipt_items
        (id, receipt_id, household_id, position, name, review_status, updated_at, _dirty)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['item-lifecycle', 'receipt-lifecycle', 'household-1', 0, 'Brot', 'needs_review', 1, 1],
    );
    await db.runAsync(
      `update purchase_receipts
          set processing_status = ?, total_cents = ?, updated_at = ?, _dirty = ?
        where id = ?`,
      ['confirmed', 249, 2, 1, 'receipt-lifecycle'],
    );
    await db.runAsync(
      `update purchase_receipts set deleted_at = ?, updated_at = ?, _dirty = ? where id = ?`,
      [3, 3, 1, 'receipt-lifecycle'],
    );
    await db.runAsync(
      `update purchase_receipts set deleted_at = null, updated_at = ?, _dirty = ? where id = ?`,
      [4, 4, 'receipt-lifecycle'],
    );

    await expect(
      db.getFirstAsync<{
        processing_status: string;
        total_cents: number;
        deleted_at: number | null;
      }>('select processing_status, total_cents, deleted_at from purchase_receipts where id = ?', [
        'receipt-lifecycle',
      ]),
    ).resolves.toEqual({ processing_status: 'confirmed', total_cents: 249, deleted_at: null });
    await expect(
      db.getFirstAsync<{ _dirty: number }>(
        'select _dirty from purchase_receipt_items where id = ?',
        ['item-lifecycle'],
      ),
    ).resolves.toEqual({ _dirty: 1 });

    const tables = await db.getAllAsync<{ name: string }>(
      "select name from sqlite_master where type = 'table' order by name",
    );
    expect(tables.map(({ name }) => name)).not.toContain('receipt_assets');
    expect(tables.map(({ name }) => name)).not.toContain('receipt_asset');
    const schemaSql = await db.getAllAsync<{ sql: string | null }>(
      'select sql from sqlite_master where sql is not null',
    );
    expect(
      schemaSql.some(({ sql }) =>
        /receipt_assets|receipt_asset|image_bytes|byte_size/i.test(sql ?? ''),
      ),
    ).toBe(false);
  });
});
