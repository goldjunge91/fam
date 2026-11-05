import { useCompleteShoppingRun } from '@/features/shopping-list/hooks/use-complete-shopping-run';
import type { LocalShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list';
import type { TransferItem } from '@/features/shopping-list/sheets/complete-run-sheet';
import { getDatabase } from '@/lib/db/local-client';
import {
  applyLocalSchema,
  createTestDatabase,
  type TestDatabase,
} from '../../../../test/node-sqlite-adapter';

type CompleteShoppingRunInput = {
  householdId: string;
  userId: string | null;
  checkedItems: LocalShoppingItem[];
  transfers: TransferItem[];
};

type CompleteMutation = (input: CompleteShoppingRunInput) => Promise<void>;

let mockDatabase: TestDatabase | undefined;
let mockMutationFn: CompleteMutation | undefined;
let mockUuidCounter = 0;
const mockInvalidateQueries = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn((options: { mutationFn: CompleteMutation }) => {
    mockMutationFn = options.mutationFn;
    return options;
  }),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => `generated-${++mockUuidCounter}`),
}));

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn(async () => {
    if (!mockDatabase) throw new Error('Testdatenbank wurde nicht initialisiert.');
    return mockDatabase;
  }),
}));

jest.mock('@/features/inventory/use-storage-locations', () => ({
  useStorageLocations: () => ({ data: [{ id: 'fridge-location', kind: 'fridge' }] }),
}));

jest.mock('@/features/gamification/streak', () => ({
  recordActivity: jest.fn(() => ({ count: 1, increased: true, milestone: false })),
}));

jest.mock('@/features/gamification/celebration', () => ({ celebrate: jest.fn() }));

jest.mock('@/lib/telemetry', () => ({
  addDiagnosticStep: jest.fn(),
  reportError: jest.fn(),
}));

const SNAPSHOT_TABLES = [
  'shopping_list_items',
  'fridge_items',
  'transactions',
  'shopping_history',
  'outbox',
  'outbox_history',
] as const;

type SnapshotTable = (typeof SNAPSHOT_TABLES)[number];
type DatabaseSnapshot = Record<SnapshotTable, Record<string, unknown>[]>;

const SOURCE_ITEMS = [
  createCheckedItem({ id: 'item-1', name: 'Brot', category_id: 'bakery' }),
  createCheckedItem({
    id: 'item-2',
    name: 'Milch',
    product_id: 'product-milk',
    quantity: 2,
    unit: 'package',
    package_size: 1,
    package_size_unit: 'l',
    category_id: 'dairy',
    sort_index: 1,
  }),
];

const VALID_INPUT: CompleteShoppingRunInput = {
  householdId: 'hh-1',
  userId: 'user-1',
  checkedItems: SOURCE_ITEMS,
  transfers: SOURCE_ITEMS.map(createTransfer),
};

async function snapshotDatabase(db: TestDatabase): Promise<DatabaseSnapshot> {
  const rows = await Promise.all(
    SNAPSHOT_TABLES.map((table) =>
      db.getAllAsync<Record<string, unknown>>(`select * from ${table} order by id`),
    ),
  );

  return {
    shopping_list_items: rows[0],
    fridge_items: rows[1],
    transactions: rows[2],
    shopping_history: rows[3],
    outbox: rows[4],
    outbox_history: rows[5],
  };
}

async function seedCheckedItems(db: TestDatabase): Promise<void> {
  for (const item of SOURCE_ITEMS) {
    await db.runAsync(
      `insert into shopping_list_items
        (id, household_id, product_id, name, quantity, unit, package_size, package_size_unit,
         category_id, category_source, category_classifier_version, sort_index, store_id,
         price_estimate, recipe_names, checked_at, checked_by, added_by, created_at,
         updated_at, deleted_at, _dirty)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.household_id,
        item.product_id,
        item.name,
        item.quantity,
        item.unit,
        item.package_size,
        item.package_size_unit,
        item.category_id,
        item.category_source,
        item.category_classifier_version,
        item.sort_index,
        item.store_id,
        item.price_estimate,
        JSON.stringify(item.recipe_names),
        item.checked_at,
        item.checked_by,
        'user-1',
        item.created_at,
        Date.parse(item.updated_at),
        null,
        0,
      ],
    );
  }
}

function MutationCapture(): CompleteMutation {
  mockMutationFn = undefined;
  useCompleteShoppingRun('hh-1');
  if (!mockMutationFn) throw new Error('useMutation hat keine mutationFn erhalten.');
  return mockMutationFn;
}

describe('useCompleteShoppingRun with real SQLite persistence', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockUuidCounter = 0;
    db = createTestDatabase();
    mockDatabase = db;
    await applyLocalSchema(db);
    await seedCheckedItems(db);
  });

  afterEach(() => {
    mockDatabase = undefined;
    db.close();
  });

  it('rejects 1.0001 before opening the database or writing any row', async () => {
    const before = await snapshotDatabase(db);
    const mutation = MutationCapture();

    await expect(
      mutation({
        ...VALID_INPUT,
        transfers: [{ ...VALID_INPUT.transfers[0], quantity: 1.0001 }, VALID_INPUT.transfers[1]],
      }),
    ).rejects.toThrow('Nachkommastellen');

    expect(getDatabase).not.toHaveBeenCalled();
    expect(await snapshotDatabase(db)).toEqual(before);
  });

  it.each([
    {
      name: 'the second inventory insert',
      trigger: `create trigger fail_second_inventory_insert
        before insert on fridge_items
        when new.name = 'Milch'
        begin select raise(abort, 'second inventory insert failed'); end`,
      error: 'second inventory insert failed',
    },
    {
      name: 'the second history insert',
      trigger: `create trigger fail_second_history_insert
        before insert on shopping_history
        when new.item_name = 'Milch'
        begin select raise(abort, 'history insert failed'); end`,
      error: 'history insert failed',
    },
    {
      name: 'the second source tombstone',
      trigger: `create trigger fail_second_source_tombstone
        before update of deleted_at on shopping_list_items
        when new.id = 'item-2' and new.deleted_at is not null
        begin select raise(abort, 'source tombstone failed'); end`,
      error: 'source tombstone failed',
    },
  ])('rolls back every affected table when $name fails', async ({ trigger, error }) => {
    await db.execAsync(trigger);
    const before = await snapshotDatabase(db);

    await expect(MutationCapture()(VALID_INPUT)).rejects.toThrow(error);

    expect(await snapshotDatabase(db)).toEqual(before);
  });

  it('commits inventory, ledger, history, source tombstones and outbox together', async () => {
    await MutationCapture()(VALID_INPUT);

    expect(
      await db.getAllAsync('select name, quantity, package_size from fridge_items order by name'),
    ).toEqual([
      { name: 'Brot', quantity: 1000, package_size: null },
      { name: 'Milch', quantity: 2000, package_size: 1000 },
    ]);
    expect(
      await db.getAllAsync('select type, quantity from transactions order by fridge_item_id'),
    ).toEqual([
      { type: 'in', quantity: 1000 },
      { type: 'in', quantity: 2000 },
    ]);
    expect(
      await db.getAllAsync('select item_name, quantity from shopping_history order by item_name'),
    ).toEqual([
      { item_name: 'Brot', quantity: 1 },
      { item_name: 'Milch', quantity: 2 },
    ]);
    expect(
      await db.getAllAsync(
        'select id, deleted_at is not null as deleted from shopping_list_items order by id',
      ),
    ).toEqual([
      { id: 'item-1', deleted: 1 },
      { id: 'item-2', deleted: 1 },
    ]);
    expect(
      await db.getAllAsync(
        'select entity, op, count(*) as count from outbox group by entity, op order by entity',
      ),
    ).toEqual([
      { entity: 'fridge_items', op: 'insert', count: 2 },
      { entity: 'shopping_list_items', op: 'delete', count: 2 },
      { entity: 'transactions', op: 'insert', count: 2 },
    ]);
    expect(await db.getAllAsync('select id from outbox_history order by id')).toHaveLength(6);
  });

  it('serializes simultaneous identical completions without creating duplicates', async () => {
    const mutation = MutationCapture();

    await Promise.all([mutation(VALID_INPUT), mutation(VALID_INPUT)]);

    expect(await db.getAllAsync('select id from fridge_items')).toHaveLength(2);
    expect(await db.getAllAsync('select id from transactions')).toHaveLength(2);
    expect(await db.getAllAsync('select id from shopping_history')).toHaveLength(2);
    expect(
      await db.getAllAsync(
        'select id from shopping_list_items where deleted_at is not null order by id',
      ),
    ).toEqual([{ id: 'item-1' }, { id: 'item-2' }]);
    expect(await db.getAllAsync('select id from outbox')).toHaveLength(6);
    expect(await db.getAllAsync('select id from outbox_history')).toHaveLength(6);
  });
});

function createCheckedItem(overrides: Partial<LocalShoppingItem>): LocalShoppingItem {
  return {
    id: 'item-1',
    household_id: 'hh-1',
    product_id: null,
    name: 'Brot',
    quantity: 1,
    unit: 'piece',
    package_size: null,
    package_size_unit: null,
    category_id: 'bakery',
    category_source: 'name_fallback',
    category_classifier_version: '2026-08-22',
    category: 'Brot & Backwaren',
    store_id: null,
    price_estimate: null,
    recipe_names: [],
    checked_at: '2026-11-04T10:00:00.000Z',
    checked_by: 'user-1',
    sort_index: 0,
    created_at: '2026-11-04T09:00:00.000Z',
    updated_at: '2026-11-04T10:00:00.000Z',
    ...overrides,
  };
}

function createTransfer(item: LocalShoppingItem): TransferItem {
  return {
    shoppingItemId: item.id,
    productId: item.product_id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    packageSize: item.package_size,
    packageSizeUnit: item.package_size_unit,
    locationKind: 'fridge',
    expiryDate: null,
  };
}
