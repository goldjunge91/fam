import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { createElement } from 'react';
import {
  filterTransactionsForProduct,
  getInventoryTransactionLabel,
  groupInventoryTransactions,
  type LocalInventoryTransaction,
  useInventoryTransactions,
} from '@/features/inventory/use-inventory-transactions';
import { getDatabase } from '@/lib/db/client';

jest.mock('@/lib/db/client', () => ({
  getDatabase: jest.fn(),
}));

const mockedGetDatabase = jest.mocked(getDatabase);

const TRANSACTION_FIELDS: LocalInventoryTransaction = {
  id: 'tx-1',
  operation_id: 'op-1',
  reversal_of: null,
  household_id: 'household-1',
  fridge_item_id: 'lot-1',
  product_id: 'product-1',
  actor: 'actor-1',
  type: 'out',
  quantity: 0.5,
  unit: 'piece',
  location_id: 'location-1',
  reason: null,
  notes: '[Split] this is display-only text',
  created_at: '2026-09-09T10:00:00.000Z',
  has_reversal: false,
  operation_leg_count: 1,
  item_name: 'Milch',
  item_unit: 'piece',
  location_name: 'Kühlschrank',
};

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(
    QueryClientProvider,
    {
      client: new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
      }),
    },
    children,
  );
}

describe('use-inventory-transactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads the household ledger once and exposes the v1 transaction fields', async () => {
    const expectedTransaction = {
      ...TRANSACTION_FIELDS,
      has_reversal: true,
      operation_leg_count: 1,
    };
    const getAllAsync = jest
      .fn()
      .mockResolvedValue([{ ...TRANSACTION_FIELDS, has_reversal: 1, operation_leg_count: 1 }]);
    mockedGetDatabase.mockResolvedValue({ getAllAsync } as never);

    const { result } = await renderHook(() => useInventoryTransactions('household-1'), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([expectedTransaction]));

    expect(getAllAsync).toHaveBeenCalledTimes(1);
    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining('t.household_id = ?'), [
      'household-1',
    ]);
    const query = getAllAsync.mock.calls[0]?.[0] as string;
    expect(query).toContain('t.operation_id');
    expect(query).toContain('t.reversal_of');
    expect(query).toContain('t.reason');
    expect(query).toContain('exists');
    expect(query).toContain('operation_leg_count');
    expect(query).not.toContain('undone');
    expect(query).not.toContain('previous_expiry_date');
  });

  it('does not query SQLite without a household', async () => {
    const getAllAsync = jest.fn();
    mockedGetDatabase.mockResolvedValue({ getAllAsync } as never);

    const { result } = await renderHook(() => useInventoryTransactions(undefined), { wrapper });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(result.current.data).toBeUndefined();
    expect(getAllAsync).not.toHaveBeenCalled();
  });

  it('filters by product or one of the product lots without decoding notes', () => {
    const other = {
      ...TRANSACTION_FIELDS,
      id: 'tx-2',
      fridge_item_id: 'lot-2',
      product_id: 'product-2',
    };

    expect(filterTransactionsForProduct([TRANSACTION_FIELDS, other], 'product-1')).toEqual([
      TRANSACTION_FIELDS,
    ]);
    expect(
      filterTransactionsForProduct([TRANSACTION_FIELDS, other], null, new Set(['lot-2'])),
    ).toEqual([other]);
    expect(
      filterTransactionsForProduct([TRANSACTION_FIELDS, other], null, new Set(['lot-1'])),
    ).toEqual([TRANSACTION_FIELDS]);
  });

  it('groups transactions by UTC day in deterministic newest-first order', () => {
    const sameDayOlder = {
      ...TRANSACTION_FIELDS,
      id: 'tx-0',
      created_at: '2026-09-09T09:00:00.000Z',
    };
    const nextDay = {
      ...TRANSACTION_FIELDS,
      id: 'tx-2',
      created_at: '2026-09-10T09:00:00.000Z',
    };

    expect(groupInventoryTransactions([sameDayOlder, nextDay, TRANSACTION_FIELDS])).toEqual([
      {
        key: '2026-09-10',
        label: '10.09.2026',
        transactions: [nextDay],
      },
      {
        key: '2026-09-09',
        label: '09.09.2026',
        transactions: [TRANSACTION_FIELDS, sameDayOlder],
      },
    ]);
  });

  it('uses only typed v1 fields for presentation labels', () => {
    expect(getInventoryTransactionLabel(TRANSACTION_FIELDS)).toBe('Verbrauch');
    expect(getInventoryTransactionLabel({ ...TRANSACTION_FIELDS, type: 'waste' })).toBe(
      'Verschwendung',
    );
    const noteBearingIn = {
      ...TRANSACTION_FIELDS,
      type: 'in' as const,
      notes: '[Split] should not change the label',
    };
    expect(getInventoryTransactionLabel(noteBearingIn)).toBe('Einkauf');
    expect(
      getInventoryTransactionLabel({ ...TRANSACTION_FIELDS, type: 'in', reversal_of: 'tx-0' }),
    ).toBe('Rückbuchung');
    expect(
      getInventoryTransactionLabel({
        ...TRANSACTION_FIELDS,
        type: 'in',
        operation_leg_count: 2,
      }),
    ).toBe('Verschiebung');
  });
});
