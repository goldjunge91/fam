import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, createElement } from 'react';
import { createRoot } from 'test-renderer';

import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

import type { LocalInventoryItem } from './use-inventory-items';
import type { LocalInventoryTransaction } from './use-inventory-transactions';

jest.doMock('@/features/auth/session-provider', () => ({
  useSession: jest.fn(() => ({ session: { user: { id: 'actor-1' } } })),
}));

jest.doMock('@/lib/analytics', () => ({ trackAnalyticsEvent: jest.fn() }));

let mockUuidCounter = 0;
jest.doMock('expo-crypto', () => ({
  randomUUID: jest.fn(() => `generated-${++mockUuidCounter}`),
}));

jest.doMock('@/lib/db/client', () => ({ getDatabase: jest.fn() }));
jest.doMock('react-native-css-interop', () => ({}));
jest.doMock('react-native', () => ({ Platform: { OS: 'node' } }));

const { getDatabase } = jest.requireMock('@/lib/db/client') as {
  getDatabase: jest.MockedFunction<() => Promise<TestDatabase>>;
};
const { useSession } = jest.requireMock('@/features/auth/session-provider') as {
  useSession: jest.Mock;
};

const {
  useAddFridgeItemMutation,
  useMoveInventoryItemMutation,
  useOpenInventoryItemMutation,
  useUndoInventoryTransactionMutation,
  useUndoOpenTransactionMutation,
  useUpdateFridgeItemMutation,
  useUpdateInventoryItemQuantityMutation,
  useWasteInventoryItemMutation,
} = require('./use-inventory-mutations') as typeof import('./use-inventory-mutations');
const { useInventoryTransactions } =
  require('./use-inventory-transactions') as typeof import('./use-inventory-transactions');

const mockedGetDatabase = jest.mocked(getDatabase);
const mockedUseSession = jest.mocked(useSession);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ITEM_BASE: LocalInventoryItem = {
  id: 'item-1',
  household_id: 'hh-1',
  location_id: 'loc-old',
  product_id: 'product-1',
  name: 'Milch',
  quantity: 3,
  unit: 'piece',
  package_size: null,
  package_size_unit: null,
  expiry_date: '2026-12-31',
  opened_at: null,
  vacuum_sealed: false,
  expiry_user_set: false,
  added_by: 'actor-1',
  created_at: '2026-09-07T10:00:00.000Z',
  location_kind: 'fridge',
  location_name: 'Kühlschrank',
};

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });
}

function HookHarness<T>({ hook, onReady }: { hook: () => T; onReady: (value: T) => void }) {
  onReady(hook());
  return null;
}

const activeRenderers = new Set<ReturnType<typeof createRoot>>();

async function renderMutationHook<T>(hook: () => T) {
  let current!: T;
  const renderer = createRoot();
  activeRenderers.add(renderer);

  await act(async () => {
    renderer.render(
      createElement(
        QueryClientProvider,
        { client: createQueryClient() },
        createElement(HookHarness<T>, { hook, onReady: (value) => (current = value) }),
      ),
    );
  });

  return {
    result: {
      get current(): T {
        return current;
      },
    },
    unmount: async () => {
      await act(async () => renderer.unmount());
      activeRenderers.delete(renderer);
    },
  };
}

async function insertItem(db: TestDatabase, item: LocalInventoryItem = ITEM_BASE): Promise<void> {
  await db.runAsync(
    `insert into fridge_items
       (id, household_id, location_id, product_id, name, quantity, unit,
        package_size, package_size_unit, expiry_date, added_by, created_at,
        updated_at, deleted_at, _dirty, opened_at, vacuum_sealed, expiry_user_set)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.household_id,
      item.location_id,
      item.product_id,
      item.name,
      item.quantity,
      item.unit,
      item.package_size,
      item.package_size_unit,
      item.expiry_date,
      item.added_by,
      item.created_at,
      1,
      null,
      0,
      item.opened_at ?? null,
      item.vacuum_sealed ? 1 : 0,
      item.expiry_user_set ? 1 : 0,
    ],
  );
}

async function rowsForItem(db: TestDatabase, itemId: string) {
  return db.getAllAsync<{
    id: string;
    type: string;
    quantity: number;
    location_id: string | null;
    operation_id: string | null;
    reason: string | null;
    previous_expiry_date: string | null;
    notes: string | null;
    reversal_of: string | null;
  }>(
    `select id, type, quantity, location_id, operation_id, reason,
            previous_expiry_date, notes, reversal_of
       from transactions
      where fridge_item_id = ?
      order by rowid`,
    [itemId],
  );
}

async function insertTransaction(
  db: TestDatabase,
  transaction: {
    id: string;
    household_id?: string;
    fridge_item_id?: string | null;
    product_id?: string | null;
    type: 'in' | 'out' | 'waste' | 'open';
    quantity: number;
    location_id?: string | null;
    reason?: 'expired' | 'spoiled' | 'other' | null;
    previous_expiry_date?: string | null;
    notes?: string | null;
    operation_id?: string | null;
    reversal_of?: string | null;
    created_at?: string;
  },
): Promise<void> {
  await db.runAsync(
    `insert into transactions
       (id, operation_id, reversal_of, household_id, fridge_item_id, product_id,
        actor, type, quantity, location_id, reason, previous_expiry_date, notes,
        undone, created_at, updated_at, _dirty)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0)`,
    [
      transaction.id,
      transaction.operation_id ?? null,
      transaction.reversal_of ?? null,
      transaction.household_id ?? 'hh-1',
      transaction.fridge_item_id ?? 'item-1',
      transaction.product_id ?? 'product-1',
      'actor-1',
      transaction.type,
      transaction.quantity,
      transaction.location_id ?? 'loc-old',
      transaction.reason ?? null,
      transaction.previous_expiry_date ?? null,
      transaction.notes ?? null,
      transaction.created_at ?? new Date().toISOString(),
      1,
    ],
  );
}

async function outboxRows(db: TestDatabase) {
  return db.getAllAsync<{ entity: string; entity_id: string; op: string; payload: string }>(
    'select entity, entity_id, op, payload from outbox order by id',
  );
}

describe('Inventory-Mutations gegen den echten lokalen SQLite-Spiegel', () => {
  let db: TestDatabase;

  beforeAll(() => {
    notifyManager.setScheduler((notify) => notify());
  });

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);
    mockedGetDatabase.mockResolvedValue(db);
    mockedUseSession.mockReturnValue({ session: { user: { id: 'actor-1' } } });
    mockUuidCounter = 0;
  });

  afterEach(async () => {
    const renderers = [...activeRenderers];
    activeRenderers.clear();
    await act(async () => {
      for (const renderer of renderers) {
        renderer.unmount();
      }
    });
    db.close();
    jest.clearAllMocks();
  });

  afterAll(() => {
    notifyManager.setScheduler((notify) => setTimeout(notify, 0));
  });

  it('add schreibt lokale Bestandszeile, Zugang und zwei Outbox-Einträge', async () => {
    const { result } = await renderMutationHook(() => useAddFridgeItemMutation());

    await act(async () => {
      await result.current.mutateAsync({
        household_id: 'hh-1',
        location_id: 'loc-old',
        product_id: 'product-1',
        name: 'Milch',
        quantity: 2,
        unit: 'piece',
        package_size: null,
        package_size_unit: null,
        expiry_date: null,
      });
    });

    const item = await db.getFirstAsync<{ quantity: number; _dirty: number }>(
      'select quantity, _dirty from fridge_items where id = ?',
      ['generated-1'],
    );
    const ledger = await rowsForItem(db, 'generated-1');

    expect(item).toEqual({ quantity: 2, _dirty: 1 });
    expect(ledger).toEqual([
      expect.objectContaining({ type: 'in', quantity: 2, operation_id: null }),
    ]);
    expect(await outboxRows(db)).toHaveLength(2);
  });

  it('findet Gegenbuchungen über Transaktions-ID für Mengen und über Operations-ID für Moves', async () => {
    await insertTransaction(db, {
      id: 'quantity-source',
      operation_id: 'quantity-operation',
      type: 'out',
      quantity: 1,
    });
    await insertTransaction(db, {
      id: 'quantity-reversal',
      reversal_of: 'quantity-source',
      type: 'in',
      quantity: 1,
    });
    await insertTransaction(db, {
      id: 'move-out',
      operation_id: 'move-operation',
      type: 'out',
      quantity: 1,
    });
    await insertTransaction(db, {
      id: 'move-in',
      operation_id: 'move-operation',
      type: 'in',
      quantity: 1,
    });
    await insertTransaction(db, {
      id: 'move-reversal-out',
      operation_id: 'move-reversal-operation',
      reversal_of: 'move-operation',
      type: 'out',
      quantity: 1,
    });
    await insertTransaction(db, {
      id: 'move-reversal-in',
      operation_id: 'move-reversal-operation',
      reversal_of: 'move-operation',
      type: 'in',
      quantity: 1,
    });

    const rendered = await renderMutationHook(() => useInventoryTransactions('hh-1'));

    try {
      await act(async () => {
        await Promise.resolve();
      });

      const rows = rendered.result.current.data ?? [];
      expect(rows.find(({ id }) => id === 'quantity-source')).toMatchObject({
        operation_legs: 1,
        has_reversal: 1,
      });
      expect(rows.find(({ id }) => id === 'move-in')).toMatchObject({
        operation_legs: 2,
        has_reversal: 1,
      });
      expect(rows.find(({ id }) => id === 'move-out')).toMatchObject({
        operation_legs: 2,
        has_reversal: 1,
      });
    } finally {
      await rendered.unmount();
    }
  });

  it('consume schreibt nur die effektive out-Menge und löscht bei null weich', async () => {
    await insertItem(db);
    const { result } = await renderMutationHook(() => useUpdateInventoryItemQuantityMutation());

    await act(async () => {
      await result.current.mutateAsync({ id: 'item-1', household_id: 'hh-1', delta: -10 });
    });

    const item = await db.getFirstAsync<{ quantity: number; deleted_at: number; _dirty: number }>(
      'select quantity, deleted_at, _dirty from fridge_items where id = ?',
      ['item-1'],
    );
    expect(item).toEqual({ quantity: 0, deleted_at: expect.any(Number), _dirty: 1 });
    expect(await rowsForItem(db, 'item-1')).toEqual([
      expect.objectContaining({ type: 'out', quantity: 3, location_id: 'loc-old' }),
    ]);
    expect(await outboxRows(db)).toHaveLength(1);
  });

  it('serialisiert parallele lokale Verbraeuche und bucht beide Deltas', async () => {
    await insertItem(db, { ...ITEM_BASE, quantity: 5 });
    const { result } = await renderMutationHook(() => useUpdateInventoryItemQuantityMutation());

    await act(async () => {
      await Promise.all([
        result.current.mutateAsync({ id: 'item-1', household_id: 'hh-1', delta: -1 }),
        result.current.mutateAsync({ id: 'item-1', household_id: 'hh-1', delta: -1 }),
      ]);
    });

    expect(
      await db.getFirstAsync<{ quantity: number }>(
        'select quantity from fridge_items where id = ?',
        ['item-1'],
      ),
    ).toEqual({ quantity: 3 });
    expect(
      await db.getAllAsync('select id from transactions where fridge_item_id = ?', ['item-1']),
    ).toHaveLength(2);
    expect(
      await db.getAllAsync<{ type: string; quantity: number }>(
        `select type, quantity from transactions where fridge_item_id = ? order by id`,
        ['item-1'],
      ),
    ).toEqual([
      { type: 'out', quantity: 1 },
      { type: 'out', quantity: 1 },
    ]);
  });

  it('verbraucht einen Dezimalrest exakt bis null', async () => {
    await insertItem(db, { ...ITEM_BASE, quantity: 1.1 });
    const { result } = await renderMutationHook(() => useUpdateInventoryItemQuantityMutation());

    await act(async () => {
      await result.current.mutateAsync({ id: 'item-1', household_id: 'hh-1', delta: -1 });
      await result.current.mutateAsync({ id: 'item-1', household_id: 'hh-1', delta: -0.1 });
    });

    expect(
      await db.getFirstAsync<{ quantity: number; deleted_at: number | null }>(
        'select quantity, deleted_at from fridge_items where id = ?',
        ['item-1'],
      ),
    ).toEqual({ quantity: 0, deleted_at: expect.any(Number) });
    expect(
      await db.getAllAsync<{ type: string; quantity: number }>(
        `select type, quantity
           from transactions
          where fridge_item_id = ?
          order by created_at, id`,
        ['item-1'],
      ),
    ).toEqual([
      { type: 'out', quantity: 1 },
      { type: 'out', quantity: 0.1 },
    ]);
  });

  it('manuelle Mengen- und Lagerortkorrektur schreibt Korrektur und gruppierten Move gemeinsam', async () => {
    await insertItem(db);
    const { result } = await renderMutationHook(() => useUpdateFridgeItemMutation());

    await act(async () => {
      await result.current.mutateAsync({
        id: ITEM_BASE.id,
        household_id: ITEM_BASE.household_id,
        patch: { location_id: 'loc-new' },
        quantityCorrection: { expectedQuantity: 3, newQuantity: 4 },
      });
    });

    const item = await db.getFirstAsync<{ quantity: number; location_id: string; _dirty: number }>(
      'select quantity, location_id, _dirty from fridge_items where id = ?',
      ['item-1'],
    );
    const ledger = await rowsForItem(db, 'item-1');

    // quantity ist jetzt Integer-Tausendstel (contract.md Abschnitt 3,
    // fam-lem.27.6): die Mengenkorrektur schreibt Einheiten, nicht Dezimal.
    expect(item).toEqual({ quantity: 4000, location_id: 'loc-new', _dirty: 1 });
    expect(ledger).toEqual([
      expect.objectContaining({
        type: 'in',
        quantity: 1000,
        location_id: 'loc-old',
        operation_id: expect.any(String),
        notes: '[Manual correction]',
      }),
      expect.objectContaining({ type: 'out', quantity: 4, location_id: 'loc-old' }),
      expect.objectContaining({ type: 'in', quantity: 4, location_id: 'loc-new' }),
    ]);
    expect(new Set(ledger.slice(1).map((row) => row.operation_id)).size).toBe(1);
    expect((await outboxRows(db)).map(({ op }) => op)).toEqual(['correct_quantity', 'move']);
  });

  it('überschreibt bei reiner Namensänderung keinen zwischenzeitlichen Verbrauch (fam-87p)', async () => {
    // Dialog wurde bei Menge 5 geöffnet; zwischenzeitlich synchronisiert der
    // lokale Spiegel bereits einen Verbrauch auf 4. Ohne quantityCorrection
    // darf das Speichern eines reinen Namens-Edits diesen Verbrauch nicht
    // überschreiben.
    await insertItem(db, { ...ITEM_BASE, quantity: 5 });
    await db.runAsync('update fridge_items set quantity = ? where id = ?', [4, 'item-1']);
    const { result } = await renderMutationHook(() => useUpdateFridgeItemMutation());

    await act(async () => {
      await result.current.mutateAsync({
        id: ITEM_BASE.id,
        household_id: ITEM_BASE.household_id,
        patch: { name: 'Dijon-Senf' },
      });
    });

    const item = await db.getFirstAsync<{ quantity: number }>(
      'select quantity from fridge_items where id = ?',
      ['item-1'],
    );
    expect(item).toEqual({ quantity: 4 });
    expect((await outboxRows(db)).map(({ op }) => op)).toEqual(['update']);
  });

  it('direct move schreibt die zwei Ledger-Legs atomar in einer Move-Outbox-Mutation', async () => {
    await insertItem(db, { ...ITEM_BASE, quantity: 2 });
    const { result } = await renderMutationHook(() => useMoveInventoryItemMutation());

    await act(async () => {
      await result.current.mutateAsync({
        item: { ...ITEM_BASE, quantity: 2 },
        locationId: 'loc-new',
      });
    });

    const ledger = await rowsForItem(db, 'item-1');
    expect(ledger).toEqual([
      expect.objectContaining({ type: 'out', quantity: 2, location_id: 'loc-old' }),
      expect.objectContaining({ type: 'in', quantity: 2, location_id: 'loc-new' }),
    ]);
    expect(ledger[0]?.operation_id).toBeTruthy();
    expect(ledger[1]?.operation_id).toBe(ledger[0]?.operation_id);
    expect((await outboxRows(db)).map(({ op }) => op)).toEqual(['move']);
  });

  it('waste löscht den Bestand weich und schreibt den Grund ins Ledger', async () => {
    await insertItem(db, { ...ITEM_BASE, quantity: 2 });
    const { result } = await renderMutationHook(() => useWasteInventoryItemMutation());

    await act(async () => {
      await result.current.mutateAsync({ item: { ...ITEM_BASE, quantity: 2 }, reason: 'spoiled' });
    });

    const item = await db.getFirstAsync<{ deleted_at: number; _dirty: number }>(
      'select deleted_at, _dirty from fridge_items where id = ?',
      ['item-1'],
    );
    expect(item).toEqual({ deleted_at: expect.any(Number), _dirty: 1 });
    expect(await rowsForItem(db, 'item-1')).toEqual([
      expect.objectContaining({ type: 'waste', quantity: 2, reason: 'spoiled' }),
    ]);
  });

  it('open quantity=1 aktualisiert den Bestand in-place und speichert das alte MHD', async () => {
    await insertItem(db, { ...ITEM_BASE, quantity: 1 });
    const { result } = await renderMutationHook(() => useOpenInventoryItemMutation());

    await act(async () => {
      await result.current.mutateAsync({ item: { ...ITEM_BASE, quantity: 1 }, quantity: 1 });
    });

    const item = await db.getFirstAsync<{
      quantity: number;
      opened_at: string | null;
      expiry_date: string | null;
      vacuum_sealed: number;
    }>('select quantity, opened_at, expiry_date, vacuum_sealed from fridge_items where id = ?', [
      'item-1',
    ]);
    expect(item).toEqual({
      quantity: 1,
      opened_at: expect.any(String),
      expiry_date: expect.any(String),
      vacuum_sealed: 0,
    });
    expect(await rowsForItem(db, 'item-1')).toEqual([
      expect.objectContaining({
        type: 'open',
        quantity: 1,
        previous_expiry_date: '2026-12-31',
      }),
    ]);
  });

  it('open quantity>1 splittet, bewahrt die Gesamtmenge und referenziert das neue geöffnete Los', async () => {
    await insertItem(db, { ...ITEM_BASE, quantity: 3 });
    const { result } = await renderMutationHook(() => useOpenInventoryItemMutation());

    await act(async () => {
      await result.current.mutateAsync({ item: { ...ITEM_BASE, quantity: 3 }, quantity: 1 });
    });

    const items = await db.getAllAsync<{
      id: string;
      quantity: number;
      opened_at: string | null;
      expiry_date: string | null;
      expiry_user_set: number;
    }>(
      `select id, quantity, opened_at, expiry_date, expiry_user_set
         from fridge_items
        where household_id = ? and deleted_at is null
        order by id`,
      ['hh-1'],
    );
    const ledger = await db.getAllAsync<{
      fridge_item_id: string;
      type: string;
      quantity: number;
      notes: string | null;
    }>('select fridge_item_id, type, quantity, notes from transactions', []);

    // split_open ist integer-nativ (fam-lem.27.8, contract.md Abschnitt 3):
    // Rest-Los und geoeffnetes Los tragen Integer-Tausendstel.
    expect(items).toHaveLength(2);
    expect(items.map(({ quantity }) => quantity).sort((a, b) => a - b)).toEqual([1000, 2000]);
    expect(items.find(({ opened_at }) => opened_at !== null)).toEqual(
      expect.objectContaining({ quantity: 1000, opened_at: expect.any(String) }),
    );
    expect(ledger).toEqual([
      expect.objectContaining({
        fridge_item_id: expect.not.stringMatching(/^item-1$/),
        type: 'open',
        quantity: 1000,
        notes: '[Split] origin=item-1',
      }),
    ]);
    // Split ist seit der split_open-Konsolidierung (fam-lem.10/fam-n46.1) EINE
    // atomare Outbox-Operation (Rest-Los, geoeffnetes Los und Ledger gemeinsam),
    // nicht mehr drei separate Zeilen.
    expect(await outboxRows(db)).toHaveLength(1);
  });

  it('Undo einer in-place-Öffnung stellt den Vorzustand her und schreibt eine Gegenbuchung', async () => {
    await insertItem(db, { ...ITEM_BASE, quantity: 1 });
    const openHook = await renderMutationHook(() => useOpenInventoryItemMutation());
    await act(async () => {
      await openHook.result.current.mutateAsync({
        item: { ...ITEM_BASE, quantity: 1 },
        quantity: 1,
      });
    });
    const openedBeforeUndo = await db.getFirstAsync<{ expiry_date: string | null }>(
      'select expiry_date from fridge_items where id = ?',
      ['item-1'],
    );
    const transaction = await db.getFirstAsync<{
      id: string;
      household_id: string;
      fridge_item_id: string;
      product_id: string | null;
      actor: string | null;
      type: 'open';
      quantity: number;
      location_id: string | null;
      reason: 'expired' | 'spoiled' | 'other' | null;
      previous_expiry_date: string | null;
      notes: string | null;
      undone: boolean;
      created_at: string;
    }>("select * from transactions where type = 'open' order by rowid limit 1");
    if (!transaction) throw new Error('Open-Transaktion fehlt.');

    const undoHook = await renderMutationHook(() => useUndoOpenTransactionMutation());
    await act(async () => {
      await undoHook.result.current.mutateAsync({ transaction });
    });

    const item = await db.getFirstAsync<{ opened_at: string | null; expiry_date: string | null }>(
      'select opened_at, expiry_date from fridge_items where id = ?',
      ['item-1'],
    );
    expect(item).toEqual({ opened_at: null, expiry_date: '2026-12-31' });
    expect(
      await db.getAllAsync<{
        type: string;
        notes: string | null;
        previous_expiry_date: string | null;
        reversal_of: string | null;
      }>('select type, notes, previous_expiry_date, reversal_of from transactions order by rowid'),
    ).toEqual([
      { type: 'open', notes: null, previous_expiry_date: '2026-12-31', reversal_of: null },
      {
        type: 'open',
        notes: '[Undone] Öffnung rückgängig gemacht',
        previous_expiry_date: openedBeforeUndo?.expiry_date,
        reversal_of: expect.any(String),
      },
    ]);
    expect(await outboxRows(db)).toHaveLength(4);
  });

  it('führt Split-Undo bei einer zwischenzeitlich geänderten Ursprungszeile als Merge-Fallback aus', async () => {
    await insertItem(db);
    const openHook = await renderMutationHook(() => useOpenInventoryItemMutation());
    await act(async () => {
      await openHook.result.current.mutateAsync({ item: { ...ITEM_BASE }, quantity: 1 });
    });
    const transaction = await db.getFirstAsync<{
      id: string;
      household_id: string;
      fridge_item_id: string;
      product_id: string | null;
      actor: string | null;
      type: 'open';
      quantity: number;
      location_id: string | null;
      reason: null;
      previous_expiry_date: string | null;
      notes: string | null;
      undone: boolean;
      created_at: string;
    }>("select * from transactions where type = 'open' order by rowid limit 1");
    if (!transaction) throw new Error('Open-Transaktion fehlt.');

    await db.runAsync('update fridge_items set quantity = ?, updated_at = ? where id = ?', [
      7,
      Date.now() + 1,
      'item-1',
    ]);

    const undoHook = await renderMutationHook(() => useUndoOpenTransactionMutation());
    await act(async () => {
      await undoHook.result.current.mutateAsync({ transaction });
    });
    expect(
      await db.getFirstAsync<{ opened_at: string | null }>(
        'select opened_at from fridge_items where id = ?',
        [transaction.fridge_item_id],
      ),
    ).toEqual({ opened_at: expect.any(String) });
    expect(
      await db.getFirstAsync<{ reversal_of: string | null; notes: string | null }>(
        'select reversal_of, notes from transactions where reversal_of = ?',
        [transaction.id],
      ),
    ).toEqual({ reversal_of: transaction.id, notes: '[Undone] Öffnung rückgängig gemacht' });
    // Split-open (1 atomare Operation) + generische Reversal-Ledgerbuchung
    // im Fallback-Pfad (1 Operation) = 2, nicht 4 einzelne Zeilen.
    expect(await outboxRows(db)).toHaveLength(2);
  });

  it('führt Split-Merge über den generischen Undo-Hook aus und verknüpft die Gegenbuchung', async () => {
    await insertItem(db, { ...ITEM_BASE, quantity: 3 });
    const openHook = await renderMutationHook(() => useOpenInventoryItemMutation());
    await act(async () => {
      await openHook.result.current.mutateAsync({
        item: { ...ITEM_BASE, quantity: 3 },
        quantity: 1,
      });
    });
    const opened = await db.getFirstAsync<{ id: string; expiry_date: string | null }>(
      'select id, expiry_date from fridge_items where opened_at is not null',
    );
    const source = await db.getFirstAsync<LocalInventoryTransaction>(
      "select * from transactions where type = 'open'",
    );
    if (!opened || !source) throw new Error('Split-Quelle fehlt.');

    const undoHook = await renderMutationHook(() => useUndoInventoryTransactionMutation());
    await act(async () => {
      await undoHook.result.current.mutateAsync({ transaction: source });
    });

    // Integer-Tausendstel seit fam-lem.27.8 (contract.md Abschnitt 3).
    expect(
      await db.getFirstAsync<{ quantity: number; deleted_at: number | null }>(
        'select quantity, deleted_at from fridge_items where id = ?',
        ['item-1'],
      ),
    ).toEqual({ quantity: 3000, deleted_at: null });
    expect(
      await db.getFirstAsync<{ deleted_at: number | null }>(
        'select deleted_at from fridge_items where id = ?',
        [opened.id],
      ),
    ).toEqual({ deleted_at: expect.any(Number) });
    expect(
      await db.getFirstAsync<{ previous_expiry_date: string | null; reversal_of: string | null }>(
        'select previous_expiry_date, reversal_of from transactions where reversal_of = ?',
        [source.id],
      ),
    ).toEqual({ previous_expiry_date: opened.expiry_date, reversal_of: source.id });
  });

  it('schließt Split-Undo im Merge-Fallback nachvollziehbar ab und merged kein geändertes Ursprungslos', async () => {
    const openedAt = new Date(Date.now() - 60_000).toISOString();
    await insertItem(db, { ...ITEM_BASE, quantity: 2 });
    await insertItem(db, {
      ...ITEM_BASE,
      id: 'opened-lot',
      quantity: 1,
      opened_at: openedAt,
      expiry_date: '2026-09-09',
    });
    await insertTransaction(db, {
      id: 'split-open-source',
      fridge_item_id: 'opened-lot',
      type: 'open',
      quantity: 1,
      previous_expiry_date: '2026-12-31',
      notes: '[Split] origin=item-1',
      created_at: openedAt,
    });
    await db.runAsync('update fridge_items set quantity = ?, updated_at = ? where id = ?', [
      5,
      2,
      'item-1',
    ]);

    const undoHook = await renderMutationHook(() => useUndoInventoryTransactionMutation());
    const source = await db.getFirstAsync<LocalInventoryTransaction>(
      'select * from transactions where id = ?',
      ['split-open-source'],
    );
    if (!source) throw new Error('Split-Quelle fehlt.');

    await act(async () => {
      await undoHook.result.current.mutateAsync({ transaction: source });
    });

    expect(
      await db.getFirstAsync<{ quantity: number; deleted_at: number | null }>(
        'select quantity, deleted_at from fridge_items where id = ?',
        ['item-1'],
      ),
    ).toEqual({ quantity: 5, deleted_at: null });
    expect(
      await db.getFirstAsync<{ quantity: number; opened_at: string | null }>(
        'select quantity, opened_at from fridge_items where id = ?',
        ['opened-lot'],
      ),
    ).toEqual({ quantity: 1, opened_at: openedAt });
    expect(
      await db.getFirstAsync<{ notes: string | null; reversal_of: string | null }>(
        'select notes, reversal_of from transactions where reversal_of = ?',
        ['split-open-source'],
      ),
    ).toEqual({ notes: '[Undone] Öffnung rückgängig gemacht', reversal_of: 'split-open-source' });
    expect(await outboxRows(db)).toHaveLength(1);
  });

  it('führt Open-Undo nach 24 Stunden als manuelle In-place-Korrektur aus', async () => {
    const openedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    await insertItem(db, {
      ...ITEM_BASE,
      quantity: 1,
      opened_at: openedAt,
      expiry_date: '2026-09-09',
    });
    await insertTransaction(db, {
      id: 'source-old-open',
      type: 'open',
      quantity: 1,
      previous_expiry_date: '2026-12-31',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000 - 1).toISOString(),
    });

    const undoHook = await renderMutationHook(() => useUndoInventoryTransactionMutation());
    const source = await db.getFirstAsync<LocalInventoryTransaction>(
      'select * from transactions where id = ?',
      ['source-old-open'],
    );
    if (!source) throw new Error('Open-Quelle fehlt.');
    await act(async () => {
      await undoHook.result.current.mutateAsync({ transaction: source });
    });

    expect(
      await db.getFirstAsync<{
        opened_at: string | null;
        expiry_date: string | null;
        expiry_user_set: number;
      }>('select opened_at, expiry_date, expiry_user_set from fridge_items where id = ?', [
        'item-1',
      ]),
    ).toEqual({ opened_at: null, expiry_date: '2026-12-31', expiry_user_set: 1 });
    expect(
      await db.getFirstAsync<{
        type: string;
        notes: string | null;
        reversal_of: string | null;
        previous_expiry_date: string | null;
      }>(
        'select type, notes, reversal_of, previous_expiry_date from transactions where reversal_of = ?',
        ['source-old-open'],
      ),
    ).toEqual({
      type: 'open',
      notes: '[Manual correction]',
      reversal_of: 'source-old-open',
      previous_expiry_date: '2026-09-09',
    });
  });

  it('weist einen Update-Hook für einen lokal fehlenden Bestand zurück und enqueut nichts', async () => {
    const { result } = await renderMutationHook(() => useUpdateFridgeItemMutation());

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: ITEM_BASE.id,
          household_id: ITEM_BASE.household_id,
          patch: {},
        }),
      ).rejects.toThrow('lokal nicht vorhanden');
    });
    expect(await outboxRows(db)).toEqual([]);
  });

  it('weist negative manuelle Mengen vor jeder lokalen Mutation zurück', async () => {
    await insertItem(db);
    const { result } = await renderMutationHook(() => useUpdateFridgeItemMutation());

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: ITEM_BASE.id,
          household_id: ITEM_BASE.household_id,
          patch: {},
          quantityCorrection: { expectedQuantity: 3, newQuantity: -1 },
        }),
      ).rejects.toThrow('nicht negativ');
    });

    const row = await db.getFirstAsync<{ quantity: number }>(
      'select quantity from fridge_items where id = ?',
      ['item-1'],
    );
    expect(row?.quantity).toBe(3);
    expect(await outboxRows(db)).toEqual([]);
  });

  it('weist manuelle Mengen mit mehr als drei Nachkommastellen zurück', async () => {
    await insertItem(db);
    const { result } = await renderMutationHook(() => useUpdateFridgeItemMutation());

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: ITEM_BASE.id,
          household_id: ITEM_BASE.household_id,
          patch: {},
          quantityCorrection: { expectedQuantity: 3, newQuantity: 3.0001 },
        }),
      ).rejects.toThrow('drei Nachkommastellen');
    });

    expect(
      await db.getFirstAsync<{ quantity: number }>(
        'select quantity from fridge_items where id = ?',
        ['item-1'],
      ),
    ).toEqual({ quantity: 3 });
    expect(await outboxRows(db)).toEqual([]);
  });

  it('weist einen Move mit nicht positiver Menge vor der lokalen Mutation zurück', async () => {
    await insertItem(db, { ...ITEM_BASE, quantity: 0 });
    const { result } = await renderMutationHook(() => useMoveInventoryItemMutation());

    await act(async () => {
      await expect(
        result.current.mutateAsync({ item: { ...ITEM_BASE, quantity: 0 }, locationId: 'loc-new' }),
      ).rejects.toThrow('positive Menge');
    });
    expect(
      await db.getFirstAsync<{ location_id: string }>(
        'select location_id from fridge_items where id = ?',
        ['item-1'],
      ),
    ).toEqual({ location_id: 'loc-old' });
    expect(await outboxRows(db)).toEqual([]);
  });

  it.each([
    ['in', 'out'],
    ['out', 'in'],
    ['waste', 'in'],
  ] as const)('bucht %s innerhalb des Undo-Fensters als %s zurück', async (type, inverse) => {
    const sourceQuantity = type === 'waste' ? 3 : 2;
    await insertItem(db, { ...ITEM_BASE, quantity: type === 'in' ? 5 : 3 });
    await insertTransaction(db, {
      id: `source-${type}`,
      type,
      quantity: sourceQuantity,
      reason: type === 'waste' ? 'spoiled' : null,
      created_at: new Date(Date.now() - 60_000).toISOString(),
    });
    if (type === 'waste') {
      await db.runAsync('update fridge_items set deleted_at = ?, updated_at = ? where id = ?', [
        Date.now(),
        Date.now(),
        'item-1',
      ]);
    }

    const { result } = await renderMutationHook(() => useUndoInventoryTransactionMutation());
    const source = await db.getFirstAsync<{
      id: string;
      household_id: string;
      fridge_item_id: string;
      product_id: string;
      actor: string;
      type: 'in' | 'out' | 'waste' | 'open';
      quantity: number;
      location_id: string;
      reason: 'expired' | 'spoiled' | 'other' | null;
      previous_expiry_date: string | null;
      notes: string | null;
      undone: boolean;
      created_at: string;
      operation_id: string | null;
      reversal_of: string | null;
    }>('select * from transactions where id = ?', [`source-${type}`]);
    if (!source) throw new Error('Quelle fehlt.');

    await act(async () => {
      await result.current.mutateAsync({ transaction: source });
    });

    expect(
      await db.getFirstAsync<{ deleted_at: number | null; quantity: number }>(
        'select deleted_at, quantity from fridge_items where id = ?',
        ['item-1'],
      ),
    ).toEqual(
      // reverse_quantity ist jetzt integer-nativ (fam-lem.27.7, contract.md
      // Abschnitt 3): der Builder schreibt Integer-Tausendstel direkt.
      type === 'waste'
        ? { deleted_at: null, quantity: 3000 }
        : { deleted_at: null, quantity: type === 'in' ? 3000 : 5000 },
    );
    expect(
      await db.getFirstAsync<{
        type: string;
        quantity: number;
        reversal_of: string | null;
        notes: string | null;
      }>('select type, quantity, reversal_of, notes from transactions where reversal_of = ?', [
        `source-${type}`,
      ]),
    ).toEqual({
      type: inverse,
      quantity: sourceQuantity * 1000,
      reversal_of: `source-${type}`,
      notes: '[Undone] Gegenbuchung',
    });

    await act(async () => {
      await expect(result.current.mutateAsync({ transaction: source })).rejects.toThrow(
        'bereits rückgängig',
      );
    });
    expect(
      await db.getAllAsync('select id from transactions where reversal_of = ?', [`source-${type}`]),
    ).toHaveLength(1);
  });

  it('stellt eine verbrauchte Menge nach 24 Stunden als Manual correction wieder her', async () => {
    await insertItem(db, { ...ITEM_BASE, quantity: 2 });
    await insertTransaction(db, {
      id: 'source-old-out',
      type: 'out',
      quantity: 1,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000 - 1).toISOString(),
    });

    const { result } = await renderMutationHook(() => useUndoInventoryTransactionMutation());
    const source = await db.getFirstAsync<LocalInventoryTransaction>(
      'select * from transactions where id = ?',
      ['source-old-out'],
    );
    if (!source) throw new Error('Quelle fehlt.');
    await act(async () => {
      await result.current.mutateAsync({ transaction: source });
    });

    expect(
      await db.getFirstAsync<{ quantity: number }>(
        'select quantity from fridge_items where id = ?',
        ['item-1'],
      ),
    ).toEqual({ quantity: 3000 });
    expect(
      await db.getFirstAsync<{ type: string; notes: string | null; reversal_of: string | null }>(
        'select type, notes, reversal_of from transactions where reversal_of = ?',
        ['source-old-out'],
      ),
    ).toEqual({ type: 'in', notes: '[Manual correction]', reversal_of: 'source-old-out' });
  });

  it.each([
    ['in', 'out', 5, 2],
    ['out', 'in', 3, 1],
    ['waste', 'in', 3, 3],
  ] as const)(
    'markiert %s nach 24 Stunden als Manual correction',
    async (type, inverse, currentQuantity, sourceQuantity) => {
      await insertItem(db, { ...ITEM_BASE, quantity: currentQuantity });
      await insertTransaction(db, {
        id: `source-old-${type}`,
        type,
        quantity: sourceQuantity,
        reason: type === 'waste' ? 'expired' : null,
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000 - 1).toISOString(),
      });
      if (type === 'waste') {
        await db.runAsync('update fridge_items set deleted_at = ?, updated_at = ? where id = ?', [
          Date.now(),
          Date.now(),
          'item-1',
        ]);
      }

      const { result } = await renderMutationHook(() => useUndoInventoryTransactionMutation());
      const source = await db.getFirstAsync<LocalInventoryTransaction>(
        'select * from transactions where id = ?',
        [`source-old-${type}`],
      );
      if (!source) throw new Error('Quelle fehlt.');

      await act(async () => {
        await result.current.mutateAsync({ transaction: source });
      });

      expect(
        await db.getFirstAsync<{ type: string; notes: string | null; reversal_of: string | null }>(
          'select type, notes, reversal_of from transactions where reversal_of = ?',
          [`source-old-${type}`],
        ),
      ).toEqual({
        type: inverse,
        notes: '[Manual correction]',
        reversal_of: `source-old-${type}`,
      });
    },
  );

  it('macht einen Move als atomare gruppierte Gegenbuchung rückgängig und schützt Wiederholung', async () => {
    await insertItem(db, { ...ITEM_BASE, location_id: 'loc-new', quantity: 3 });
    await insertTransaction(db, {
      id: 'move-out',
      operation_id: 'move-source',
      type: 'out',
      quantity: 3,
      location_id: 'loc-old',
      created_at: new Date(Date.now() - 60_000).toISOString(),
    });
    await insertTransaction(db, {
      id: 'move-in',
      operation_id: 'move-source',
      type: 'in',
      quantity: 3,
      location_id: 'loc-new',
      created_at: new Date(Date.now() - 60_000).toISOString(),
    });

    const { result } = await renderMutationHook(() => useUndoInventoryTransactionMutation());
    const source = await db.getFirstAsync<LocalInventoryTransaction>(
      'select * from transactions where id = ?',
      ['move-in'],
    );
    if (!source) throw new Error('Move-Quelle fehlt.');
    await act(async () => {
      await result.current.mutateAsync({ transaction: source });
    });

    expect(
      await db.getFirstAsync<{ location_id: string }>(
        'select location_id from fridge_items where id = ?',
        ['item-1'],
      ),
    ).toEqual({ location_id: 'loc-old' });
    const reversal = await db.getAllAsync<{
      type: string;
      operation_id: string;
      reversal_of: string | null;
      notes: string | null;
    }>(
      'select type, operation_id, reversal_of, notes from transactions where reversal_of = ? order by type',
      ['move-source'],
    );
    expect(reversal).toHaveLength(2);
    expect(reversal.map(({ type }) => type)).toEqual(['in', 'out']);
    expect(new Set(reversal.map(({ operation_id }) => operation_id)).size).toBe(1);
    expect(reversal.every(({ notes }) => notes === '[Undone] Gegenbuchung')).toBe(true);

    await act(async () => {
      await expect(result.current.mutateAsync({ transaction: source })).rejects.toThrow(
        'bereits rückgängig',
      );
    });
    expect(
      await db.getAllAsync('select id from transactions where reversal_of = ?', ['move-source']),
    ).toHaveLength(2);
  });

  it('markiert einen Move nach 24 Stunden als gruppierte Manual correction', async () => {
    const createdAt = new Date(Date.now() - 24 * 60 * 60 * 1000 - 1).toISOString();
    await insertItem(db, { ...ITEM_BASE, location_id: 'loc-new', quantity: 3 });
    await insertTransaction(db, {
      id: 'old-move-out',
      operation_id: 'old-move-source',
      type: 'out',
      quantity: 3,
      location_id: 'loc-old',
      created_at: createdAt,
    });
    await insertTransaction(db, {
      id: 'old-move-in',
      operation_id: 'old-move-source',
      type: 'in',
      quantity: 3,
      location_id: 'loc-new',
      created_at: createdAt,
    });

    const { result } = await renderMutationHook(() => useUndoInventoryTransactionMutation());
    const source = await db.getFirstAsync<LocalInventoryTransaction>(
      'select * from transactions where id = ?',
      ['old-move-in'],
    );
    if (!source) throw new Error('Move-Quelle fehlt.');

    await act(async () => {
      await result.current.mutateAsync({ transaction: source });
    });

    expect(
      await db.getFirstAsync<{ location_id: string }>(
        'select location_id from fridge_items where id = ?',
        ['item-1'],
      ),
    ).toEqual({ location_id: 'loc-old' });
    expect(
      await db.getAllAsync<{ notes: string | null }>(
        'select notes from transactions where reversal_of = ? order by type',
        ['old-move-source'],
      ),
    ).toEqual([{ notes: '[Manual correction]' }, { notes: '[Manual correction]' }]);
  });

  it('weist unendliche Verbrauchsdeltas vor dem Enqueue zurück', async () => {
    await insertItem(db);
    const { result } = await renderMutationHook(() => useUpdateInventoryItemQuantityMutation());

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'item-1',
          household_id: 'hh-1',
          delta: Number.NEGATIVE_INFINITY,
        }),
      ).rejects.toThrow('endliche');
    });
    expect(await outboxRows(db)).toEqual([]);
  });
});
