import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Crypto from 'expo-crypto';
import type React from 'react';

import type { EnqueueMutationInput } from '@/lib/db/outbox';
import * as Outbox from '@/lib/db/outbox';

import type { LocalInventoryItem } from './use-inventory-items';
import {
  useAddFridgeItemMutation,
  useMoveInventoryItemMutation,
  useOpenInventoryItemMutation,
  useUndoInventoryTransactionMutation,
  useUndoOpenTransactionMutation,
  useUpdateFridgeItemMutation,
  useUpdateInventoryItemQuantityMutation,
  useWasteInventoryItemMutation,
} from './use-inventory-mutations';
import type { LocalInventoryTransaction } from './use-inventory-transactions';

const mockGetFirstAsync = jest.fn();

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'actor-1' } } }),
}));

jest.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: jest.fn() }));

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

jest.mock('@/lib/db/client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getFirstAsync: (...args: unknown[]) => mockGetFirstAsync(...args),
  }),
}));

jest.mock('@/lib/db/outbox', () => ({
  enqueueMutation: jest.fn(),
  enqueueMutations: jest.fn(),
  enqueueMutationsInExclusiveTransaction: jest.fn(),
}));

jest.mock('@/lib/sync/mirror-write', () => ({
  applyLocalMirrorWrite: jest.fn().mockResolvedValue(undefined),
}));

const ITEM: LocalInventoryItem = {
  id: 'item-1',
  household_id: 'hh-1',
  location_id: 'loc-1',
  product_id: 'product-1',
  name: 'Senf',
  quantity: 3,
  unit: 'piece',
  package_size: null,
  package_size_unit: null,
  expiry_date: '2026-12-31',
  opened_at: null,
  vacuum_sealed: false,
  expiry_user_set: false,
  added_by: 'actor-1',
  created_at: '2026-09-04T08:00:00.000Z',
  location_kind: 'fridge',
  location_name: 'Kühlschrank',
};

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
            mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
          },
        })
      }>
      {children}
    </QueryClientProvider>
  );
}

function lastMutations(): EnqueueMutationInput[] {
  return jest.mocked(Outbox.enqueueMutations).mock.calls.at(-1)?.[1] as EnqueueMutationInput[];
}

function transactionPayloads(): Record<string, unknown>[] {
  return lastMutations()
    .filter((mutation) => mutation.entity === 'transactions')
    .map((mutation) => mutation.payload);
}

describe('inventory mutation hooks', () => {
  beforeAll(() => {
    notifyManager.setScheduler((notify) => notify());
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFirstAsync.mockReset();
    jest.mocked(Outbox.enqueueMutation).mockResolvedValue(undefined);
    jest.mocked(Outbox.enqueueMutations).mockResolvedValue(undefined);
    jest
      .mocked(Outbox.enqueueMutationsInExclusiveTransaction)
      .mockImplementation(async (db, build) => {
        const inputs = await build(db);
        if (inputs.length > 0) await Outbox.enqueueMutations(db, inputs);
      });
    jest.mocked(Crypto.randomUUID).mockReturnValue('generated-id');
  });

  afterAll(() => {
    notifyManager.setScheduler((notify) => setTimeout(notify, 0));
  });

  it('protokolliert einen neuen Zugang mit dem angemeldeten Actor', async () => {
    const { result } = await renderHook(() => useAddFridgeItemMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        household_id: 'hh-1',
        location_id: 'loc-1',
        product_id: 'product-1',
        name: 'Senf',
        quantity: 2,
        unit: 'piece',
        package_size: null,
        package_size_unit: null,
        expiry_date: null,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lastMutations()).toHaveLength(2);
    expect(lastMutations()[0].payload).toEqual(
      expect.objectContaining({
        opened_at: null,
        vacuum_sealed: false,
        expiry_user_set: false,
      }),
    );
    expect(transactionPayloads()).toEqual([
      expect.objectContaining({
        actor: 'actor-1',
        type: 'in',
        quantity: 2,
        household_id: 'hh-1',
      }),
    ]);
  });

  it('protokolliert einen Verbrauch mit der tatsächlich geänderten Menge', async () => {
    mockGetFirstAsync.mockResolvedValue({
      quantity: 3,
      name: 'Senf',
      product_id: 'product-1',
      location_id: 'loc-1',
      expiry_date: '2026-12-31',
    });
    const { result } = await renderHook(() => useUpdateInventoryItemQuantityMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 'item-1', household_id: 'hh-1', delta: -1 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lastMutations()).toEqual([
      expect.objectContaining({
        entity: 'fridge_items',
        op: 'adjust_quantity',
        payload: expect.objectContaining({ delta: -1, item_id: 'item-1' }),
      }),
    ]);
  });

  it('bucht beim Verbrauch bis auf null nur die effektive Menge und löscht lokal', async () => {
    mockGetFirstAsync.mockResolvedValue({
      quantity: 3,
      name: 'Senf',
      product_id: 'product-1',
      location_id: 'loc-1',
      expiry_date: '2026-12-31',
    });
    const { result } = await renderHook(() => useUpdateInventoryItemQuantityMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 'item-1', household_id: 'hh-1', delta: -10 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lastMutations()).toEqual([
      expect.objectContaining({
        entity: 'fridge_items',
        op: 'adjust_quantity',
        payload: expect.objectContaining({ delta: -3, item_id: 'item-1' }),
      }),
    ]);
  });

  it('behandelt eine Mengenbuchung mit operation_id beim Undo nicht als Move', async () => {
    mockGetFirstAsync
      .mockResolvedValueOnce({ ...ITEM, quantity: 3, deleted_at: null })
      .mockResolvedValueOnce(null);
    const transaction: LocalInventoryTransaction = {
      id: 'quantity-transaction-1',
      operation_id: 'quantity-operation-1',
      operation_legs: 1,
      household_id: 'hh-1',
      fridge_item_id: 'item-1',
      product_id: 'product-1',
      actor: 'actor-1',
      type: 'out',
      quantity: 1,
      location_id: 'loc-1',
      reason: null,
      previous_expiry_date: null,
      notes: null,
      undone: false,
      created_at: new Date().toISOString(),
    };
    const { result } = await renderHook(() => useUndoInventoryTransactionMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ transaction });
    });

    expect(lastMutations()).toHaveLength(1);
    expect(lastMutations()[0]).toMatchObject({
      entity: 'fridge_items',
      op: 'reverse_quantity',
      payload: {
        item_id: 'item-1',
        household_id: 'hh-1',
        reversal_of: 'quantity-transaction-1',
      },
    });
  });

  it('erzeugt bei einer No-op-Mengenänderung keine Ledger-Buchung', async () => {
    mockGetFirstAsync.mockResolvedValue({
      quantity: 3,
      name: 'Senf',
      product_id: 'product-1',
      location_id: 'loc-1',
      expiry_date: '2026-12-31',
    });
    const { result } = await renderHook(() => useUpdateInventoryItemQuantityMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 'item-1', household_id: 'hh-1', delta: 0 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Outbox.enqueueMutations).not.toHaveBeenCalled();
  });

  it('sendet bei einer reinen Metadatenänderung weder Menge noch unveränderte Felder', async () => {
    mockGetFirstAsync.mockResolvedValue({
      ...ITEM,
      vacuum_sealed: 0,
      expiry_user_set: 0,
    });
    const { result } = await renderHook(() => useUpdateFridgeItemMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: ITEM.id, household_id: ITEM.household_id, patch: { name: 'Dijon-Senf' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lastMutations()).toHaveLength(1);
    expect(lastMutations()[0]).toMatchObject({
      entity: 'fridge_items',
      op: 'update',
      payload: { id: 'item-1', household_id: 'hh-1', name: 'Dijon-Senf' },
    });
    expect(lastMutations()[0]?.payload).not.toHaveProperty('quantity');
    expect(lastMutations()[0]?.payload).not.toHaveProperty('unit');
    expect(lastMutations()[0]?.payload).not.toHaveProperty('expiry_date');
  });

  it('überschreibt bei reiner Namensänderung keinen zwischenzeitlichen Verbrauch (fam-87p)', async () => {
    // Lokaler Spiegel hat den Verbrauch bereits übernommen (5 -> 4), der
    // Dialog wurde aber bei 5 geöffnet und schickt keine quantityCorrection.
    mockGetFirstAsync.mockResolvedValue({ ...ITEM, quantity: 4 });
    const { result } = await renderHook(() => useUpdateFridgeItemMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: ITEM.id, household_id: ITEM.household_id, patch: { name: 'Dijon-Senf' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lastMutations()).toHaveLength(1);
    expect(lastMutations()[0]).toMatchObject({ entity: 'fridge_items', op: 'update' });
    expect(lastMutations()[0]?.payload).not.toHaveProperty('quantity');
  });

  it('bewahrt bei einem expliziten Namenspatch fremde Metadaten und den aktuellen Bestand', async () => {
    mockGetFirstAsync.mockResolvedValue({
      ...ITEM,
      quantity: 2,
      expiry_date: '2027-02-01',
      location_id: 'loc-remote',
      unit: 'g',
      vacuum_sealed: 1,
    });
    const { result } = await renderHook(() => useUpdateFridgeItemMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: ITEM.id,
        household_id: ITEM.household_id,
        patch: { name: 'Dijon-Senf' },
      });
    });

    expect(lastMutations()).toHaveLength(1);
    expect(lastMutations()[0]?.payload).toEqual({
      id: ITEM.id,
      household_id: ITEM.household_id,
      name: 'Dijon-Senf',
    });
  });

  it('überträgt bewusstes Löschen als null im expliziten Metadatenpatch', async () => {
    mockGetFirstAsync.mockResolvedValue(ITEM);
    const { result } = await renderHook(() => useUpdateFridgeItemMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: ITEM.id,
        household_id: ITEM.household_id,
        patch: { expiry_date: null, expiry_user_set: true },
      });
    });

    expect(lastMutations()).toHaveLength(1);
    expect(lastMutations()[0]?.payload).toEqual({
      id: ITEM.id,
      household_id: ITEM.household_id,
      expiry_date: null,
      expiry_user_set: true,
    });
  });

  it('bucht Mengen- und Lagerortkorrektur atomar als eine Outbox-Gruppe', async () => {
    mockGetFirstAsync.mockResolvedValue({ quantity: 3, location_id: 'loc-1' });
    const { result } = await renderHook(() => useUpdateFridgeItemMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: ITEM.id,
        household_id: ITEM.household_id,
        patch: { location_id: 'loc-2' },
        quantityCorrection: { expectedQuantity: 3, newQuantity: 4 },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lastMutations()).toHaveLength(2);
    expect(lastMutations()[0]).toMatchObject({
      entity: 'fridge_items',
      op: 'correct_quantity',
      payload: { expected_quantity: 3, new_quantity: 4 },
    });
    expect(lastMutations()[1]).toMatchObject({
      entity: 'fridge_items',
      op: 'move',
      payload: { expected_quantity: 4 },
    });
  });

  it('führt eine Lagerortänderung auch aus der manuellen Bearbeitung als gruppierten Move aus', async () => {
    mockGetFirstAsync.mockResolvedValue({ quantity: 3, location_id: 'loc-1' });
    jest
      .mocked(Crypto.randomUUID)
      .mockReturnValueOnce('operation-id')
      .mockReturnValueOnce('out-id')
      .mockReturnValueOnce('in-id');
    const { result } = await renderHook(() => useUpdateFridgeItemMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: ITEM.id, household_id: ITEM.household_id, patch: { location_id: 'loc-2' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lastMutations()).toHaveLength(1);
    expect(lastMutations()[0]).toMatchObject({
      entity: 'fridge_items',
      entityId: 'item-1',
      op: 'move',
      payload: {
        operation_id: 'operation-id',
        expected_location_id: 'loc-1',
        new_location_id: 'loc-2',
        expected_quantity: 3,
        out_transaction_id: 'out-id',
        in_transaction_id: 'in-id',
      },
    });
  });

  it('soft-deletet eine manuelle Korrektur auf null und bucht die effektive out-Menge', async () => {
    mockGetFirstAsync.mockResolvedValue({ quantity: 3, location_id: 'loc-1' });
    const { result } = await renderHook(() => useUpdateFridgeItemMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: ITEM.id,
        household_id: ITEM.household_id,
        patch: {},
        quantityCorrection: { expectedQuantity: 3, newQuantity: 0 },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lastMutations()).toHaveLength(1);
    expect(lastMutations()[0]).toMatchObject({
      entity: 'fridge_items',
      op: 'correct_quantity',
      payload: {
        item_id: 'item-1',
        household_id: 'hh-1',
        expected_quantity: 3,
        new_quantity: 0,
      },
    });
  });

  it('bucht bei Entnahme auf null trotz Lagerortänderung nur am bisherigen Lagerort', async () => {
    mockGetFirstAsync.mockResolvedValue({ quantity: 3, location_id: 'loc-1' });
    const { result } = await renderHook(() => useUpdateFridgeItemMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: ITEM.id,
        household_id: ITEM.household_id,
        patch: { location_id: 'loc-2' },
        quantityCorrection: { expectedQuantity: 3, newQuantity: 0 },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lastMutations()).toHaveLength(1);
    expect(lastMutations()[0]).toMatchObject({
      entity: 'fridge_items',
      op: 'correct_quantity',
      payload: { expected_quantity: 3, new_quantity: 0 },
    });
  });

  it('bucht Öffnen, Wegwerfen und Verschieben jeweils mit Actor', async () => {
    jest
      .mocked(Crypto.randomUUID)
      .mockReturnValueOnce('open-item-id')
      .mockReturnValueOnce('open-transaction-id')
      .mockReturnValueOnce('waste-id')
      .mockReturnValueOnce('operation-id')
      .mockReturnValueOnce('out-id')
      .mockReturnValueOnce('in-id');

    mockGetFirstAsync.mockResolvedValueOnce({ ...ITEM, quantity: 1 });
    const openHook = await renderHook(() => useOpenInventoryItemMutation(), { wrapper });
    await act(async () => {
      await openHook.result.current.mutateAsync({ item: { ...ITEM, quantity: 1 }, quantity: 1 });
    });
    expect(transactionPayloads()).toEqual([
      expect.objectContaining({ actor: 'actor-1', type: 'open', quantity: 1 }),
    ]);

    const wasteHook = await renderHook(() => useWasteInventoryItemMutation(), { wrapper });
    await act(async () => {
      await wasteHook.result.current.mutateAsync({ item: ITEM, reason: 'expired' });
    });
    expect(transactionPayloads()).toEqual([
      expect.objectContaining({ actor: 'actor-1', type: 'waste', reason: 'expired' }),
    ]);

    const moveHook = await renderHook(() => useMoveInventoryItemMutation(), { wrapper });
    await act(async () => {
      await moveHook.result.current.mutateAsync({ item: ITEM, locationId: 'loc-2' });
    });
    expect(lastMutations()).toHaveLength(1);
    expect(lastMutations()[0]).toMatchObject({
      entity: 'fridge_items',
      entityId: 'item-1',
      op: 'move',
      payload: {
        operation_id: 'operation-id',
        item_id: 'item-1',
        household_id: 'hh-1',
        expected_location_id: 'loc-1',
        new_location_id: 'loc-2',
        expected_quantity: 3,
        out_transaction_id: 'out-id',
        in_transaction_id: 'in-id',
      },
    });
  });

  it('bucht einen Split als eine atomare Server-Operation mit Compare-and-set gegen die frische Menge (fam-n46.1)', async () => {
    jest
      .mocked(Crypto.randomUUID)
      .mockReturnValueOnce('opened-item-id')
      .mockReturnValueOnce('open-transaction-id');
    const item = {
      ...ITEM,
      quantity: 3,
      vacuum_sealed: true,
      expiry_user_set: true,
    };
    // Der frisch gelesene lokale Stand entscheidet über die Planung, nicht
    // der (potenziell veraltete) UI-Snapshot im mutateAsync-Argument.
    mockGetFirstAsync.mockResolvedValueOnce(item);
    const { result } = await renderHook(() => useOpenInventoryItemMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ item, quantity: 1 });
    });

    expect(lastMutations()).toHaveLength(1);
    expect(lastMutations()[0]).toMatchObject({
      entity: 'fridge_items',
      entityId: 'item-1',
      op: 'split_open',
      payload: {
        transaction_id: 'open-transaction-id',
        source_item_id: 'item-1',
        opened_item_id: 'opened-item-id',
        household_id: 'hh-1',
        expected_source_quantity: 3,
        open_quantity: 1,
      },
    });
  });

  it('bucht Split-Undo als eine atomare Merge-Operation gegen die referenzierte Split-Buchung (fam-n46.1)', async () => {
    mockGetFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...ITEM,
        id: 'opened-item-id',
        quantity: 1,
        opened_at: '2026-09-04T09:00:00.000Z',
        expiry_date: '2026-09-09',
      })
      .mockResolvedValueOnce({ ...ITEM, quantity: 2 });
    const transaction: LocalInventoryTransaction = {
      id: 'transaction-1',
      household_id: 'hh-1',
      fridge_item_id: 'opened-item-id',
      product_id: 'product-1',
      actor: 'actor-1',
      type: 'open',
      quantity: 1,
      location_id: 'loc-1',
      reason: null,
      previous_expiry_date: '2026-12-31',
      origin_item_id: 'item-1',
      origin_quantity: 3,
      notes: '[Split] origin=item-1',
      undone: false,
      created_at: new Date().toISOString(),
    };
    const { result } = await renderHook(() => useUndoOpenTransactionMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ transaction });
    });

    expect(lastMutations()).toHaveLength(1);
    expect(lastMutations()[0]).toMatchObject({
      entity: 'fridge_items',
      entityId: 'item-1',
      op: 'merge_undo_open',
      payload: {
        reversal_of: 'transaction-1',
        household_id: 'hh-1',
      },
    });
  });

  it('bucht Split-Undo nach einer konkurrierenden Änderung der Ursprungsmenge als Fallback', async () => {
    const openedAt = new Date(Date.now() - 120_000);
    mockGetFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...ITEM,
        id: 'opened-item-id',
        quantity: 1,
        opened_at: openedAt.toISOString(),
        expiry_date: '2026-09-09',
      })
      .mockResolvedValueOnce({
        ...ITEM,
        quantity: 7,
        updated_at: Date.now(),
      });
    const transaction: LocalInventoryTransaction = {
      id: 'transaction-1',
      household_id: 'hh-1',
      fridge_item_id: 'opened-item-id',
      product_id: 'product-1',
      actor: 'actor-1',
      type: 'open',
      quantity: 1,
      location_id: 'loc-1',
      reason: null,
      previous_expiry_date: '2026-12-31',
      notes: '[Split] origin=item-1',
      undone: false,
      created_at: new Date(Date.now() - 60_000).toISOString(),
    };
    const { result } = await renderHook(() => useUndoOpenTransactionMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ transaction });
    });
    expect(lastMutations()).toHaveLength(1);
    expect(lastMutations()[0]).toMatchObject({
      entity: 'transactions',
      op: 'insert',
      payload: {
        reversal_of: 'transaction-1',
        notes: '[Undone] Öffnung rückgängig gemacht',
      },
    });
  });

  it('beendet einen bereits rückgängig gemachten Open-Vorgang idempotent', async () => {
    const transaction: LocalInventoryTransaction = {
      id: 'transaction-1',
      household_id: 'hh-1',
      fridge_item_id: 'item-1',
      product_id: 'product-1',
      actor: 'actor-1',
      type: 'open',
      quantity: 1,
      location_id: 'loc-1',
      reason: null,
      previous_expiry_date: '2026-12-31',
      notes: null,
      undone: true,
      created_at: new Date().toISOString(),
    };
    const { result } = await renderHook(() => useUndoOpenTransactionMutation(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ transaction })).rejects.toThrow(
        'bereits rückgängig',
      );
    });
    expect(Outbox.enqueueMutations).not.toHaveBeenCalled();
  });

  it('verhindert einen zweiten Undo desselben Open-Vorgangs anhand der Historie', async () => {
    const createdAt = new Date(Date.now() - 60_000);
    const openedRow = {
      ...ITEM,
      opened_at: createdAt.toISOString(),
      expiry_date: '2026-09-09',
    };
    mockGetFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(openedRow)
      .mockResolvedValueOnce({ id: 'undo-transaction-1' });
    const transaction: LocalInventoryTransaction = {
      id: 'transaction-1',
      household_id: 'hh-1',
      fridge_item_id: 'item-1',
      product_id: 'product-1',
      actor: 'actor-1',
      type: 'open',
      quantity: 1,
      location_id: 'loc-1',
      reason: null,
      previous_expiry_date: '2026-12-31',
      notes: null,
      undone: false,
      created_at: createdAt.toISOString(),
    };
    const { result } = await renderHook(() => useUndoOpenTransactionMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ transaction });
    });
    await act(async () => {
      await expect(result.current.mutateAsync({ transaction })).rejects.toThrow(
        'bereits rückgängig',
      );
    });
    expect(Outbox.enqueueMutations).toHaveBeenCalledTimes(1);
  });

  it('bucht einen Split mit fehlender Ursprungszeile als Merge-Fallback', async () => {
    mockGetFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...ITEM,
        id: 'opened-item-id',
        quantity: 1,
        opened_at: '2026-09-04T09:00:00.000Z',
        expiry_date: '2026-09-09',
      })
      .mockResolvedValueOnce(null);
    const transaction: LocalInventoryTransaction = {
      id: 'transaction-1',
      household_id: 'hh-1',
      fridge_item_id: 'opened-item-id',
      product_id: 'product-1',
      actor: 'actor-1',
      type: 'open',
      quantity: 1,
      location_id: 'loc-1',
      reason: null,
      previous_expiry_date: '2026-12-31',
      notes: '[Split] origin=item-1',
      undone: false,
      created_at: new Date().toISOString(),
    };
    const { result } = await renderHook(() => useUndoOpenTransactionMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ transaction });
    });
    expect(lastMutations()).toHaveLength(1);
    expect(lastMutations()[0]).toMatchObject({
      entity: 'transactions',
      op: 'insert',
      payload: {
        reversal_of: 'transaction-1',
        notes: '[Undone] Öffnung rückgängig gemacht',
      },
    });
  });

  it('behandelt manuelles Wieder-Versiegeln ohne künstliche Mengenbuchung', async () => {
    mockGetFirstAsync.mockResolvedValue({
      ...ITEM,
      opened_at: '2026-09-04T09:00:00.000Z',
      vacuum_sealed: 0,
      expiry_user_set: 0,
    });
    const { result } = await renderHook(() => useUpdateFridgeItemMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: ITEM.id,
        household_id: ITEM.household_id,
        patch: { opened_at: null, expiry_user_set: true },
      });
    });

    expect(lastMutations()).toHaveLength(1);
    expect(lastMutations()[0]).toMatchObject({
      entity: 'fridge_items',
      entityId: 'item-1',
      op: 'update',
      payload: {
        opened_at: null,
        expiry_user_set: true,
      },
    });
    expect(transactionPayloads()).toEqual([]);
  });

  it('bucht das Undo einer Öffnung als neue Actor-signierte Gegenbuchung', async () => {
    mockGetFirstAsync.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...ITEM,
      opened_at: new Date().toISOString(),
      expiry_date: '2026-09-09',
    });
    const transaction: LocalInventoryTransaction = {
      id: 'transaction-1',
      household_id: 'hh-1',
      fridge_item_id: 'item-1',
      product_id: 'product-1',
      actor: 'actor-1',
      type: 'open',
      quantity: 1,
      location_id: 'loc-1',
      reason: null,
      previous_expiry_date: '2026-12-31',
      notes: null,
      undone: false,
      created_at: new Date().toISOString(),
    };
    const { result } = await renderHook(() => useUndoOpenTransactionMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ transaction });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(transactionPayloads()).toEqual([
      expect.objectContaining({
        actor: 'actor-1',
        type: 'open',
        notes: '[Undone] Öffnung rückgängig gemacht',
      }),
    ]);
  });
});
