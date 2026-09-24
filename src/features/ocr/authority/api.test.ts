import type { TypedSupabaseClient } from '@/lib/backend/supabase/remote-client';
import type { SqlDatabase } from '@/lib/db/types';
import {
  applyLocalSchema,
  createTestDatabase,
  type TestDatabase,
} from '../../../../test/node-sqlite-adapter';
import {
  confirmReceipt,
  confirmReceiptItem,
  createReceipt,
  createReceiptAssetSignedUrl,
  createReceiptItem,
  deleteReceipt,
  deleteReceiptAsset,
  deleteReceiptItem,
  deleteReceiptPermanently,
  getConfirmedReceiptItems,
  getConfirmedReceipts,
  getReceipt,
  getReceiptItems,
  getReceipts,
  listReceiptAssets,
  reopenReceipt,
  restoreReceiptItem,
  saveReceiptReview,
  updateReceipt,
  updateReceiptItem,
} from './api';

const HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const RECEIPT_ID = '00000000-0000-0000-0000-000000000003';
const ITEM_ID = '00000000-0000-0000-0000-000000000004';
const ASSET_ID = '00000000-0000-0000-0000-000000000005';
const NOW = new Date('2026-09-21T10:00:00.000Z');

function dependencies(db: SqlDatabase) {
  return { db, now: () => NOW };
}

async function createReceiptFixture(
  db: SqlDatabase,
  status: 'draft' | 'needs_review' = 'needs_review',
) {
  await createReceipt(
    {
      id: RECEIPT_ID,
      householdId: HOUSEHOLD_ID,
      createdBy: USER_ID,
      currency: 'EUR',
      totalCents: 1299,
      processingStatus: status,
    },
    dependencies(db),
  );
}

async function createItemFixture(db: SqlDatabase) {
  await createReceiptFixture(db);
  await createReceiptItem(
    {
      id: ITEM_ID,
      receiptId: RECEIPT_ID,
      householdId: HOUSEHOLD_ID,
      position: 0,
      name: 'Milch',
      productId: null,
      categoryId: 'dairy',
      quantity: 1,
      unit: 'piece',
      packageSize: null,
      packageSizeUnit: null,
      lineTotalCents: 199,
      reviewStatus: 'needs_review',
    },
    dependencies(db),
  );
}

async function createDatabase(): Promise<TestDatabase> {
  const db = createTestDatabase();
  await applyLocalSchema(db);

  return db;
}

describe('receipt-authority local-first API', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await createDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('legt Receipt sofort lokal an und schreibt eine vollständige Outbox-Mutation', async () => {
    await createReceiptFixture(db, 'draft');

    const receipt = await getReceipt(db, HOUSEHOLD_ID, RECEIPT_ID);
    expect(receipt).toMatchObject({
      id: RECEIPT_ID,
      household_id: HOUSEHOLD_ID,
      currency: 'EUR',
      total_cents: 1299,
      processing_status: 'draft',
      created_by: USER_ID,
      _dirty: 1,
    });

    const outbox = await db.getAllAsync<{ entity: string; op: string; payload: string }>(
      'select entity, op, payload from outbox where entity_id = ?',
      [RECEIPT_ID],
    );
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ entity: 'purchase_receipts', op: 'insert' });
    expect(JSON.parse(outbox[0]?.payload ?? '{}')).toMatchObject({
      id: RECEIPT_ID,
      household_id: HOUSEHOLD_ID,
      currency: 'EUR',
      total_cents: 1299,
    });
  });

  it('liest nur den eigenen Haushalt und blendet Tombstones aus', async () => {
    await createReceiptFixture(db);
    await createReceipt(
      {
        id: '00000000-0000-0000-0000-000000000006',
        householdId: '00000000-0000-0000-0000-000000000007',
        createdBy: USER_ID,
        currency: 'EUR',
      },
      dependencies(db),
    );
    await deleteReceipt({ householdId: HOUSEHOLD_ID, receiptId: RECEIPT_ID }, dependencies(db));

    expect((await getReceipts(db, HOUSEHOLD_ID)).map((row) => row.id)).toEqual([]);
    expect(await getReceipt(db, HOUSEHOLD_ID, RECEIPT_ID)).toBeNull();
    expect(
      (await getReceipts(db, '00000000-0000-0000-0000-000000000007')).map((row) => row.id),
    ).toEqual(['00000000-0000-0000-0000-000000000006']);
  });

  it('liefert für die Historie nur bestätigte Receipts in deterministischer Reihenfolge', async () => {
    await createReceipt(
      {
        id: '00000000-0000-0000-0000-000000000010',
        householdId: HOUSEHOLD_ID,
        createdBy: USER_ID,
        purchaseDate: '2026-09-20',
        processingStatus: 'confirmed',
      },
      { db, now: () => new Date('2026-09-21T10:00:00.000Z') },
    );
    await createReceipt(
      {
        id: '00000000-0000-0000-0000-000000000011',
        householdId: HOUSEHOLD_ID,
        createdBy: USER_ID,
        purchaseDate: '2026-09-21',
        processingStatus: 'needs_review',
      },
      { db, now: () => new Date('2026-09-21T10:02:00.000Z') },
    );
    await createReceipt(
      {
        id: '00000000-0000-0000-0000-000000000012',
        householdId: HOUSEHOLD_ID,
        createdBy: USER_ID,
        purchaseDate: '2026-09-21',
        processingStatus: 'confirmed',
      },
      { db, now: () => new Date('2026-09-21T10:02:00.000Z') },
    );
    await createReceipt(
      {
        id: '00000000-0000-0000-0000-000000000013',
        householdId: HOUSEHOLD_ID,
        createdBy: USER_ID,
        purchaseDate: '2026-09-21',
        processingStatus: 'confirmed',
      },
      { db, now: () => new Date('2026-09-21T10:01:00.000Z') },
    );

    expect((await getConfirmedReceipts(db, HOUSEHOLD_ID)).map((receipt) => receipt.id)).toEqual([
      '00000000-0000-0000-0000-000000000012',
      '00000000-0000-0000-0000-000000000013',
      '00000000-0000-0000-0000-000000000010',
    ]);
  });

  it('liefert im Detail nur bestätigte Items und bewahrt ihre Bonposition', async () => {
    await createReceipt(
      {
        id: RECEIPT_ID,
        householdId: HOUSEHOLD_ID,
        createdBy: USER_ID,
        processingStatus: 'confirmed',
      },
      dependencies(db),
    );
    await createReceiptItem(
      {
        id: '00000000-0000-0000-0000-000000000014',
        receiptId: RECEIPT_ID,
        householdId: HOUSEHOLD_ID,
        position: 2,
        name: 'Brot',
        quantity: 1,
        unit: 'Stück',
        lineTotalCents: 299,
        reviewStatus: 'confirmed',
      },
      dependencies(db),
    );
    await createReceiptItem(
      {
        id: '00000000-0000-0000-0000-000000000015',
        receiptId: RECEIPT_ID,
        householdId: HOUSEHOLD_ID,
        position: 1,
        name: 'Milch',
        quantity: 1,
        unit: 'Liter',
        lineTotalCents: 149,
        reviewStatus: 'confirmed',
      },
      dependencies(db),
    );
    await createReceiptItem(
      {
        id: '00000000-0000-0000-0000-000000000016',
        receiptId: RECEIPT_ID,
        householdId: HOUSEHOLD_ID,
        position: 0,
        name: 'Entwurf',
        reviewStatus: 'needs_review',
      },
      dependencies(db),
    );

    expect(
      (await getConfirmedReceiptItems(db, HOUSEHOLD_ID, RECEIPT_ID)).map((item) => item.name),
    ).toEqual(['Milch', 'Brot']);
  });

  it('bestätigt, eröffnet und korrigiert einen Receipt über den Review-Lifecycle', async () => {
    await createReceiptFixture(db);
    await confirmReceipt(
      { householdId: HOUSEHOLD_ID, receiptId: RECEIPT_ID, confirmedBy: USER_ID },
      dependencies(db),
    );
    expect((await getReceipt(db, HOUSEHOLD_ID, RECEIPT_ID))?.processing_status).toBe('confirmed');

    await updateReceipt(
      {
        householdId: HOUSEHOLD_ID,
        receiptId: RECEIPT_ID,
        changes: { totalCents: 1399 },
      },
      dependencies(db),
    );
    expect(await getReceipt(db, HOUSEHOLD_ID, RECEIPT_ID)).toMatchObject({
      total_cents: 1399,
      processing_status: 'needs_review',
      confirmed_by: null,
      confirmed_at: null,
    });

    await reopenReceipt({ householdId: HOUSEHOLD_ID, receiptId: RECEIPT_ID }, dependencies(db));
    expect((await getReceipt(db, HOUSEHOLD_ID, RECEIPT_ID))?.processing_status).toBe(
      'needs_review',
    );
  });

  it('korrigiert und bestätigt Items; Delete und Restore bleiben inverse Outbox-Aktionen', async () => {
    await createItemFixture(db);
    await confirmReceiptItem({ householdId: HOUSEHOLD_ID, itemId: ITEM_ID }, dependencies(db));

    await updateReceiptItem(
      {
        householdId: HOUSEHOLD_ID,
        itemId: ITEM_ID,
        changes: { name: 'Hafermilch', lineTotalCents: 249 },
      },
      dependencies(db),
    );
    expect(
      await db.getFirstAsync<{ name: string; review_status: string }>(
        'select name, review_status from purchase_receipt_items where id = ?',
        [ITEM_ID],
      ),
    ).toEqual({ name: 'Hafermilch', review_status: 'needs_review' });

    await deleteReceiptItem({ householdId: HOUSEHOLD_ID, itemId: ITEM_ID }, dependencies(db));
    expect((await getReceiptItems(db, HOUSEHOLD_ID, RECEIPT_ID)).map((row) => row.id)).toEqual([]);
    await restoreReceiptItem({ householdId: HOUSEHOLD_ID, itemId: ITEM_ID }, dependencies(db));
    expect((await getReceiptItems(db, HOUSEHOLD_ID, RECEIPT_ID)).map((row) => row.id)).toEqual([
      ITEM_ID,
    ]);

    const outbox = await db.getAllAsync<{ op: string }>(
      'select op from outbox where entity_id = ? order by id',
      [ITEM_ID],
    );
    expect(outbox.map(({ op }) => op)).toEqual(['insert', 'update', 'update', 'delete', 'restore']);
  });

  it('rolls back the complete reviewed save and can retry it idempotently', async () => {
    const reviewed = {
      receipt: {
        id: '00000000-0000-0000-0000-000000000017',
        householdId: HOUSEHOLD_ID,
        createdBy: USER_ID,
        purchaseDate: '2026-09-20',
        totalCents: 3914,
        processingStatus: 'needs_review' as const,
      },
      items: [
        {
          id: '00000000-0000-0000-0000-000000000018',
          receiptId: '00000000-0000-0000-0000-000000000017',
          householdId: HOUSEHOLD_ID,
          position: 0,
          name: 'Milch',
          quantity: 1,
          unit: 'piece',
          lineTotalCents: 199,
          reviewStatus: 'needs_review' as const,
        },
        {
          id: '00000000-0000-0000-0000-000000000019',
          receiptId: '00000000-0000-0000-0000-000000000017',
          householdId: HOUSEHOLD_ID,
          position: 1,
          name: 'Brot',
          quantity: 1,
          unit: 'piece',
          lineTotalCents: 249,
          reviewStatus: 'needs_review' as const,
        },
      ],
      confirmedBy: USER_ID,
    };
    let failed = false;
    const failingDb: SqlDatabase = {
      ...db,
      async withExclusiveTransactionAsync(task) {
        await db.withExclusiveTransactionAsync((txn) =>
          task({
            ...txn,
            async runAsync(source, params) {
              if (!failed && source.includes('insert into purchase_receipt_items')) {
                failed = true;
                throw new Error('injected receipt item failure');
              }
              return txn.runAsync(source, params);
            },
          }),
        );
      },
    };

    await expect(saveReceiptReview(reviewed, { db: failingDb })).rejects.toThrow(
      'injected receipt item failure',
    );
    expect(await getReceipt(db, HOUSEHOLD_ID, reviewed.receipt.id)).toBeNull();
    expect(await getReceiptItems(db, HOUSEHOLD_ID, reviewed.receipt.id)).toEqual([]);
    expect(
      await db.getFirstAsync<{ count: number }>('select count(*) as count from outbox'),
    ).toEqual({ count: 0 });

    await expect(saveReceiptReview(reviewed, dependencies(db))).resolves.toMatchObject({
      receipt: { processing_status: 'confirmed', total_cents: 3914 },
      itemIds: reviewed.items.map((item) => item.id),
    });
    expect(
      (await getReceiptItems(db, HOUSEHOLD_ID, reviewed.receipt.id)).map(
        (item) => item.review_status,
      ),
    ).toEqual(['confirmed', 'confirmed']);
  });
});

type AssetQuery = {
  data: unknown;
  error: { message: string } | null;
};

function fakeAssetClient(storageError: { message: string } | null = null) {
  const calls: string[] = [];
  const rows = [
    {
      id: ASSET_ID,
      receipt_id: RECEIPT_ID,
      household_id: HOUSEHOLD_ID,
      storage_path: `${HOUSEHOLD_ID}/${RECEIPT_ID}/${ASSET_ID}.jpg`,
      mime_type: 'image/jpeg',
      byte_size: 123,
      sort_order: 0,
      created_by: USER_ID,
      created_at: NOW.toISOString(),
      deleted_at: null,
    },
  ];

  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      const filters: string[] = [];
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: string) {
          filters.push(`${column}=${value}`);
          return query;
        },
        is(column: string, _value: null) {
          filters.push(`${column}=null`);
          return query;
        },
        order() {
          return query;
        },
        update() {
          calls.push('update');
          return query;
        },
        maybeSingle: async () => ({ data: rows[0], error: null }),
        // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are thenables.
        then<TResult1 = AssetQuery, TResult2 = never>(
          onfulfilled?: ((value: AssetQuery) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
          return Promise.resolve({ data: rows, error: null }).then(onfulfilled, onrejected);
        },
      };
      return query;
    },
    storage: {
      from(bucket: string) {
        calls.push(`bucket:${bucket}`);
        return {
          createSignedUrl: async (path: string, ttl: number) => {
            calls.push(`signed:${path}:${ttl}`);
            return { data: { signedUrl: 'https://signed.example/asset' }, error: null };
          },
          remove: async (paths: string[]) => {
            calls.push(`remove:${paths.join(',')}`);
            return { data: [], error: storageError };
          },
        };
      },
    },
  } as unknown as TypedSupabaseClient;

  return { client, calls };
}

describe('receipt-authority asset API', () => {
  it('löscht einen Receipt samt Bildern und allen lokal synchronisierten Items', async () => {
    const database = await createDatabase();
    const { client, calls } = fakeAssetClient();

    try {
      await createItemFixture(database);

      await deleteReceiptPermanently(
        { householdId: HOUSEHOLD_ID, receiptId: RECEIPT_ID },
        { db: database, supabase: client, now: () => NOW },
      );

      expect(await getReceipt(database, HOUSEHOLD_ID, RECEIPT_ID)).toBeNull();
      expect(await getReceiptItems(database, HOUSEHOLD_ID, RECEIPT_ID)).toEqual([]);
      expect(calls).toContain(`remove:${HOUSEHOLD_ID}/${RECEIPT_ID}/${ASSET_ID}.jpg`);

      const tombstones = await database.getAllAsync<{
        entity: string;
        entity_id: string;
        op: string;
      }>('select entity, entity_id, op from outbox where op = ? order by id', ['delete']);
      expect(tombstones).toEqual([
        { entity: 'purchase_receipts', entity_id: RECEIPT_ID, op: 'delete' },
        { entity: 'purchase_receipt_items', entity_id: ITEM_ID, op: 'delete' },
      ]);
    } finally {
      database.close();
    }
  });

  it('hält den Receipt lokal sichtbar, wenn Storage nicht gelöscht werden kann', async () => {
    const database = await createDatabase();
    const { client } = fakeAssetClient({ message: 'Storage nicht erreichbar.' });

    try {
      await createReceiptFixture(database);

      await expect(
        deleteReceiptPermanently(
          { householdId: HOUSEHOLD_ID, receiptId: RECEIPT_ID },
          { db: database, supabase: client, now: () => NOW },
        ),
      ).rejects.toThrow('Storage nicht erreichbar.');

      expect(await getReceipt(database, HOUSEHOLD_ID, RECEIPT_ID)).not.toBeNull();
      expect(
        await database.getAllAsync<{ count: number }>(
          'select count(*) as count from outbox where entity_id = ? and op = ?',
          [RECEIPT_ID, 'delete'],
        ),
      ).toEqual([{ count: 0 }]);
    } finally {
      database.close();
    }
  });

  it('listet mehrere Asset-Metadaten, signiert nur den Receipt-Pfad und löscht nicht lokal', async () => {
    const { client, calls } = fakeAssetClient();
    const deps = { supabase: client, now: () => NOW };

    const assets = await listReceiptAssets(
      { householdId: HOUSEHOLD_ID, receiptId: RECEIPT_ID },
      deps,
    );
    expect(assets).toHaveLength(1);

    await expect(
      createReceiptAssetSignedUrl(
        {
          householdId: HOUSEHOLD_ID,
          receiptId: RECEIPT_ID,
          storagePath: assets[0]?.storage_path ?? '',
        },
        deps,
      ),
    ).resolves.toBe('https://signed.example/asset');

    await deleteReceiptAsset(
      {
        householdId: HOUSEHOLD_ID,
        receiptId: RECEIPT_ID,
        assetId: ASSET_ID,
        storagePath: assets[0]?.storage_path ?? '',
      },
      deps,
    );

    expect(calls).toEqual([
      'from:receipt_assets',
      `bucket:receipt-images`,
      `signed:${HOUSEHOLD_ID}/${RECEIPT_ID}/${ASSET_ID}.jpg:3600`,
      `bucket:receipt-images`,
      'remove:00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000003/00000000-0000-0000-0000-000000000005.jpg',
      'from:receipt_assets',
      'update',
    ]);
  });

  it('weist einen fremden Asset-Pfad vor dem Storage-Zugriff zurück', async () => {
    const { client, calls } = fakeAssetClient();

    await expect(
      createReceiptAssetSignedUrl(
        {
          householdId: HOUSEHOLD_ID,
          receiptId: RECEIPT_ID,
          storagePath: `other-household/${RECEIPT_ID}/${ASSET_ID}.jpg`,
        },
        { supabase: client },
      ),
    ).rejects.toThrow('Receipt-Asset-Pfad');
    expect(calls).toEqual([]);
  });

  it('löscht ausschließlich das private Asset und erhält Receipt-/Item-Daten ohne Cross-Surface-Mutation', async () => {
    const database = await createDatabase();
    const { client, calls } = fakeAssetClient();

    try {
      await createReceipt(
        {
          id: RECEIPT_ID,
          householdId: HOUSEHOLD_ID,
          createdBy: USER_ID,
          processingStatus: 'confirmed',
          totalCents: 1299,
        },
        dependencies(database),
      );
      await createReceiptItem(
        {
          id: ITEM_ID,
          receiptId: RECEIPT_ID,
          householdId: HOUSEHOLD_ID,
          position: 0,
          name: 'Milch',
          lineTotalCents: 199,
          reviewStatus: 'confirmed',
        },
        dependencies(database),
      );

      await deleteReceiptAsset(
        {
          householdId: HOUSEHOLD_ID,
          receiptId: RECEIPT_ID,
          assetId: ASSET_ID,
          storagePath: `${HOUSEHOLD_ID}/${RECEIPT_ID}/${ASSET_ID}.jpg`,
        },
        { supabase: client, now: () => NOW },
      );

      expect(await getReceipt(database, HOUSEHOLD_ID, RECEIPT_ID)).toMatchObject({
        id: RECEIPT_ID,
        processing_status: 'confirmed',
        total_cents: 1299,
      });
      expect(await getReceiptItems(database, HOUSEHOLD_ID, RECEIPT_ID)).toMatchObject([
        { id: ITEM_ID, name: 'Milch', line_total_cents: 199 },
      ]);
      expect(calls.join('|')).not.toMatch(/inventory|fridge|shopping_list|outbox/i);
    } finally {
      database.close();
    }
  });
});
