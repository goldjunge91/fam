import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { useInventoryConflicts } from '@/features/inventory/use-inventory-conflicts';

const mockGetDatabase = jest.fn();
const mockOnOutboxChanged = jest.fn();
const mockGetFridgeItemConflicts = jest.fn();
const mockUnsubscribe = jest.fn();
let outboxListener: (() => void) | undefined;

jest.mock('@/lib/db/local-client', () => ({ getDatabase: () => mockGetDatabase() }));
jest.mock('@/lib/db/outbox', () => ({
  onOutboxChanged: (listener: () => void) => mockOnOutboxChanged(listener),
}));
jest.mock('@/lib/db/outbox-conflicts', () => ({
  getFridgeItemConflicts: (database: unknown) => mockGetFridgeItemConflicts(database),
}));

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  outboxListener = undefined;
  mockGetDatabase.mockReset().mockResolvedValue({});
  mockOnOutboxChanged.mockReset().mockImplementation((listener: () => void) => {
    outboxListener = listener;
    return mockUnsubscribe;
  });
  mockUnsubscribe.mockReset();
  mockGetFridgeItemConflicts
    .mockReset()
    .mockResolvedValue([
      { itemId: 'item-1', sourceIds: [12, 13], lastError: 'out of sync', correction: null },
    ]);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
});

afterEach(() => queryClient.clear());

test('indexes local conflicts by item and invalidates them when the outbox changes', async () => {
  const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
  const { result, unmount } = await renderHook(() => useInventoryConflicts(), { wrapper });

  await waitFor(() => expect(result.current.get('item-1')?.sourceIds).toEqual([12, 13]));
  expect(result.current.get('item-1')).toMatchObject({
    lastError: 'out of sync',
    correction: null,
  });
  expect(mockGetFridgeItemConflicts).toHaveBeenCalledWith(expect.anything());

  await act(async () => outboxListener?.());
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['inventory-conflicts'] });

  await act(async () => unmount());
  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
});

test('returns an empty map before local conflicts are available', async () => {
  mockGetFridgeItemConflicts.mockResolvedValue([]);
  const { result } = await renderHook(() => useInventoryConflicts(), { wrapper });

  await waitFor(() => expect(mockGetFridgeItemConflicts).toHaveBeenCalled());
  expect(result.current.size).toBe(0);
});
