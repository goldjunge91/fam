import type { Session } from '@supabase/supabase-js';
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  render,
  requireActual,
} from 'react-native-harness';

import { deleteLocalDatabase, getDatabase, setActiveUserId } from '@/lib/db/client';
import type { SqlDatabase } from '@/lib/db/types';
import {
  ACTOR_ID,
  ITEM_BASE,
  insertItem,
  outboxRows,
  rowsForItem,
} from '../../../test/inventory-test-fixtures';

/**
 * On-device Bridge- und Smoke-Suite fuer Inventory-Mutations.
 *
 * Testet die Ausfuehrung der Kernmutationen (Add, Consume, Move, Waste)
 * gegen die echte native SQLite-Instanz (expo-sqlite) auf dem Geraet / Simulator.
 *
 * Die exhaustive Pruefung aller Validierungsregeln, Berechnungen, Undo-Fenster
 * und Edge Cases laeuft schnell und vollstaendig in
 * `use-inventory-mutations.integration.test.tsx`.
 */

let mockUuidCounter = 0;

mock('@/features/auth/session-provider', () => ({
  useSession: () => ({
    session: { user: { id: ACTOR_ID } } as unknown as Session,
    isLoading: false,
    seenOnboarding: true,
    error: null,
  }),
}));

mock('@/lib/analytics', () => ({ trackAnalyticsEvent: () => undefined }));

mock('expo-crypto', () => {
  const actual = requireActual<typeof import('expo-crypto')>('expo-crypto');
  return { ...actual, randomUUID: () => `generated-${++mockUuidCounter}` };
});

const {
  useAddFridgeItemMutation,
  useMoveInventoryItemMutation,
  useUpdateInventoryItemQuantityMutation,
  useWasteInventoryItemMutation,
} = require('./use-inventory-mutations') as typeof import('./use-inventory-mutations');

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

async function renderMutationHook<T>(hook: () => T) {
  let current!: T;

  await render(
    createElement(
      QueryClientProvider,
      { client: createQueryClient() },
      createElement(HookHarness<T>, { hook, onReady: (value) => (current = value) }),
    ),
  );

  return {
    result: {
      get current(): T {
        return current;
      },
    },
  };
}

describe('Inventory-Mutations gegen die echte on-device SQLite', () => {
  let db: SqlDatabase;

  beforeAll(() => {
    notifyManager.setScheduler((notify) => notify());
    setActiveUserId(ACTOR_ID);
  });

  beforeEach(async () => {
    mockUuidCounter = 0;
    db = await getDatabase();
  });

  afterEach(async () => {
    await deleteLocalDatabase();
  });

  afterAll(() => {
    notifyManager.setScheduler((notify) => setTimeout(notify, 0));
    setActiveUserId(null);
  });

  it('add schreibt lokale Bestandszeile, Zugang und zwei Outbox-Einträge', async () => {
    const { result } = await renderMutationHook(() => useAddFridgeItemMutation());

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

  it('consume schreibt nur die effektive out-Menge und löscht bei null weich', async () => {
    await insertItem(db);
    const { result } = await renderMutationHook(() => useUpdateInventoryItemQuantityMutation());

    await result.current.mutateAsync({ id: 'item-1', household_id: 'hh-1', delta: -10 });

    const item = await db.getFirstAsync<{ quantity: number; deleted_at: number; _dirty: number }>(
      'select quantity, deleted_at, _dirty from fridge_items where id = ?',
      ['item-1'],
    );
    expect(item).toEqual({ quantity: 0, deleted_at: expect.any(Number), _dirty: 1 });
    expect(await rowsForItem(db, 'item-1')).toEqual([
      expect.objectContaining({ type: 'in', quantity: 1, operation_id: null }),
      expect.objectContaining({ type: 'out', quantity: 1, operation_id: null }),
    ]);
    expect(await outboxRows(db)).toHaveLength(2);
  });

  it('direct move schreibt die zwei Ledger-Legs atomar in einer Move-Outbox-Mutation', async () => {
    await insertItem(db, { ...ITEM_BASE, quantity: 2 });
    const { result } = await renderMutationHook(() => useMoveInventoryItemMutation());

    await result.current.mutateAsync({
      item: { ...ITEM_BASE, quantity: 2 },
      locationId: 'loc-new',
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

    await result.current.mutateAsync({ item: { ...ITEM_BASE, quantity: 2 }, reason: 'spoiled' });

    const item = await db.getFirstAsync<{ deleted_at: number; _dirty: number }>(
      'select deleted_at, _dirty from fridge_items where id = ?',
      ['item-1'],
    );
    expect(item).toEqual({ deleted_at: expect.any(Number), _dirty: 1 });
    expect(await rowsForItem(db, 'item-1')).toEqual([
      expect.objectContaining({ type: 'waste', quantity: 2, reason: 'spoiled' }),
    ]);
  });
});
