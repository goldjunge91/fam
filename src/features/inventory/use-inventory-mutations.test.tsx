import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import * as Crypto from 'expo-crypto';
import { createElement, type ReactNode } from 'react';

import * as Commit from '@/lib/sync/inventory-quantity';

import {
  useAddFridgeItemMutation,
  useConsumeInventoryItemMutation,
  useMoveInventoryItemMutation,
  useUpdateInventoryItemQuantityMutation,
  useWasteInventoryItemMutation,
} from './use-inventory-mutations';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const HOUSEHOLD_ID = '22222222-2222-4222-8222-222222222222';
const ITEM_ID = '33333333-3333-4333-8333-333333333333';
const LOCATION_ID = '44444444-4444-4444-8444-444444444444';
const TARGET_LOCATION_ID = '55555555-5555-4555-8555-555555555555';
const PRODUCT_ID = '66666666-6666-4666-8666-666666666666';
const OPERATION_ID = '77777777-7777-4777-8777-777777777777';
const LEDGER_ID = '88888888-8888-4888-8888-888888888888';
const OPENED_ITEM_ID = '99999999-9999-4999-8999-999999999999';

const getFirstAsync = jest.fn();

jest.mock('@/features/auth/session-provider', () => ({
  useSession: jest.fn(() => ({ session: { user: { id: ACTOR_ID } } })),
}));
jest.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: jest.fn() }));
jest.mock('@/lib/db/client', () => ({ getDatabase: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('@/lib/sync/inventory-quantity', () => ({
  commitInventoryOperation: jest.fn(),
}));

const { getDatabase } = jest.requireMock('@/lib/db/client') as {
  getDatabase: jest.MockedFunction<() => Promise<{ getFirstAsync: typeof getFirstAsync }>>;
};

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    {
      client: new QueryClient({
        defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
      }),
    },
    children,
  );
}

const ITEM = {
  id: ITEM_ID,
  household_id: HOUSEHOLD_ID,
  location_id: LOCATION_ID,
  product_id: PRODUCT_ID,
  name: 'Milch',
  quantity: 1000,
  unit: 'g',
  package_size: 500,
  package_size_unit: 'g',
  expiry_date: '2027-01-15',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(Crypto.randomUUID).mockReturnValue(OPERATION_ID);
  getDatabase.mockResolvedValue({ getFirstAsync });
  getFirstAsync.mockResolvedValue({
    quantity: 1000,
    product_id: PRODUCT_ID,
    unit: 'g',
    location_id: LOCATION_ID,
    name: 'Milch',
    package_size: 500,
    package_size_unit: 'g',
    expiry_date: '2027-01-15',
    opened_at: null,
    vacuum_sealed: false,
    expiry_user_set: false,
    added_by: ACTOR_ID,
    location_kind: 'fridge',
  });
  jest.mocked(Commit.commitInventoryOperation).mockResolvedValue({
    kind: 'applied',
    operation_id: OPERATION_ID,
    footprint: {
      lots: { read: [], created: [], updated: [], restored: [], tombstoned: [] },
      ledger: { read: [], created: [], reversed: [] },
    },
    outbox_count: 1,
  });
});

it('delegates insert construction to the lifecycle owner', async () => {
  jest
    .mocked(Crypto.randomUUID)
    .mockReturnValueOnce(OPERATION_ID)
    .mockReturnValueOnce(ITEM_ID)
    .mockReturnValueOnce(LEDGER_ID);
  const { result } = await renderHook(() => useAddFridgeItemMutation(), { wrapper });

  await result.current.mutateAsync({
    ...ITEM,
    quantity: 0.5,
    package_size: 0.5,
    package_size_unit: 'Stück',
    unit: 'Stück',
    expiry_date: null,
  });

  expect(Commit.commitInventoryOperation).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      type: 'insert_inventory',
      operation_id: OPERATION_ID,
      item_id: ITEM_ID,
      in_transaction_id: LEDGER_ID,
      quantity: 0.5,
      unit: 'piece',
      package_size_unit: 'piece',
    }),
    ACTOR_ID,
  );
});

it('passes a sealed partial consume intent with typed recipe fields', async () => {
  jest
    .mocked(Crypto.randomUUID)
    .mockReturnValueOnce(OPERATION_ID)
    .mockReturnValueOnce(LEDGER_ID)
    .mockReturnValueOnce(OPENED_ITEM_ID);
  const { result } = await renderHook(() => useConsumeInventoryItemMutation(), { wrapper });

  await result.current.mutateAsync({
    item: ITEM,
    quantity: 200,
    recipe_id: PRODUCT_ID,
    recipe_name: 'Porridge',
  });

  expect(Commit.commitInventoryOperation).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      type: 'consume_inventory',
      mode: 'sealed_partial',
      source_item_id: ITEM_ID,
      opened_item_id: OPENED_ITEM_ID,
      consumed_quantity: 200,
      portion_quantity: 500,
      remainder_quantity: 300,
      recipe_id: PRODUCT_ID,
      recipe_name: 'Porridge',
    }),
    ACTOR_ID,
  );
});

it('delegates correction, waste, and move as the remaining phase-1 intents', async () => {
  jest
    .mocked(Crypto.randomUUID)
    .mockReturnValueOnce(OPERATION_ID)
    .mockReturnValueOnce(LEDGER_ID)
    .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    .mockReturnValueOnce('cccccccc-cccc-4ccc-8ccc-cccccccccccc')
    .mockReturnValueOnce('dddddddd-dddd-4ddd-8ddd-dddddddddddd')
    .mockReturnValueOnce('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  const { result: correction } = await renderHook(() => useUpdateInventoryItemQuantityMutation(), {
    wrapper,
  });
  await correction.current.mutateAsync({ id: ITEM_ID, household_id: HOUSEHOLD_ID, delta: -200 });

  const { result: waste } = await renderHook(() => useWasteInventoryItemMutation(), { wrapper });
  await waste.current.mutateAsync({ item: ITEM, reason: 'spoiled' });

  const { result: move } = await renderHook(() => useMoveInventoryItemMutation(), { wrapper });
  await move.current.mutateAsync({ item: ITEM, locationId: TARGET_LOCATION_ID });

  expect(
    jest.mocked(Commit.commitInventoryOperation).mock.calls.map(([, operation]) => operation.type),
  ).toEqual(['correct_quantity', 'waste_inventory', 'move_inventory']);
});
