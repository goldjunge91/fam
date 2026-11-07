import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import {
  chefConversationQueryKey,
  rememberChefConversationContinuationRejection,
  useChefConversation,
  useChefConversations,
  useChefRecipeHistoryList,
} from './use-chef-history';

const mockDatabase = { kind: 'test-database' };
const mockListConversations = jest.fn();
const mockListRecipes = jest.fn();
const mockGetConversation = jest.fn();
const mockGetEncryptedAccountStorage = jest.fn();
const storageValues = new Map<string, string>();
const mockAccountStorage = {
  getString: jest.fn((key: string) => storageValues.get(key)),
  set: jest.fn((key: string, value: string) => {
    storageValues.set(key, value);
  }),
};

jest.mock('@/lib/db/local-client', () => ({ getDatabase: () => Promise.resolve(mockDatabase) }));
jest.mock('@/lib/storage/local-account-storage', () => ({
  getEncryptedAccountStorage: (...args: unknown[]) => mockGetEncryptedAccountStorage(...args),
}));
jest.mock('@/features/chef-koch/data/chef-history-repository', () => ({
  listChefConversations: (...args: unknown[]) => mockListConversations(...args),
  listChefRecipeHistory: (...args: unknown[]) => mockListRecipes(...args),
  getChefConversation: (...args: unknown[]) => mockGetConversation(...args),
  listChefConversationTurns: jest.fn(),
  getChefRecipeHistory: jest.fn(),
}));

describe('use-chef-history', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    storageValues.clear();
    mockGetEncryptedAccountStorage.mockResolvedValue(mockAccountStorage);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
    mockListConversations.mockResolvedValue({ items: [], nextCursor: null });
    mockListRecipes.mockResolvedValue({ items: [], nextCursor: null });
    mockGetConversation.mockResolvedValue(null);
  });

  afterEach(() => queryClient.clear());

  it('does not open the local database without an active household', async () => {
    const { result } = await renderHook(() => useChefConversations(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockListConversations).not.toHaveBeenCalled();
  });

  it('keeps conversation and recipe pagination on independent query keys', async () => {
    mockListConversations.mockResolvedValueOnce({
      items: [{ id: 'conversation-1' }],
      nextCursor: { timestamp: '2026-11-07T08:00:00.000Z', id: 'conversation-1' },
    });
    const conversations = await renderHook(() => useChefConversations('household-1'), { wrapper });
    const recipes = await renderHook(() => useChefRecipeHistoryList('household-1'), { wrapper });

    await waitFor(() => expect(conversations.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(recipes.result.current.isSuccess).toBe(true));

    expect(mockListConversations).toHaveBeenCalledWith(mockDatabase, 'household-1', null);
    expect(mockListRecipes).toHaveBeenCalledWith(mockDatabase, 'household-1', null);
    expect(queryClient.getQueryCache().findAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          queryKey: ['chef-history', 'household-1', 'conversations'],
        }),
        expect.objectContaining({ queryKey: ['chef-history', 'household-1', 'recipes'] }),
      ]),
    );
  });

  it('keeps account-specific detail cache entries isolated', async () => {
    const conversation = {
      id: 'conversation-1',
      household_id: 'household-1',
    };
    mockGetConversation.mockResolvedValue(conversation);

    const first = await renderHook(
      () => useChefConversation('household-1', 'conversation-1', 'user-1'),
      { wrapper },
    );
    const second = await renderHook(
      () => useChefConversation('household-1', 'conversation-1', 'user-2'),
      { wrapper },
    );
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

    const firstKey = chefConversationQueryKey('household-1', 'conversation-1', 'user-1');
    const secondKey = chefConversationQueryKey('household-1', 'conversation-1', 'user-2');
    queryClient.setQueryData(firstKey, { ...conversation, continuationRejected: true });

    expect(queryClient.getQueryData(firstKey)).toEqual({
      ...conversation,
      continuationRejected: true,
    });
    expect(queryClient.getQueryData(secondKey)).toEqual(conversation);
    await first.unmount();
    await second.unmount();
  });

  it('reapplies a persisted rejection after reopening the detail query', async () => {
    const conversation = {
      id: 'conversation-1',
      household_id: 'household-1',
    };
    mockGetConversation.mockResolvedValue(conversation);

    const first = await renderHook(
      () => useChefConversation('household-1', 'conversation-1', 'user-1'),
      { wrapper },
    );
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    expect(first.result.current.data).toEqual(conversation);

    await rememberChefConversationContinuationRejection('user-1', 'household-1', 'conversation-1');
    await first.unmount();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
    const reopened = await renderHook(
      () => useChefConversation('household-1', 'conversation-1', 'user-1'),
      { wrapper },
    );
    await waitFor(() =>
      expect(reopened.result.current.data).toEqual({
        ...conversation,
        continuationRejected: true,
      }),
    );

    expect(mockGetEncryptedAccountStorage).toHaveBeenCalledWith('user-1');
    await reopened.unmount();
  });
});
