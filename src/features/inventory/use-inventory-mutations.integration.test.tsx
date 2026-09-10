import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, createElement } from 'react';
import { createRoot } from 'test-renderer';

import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import {
  ITEM_BASE,
  insertItem,
  insertTransaction,
  outboxRows,
  rowsForItem,
} from '../../../test/inventory-test-fixtures';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';
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
  useUpdateFridgeItemMutation,
  useUpdateInventoryItemQuantityMutation,
  useWasteInventoryItemMutation,
} = require('./use-inventory-mutations') as typeof import('./use-inventory-mutations');
const { useInventoryTransactions } =
  require('./use-inventory-transactions') as typeof import('./use-inventory-transactions');

const mockedGetDatabase = jest.mocked(getDatabase);
const mockedUseSession = jest.mocked(useSession);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

    // Integer-Tausendstel seit fam-lem.27.10 (contract.md Abschnitt 3).
    expect(item).toEqual({ quantity: 2000, _dirty: 1 });
    expect(ledger).toEqual([
      expect.objectContaining({ type: 'in', quantity: 2000, operation_id: null }),
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
    await insertItem(db, { ...ITEM_BASE, quantity: 3000 });
    const { result } = await renderMutationHook(() => useUpdateInventoryItemQuantityMutation());

    await act(async () => {
      await result.current.mutateAsync({ id: 'item-1', household_id: 'hh-1', delta: -10 });
    });

    const item = await db.getFirstAsync<{ quantity: number; deleted_at: number; _dirty: number }>(
      'select quantity, deleted_at, _dirty from fridge_items where id = ?',
      ['item-1'],
    );
    expect(item).toEqual({ quantity: 0, deleted_at: expect.any(Number), _dirty: 1 });
    // Ledger und lokaler Spiegel sind seit dem Integer-Cutover (fam-lem.30.7.1/
    // .30.7.4) beide Integer-Tausendstel (contract.md Abschnitt 3).
    expect(await rowsForItem(db, 'item-1')).toEqual([
      expect.objectContaining({ type: 'out', quantity: 3_000, location_id: 'loc-old' }),
    ]);
    expect(await outboxRows(db)).toHaveLength(1);
  });

  it('serialisiert parallele lokale Verbraeuche und bucht beide Deltas', async () => {
    await insertItem(db, { ...ITEM_BASE, quantity: 5000 });
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
    ).toEqual({ quantity: 3000 });
    expect(
      await db.getAllAsync('select id from transactions where fridge_item_id = ?', ['item-1']),
    ).toHaveLength(2);
    // Ledger und lokaler Spiegel sind seit dem Integer-Cutover (fam-lem.30.7.1/
    // .30.7.4) beide Integer-Tausendstel (contract.md Abschnitt 3).
    expect(
      await db.getAllAsync<{ type: string; quantity: number }>(
        `select type, quantity from transactions where fridge_item_id = ? order by id`,
        ['item-1'],
      ),
    ).toEqual([
      { type: 'out', quantity: 1_000 },
      { type: 'out', quantity: 1_000 },
    ]);
  });

  it('verbraucht einen Dezimalrest exakt bis null', async () => {
    await insertItem(db, { ...ITEM_BASE, quantity: 1100 });
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
      { type: 'out', quantity: 1_000 },
      { type: 'out', quantity: 100 },
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
      expect.objectContaining({ type: 'out', quantity: 4000, location_id: 'loc-old' }),
      expect.objectContaining({ type: 'in', quantity: 4000, location_id: 'loc-new' }),
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
      expect.objectContaining({ type: 'out', quantity: 2000, location_id: 'loc-old' }),
      expect.objectContaining({ type: 'in', quantity: 2000, location_id: 'loc-new' }),
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
      expect.objectContaining({ type: 'waste', quantity: 2000, reason: 'spoiled' }),
    ]);
  });

  it('open quantity=1 aktualisiert den Bestand in-place und erzeugt keine Ledgerzeile', async () => {
    await insertItem(db, { ...ITEM_BASE, quantity: 1000 });
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
      quantity: 1000,
      opened_at: expect.any(String),
      expiry_date: expect.any(String),
      vacuum_sealed: 0,
    });
    expect(await rowsForItem(db, 'item-1')).toEqual([]);
  });

  it('open quantity>1 splittet, bewahrt die Gesamtmenge und erzeugt keine Ledgerzeile', async () => {
    await insertItem(db, { ...ITEM_BASE, quantity: 3000 });
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
    expect(items).toHaveLength(2);
    expect(items.map(({ quantity }) => quantity).sort((a, b) => a - b)).toEqual([1000, 2000]);
    expect(items.find(({ opened_at }) => opened_at !== null)).toEqual(
      expect.objectContaining({ quantity: 1000, opened_at: expect.any(String) }),
    );
    expect(await db.getAllAsync('select id from transactions', [])).toEqual([]);
    expect(await outboxRows(db)).toHaveLength(1);
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
    const sourceQuantity = type === 'waste' ? 3000 : 2000;
    await insertItem(db, { ...ITEM_BASE, quantity: type === 'in' ? 5000 : 3000 });
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
      type: 'in' | 'out' | 'waste';
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
      quantity: sourceQuantity,
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
    await insertItem(db, { ...ITEM_BASE, quantity: 2000 });
    await insertTransaction(db, {
      id: 'source-old-out',
      type: 'out',
      quantity: 1000,
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
    ['in', 'out', 5000, 2000],
    ['out', 'in', 3000, 1000],
    ['waste', 'in', 3000, 3000],
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
