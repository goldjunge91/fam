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
    expect(transactionPayloads()).toEqual([
      expect.objectContaining({ actor: 'actor-1', type: 'out', quantity: 1 }),
    ]);
  });

  it('bucht Mengen- und Lagerortkorrektur atomar als eine Outbox-Gruppe', async () => {
    mockGetFirstAsync.mockResolvedValue({ quantity: 3, location_id: 'loc-1' });
    const { result } = await renderHook(() => useUpdateFridgeItemMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        ...ITEM,
        quantity: 4,
        location_id: 'loc-2',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lastMutations()).toHaveLength(4);
    expect(transactionPayloads()).toHaveLength(3);
    expect(transactionPayloads().every((payload) => payload.actor === 'actor-1')).toBe(true);
    expect(transactionPayloads().map((payload) => payload.type)).toEqual(['in', 'out', 'in']);
  });

  it('bucht Öffnen, Wegwerfen und Verschieben jeweils mit Actor', async () => {
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
    expect(transactionPayloads()).toHaveLength(2);
    expect(transactionPayloads().every((payload) => payload.actor === 'actor-1')).toBe(true);
    expect(transactionPayloads().map((payload) => payload.type)).toEqual(['out', 'in']);
  });

  it('bucht das Undo einer Öffnung als neue Actor-signierte Gegenbuchung', async () => {
    mockGetFirstAsync.mockResolvedValue({
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
