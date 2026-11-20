import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import type { RecipeSuggestionGatewayRequest } from './recipe-suggestion-gateway';
import { useRecipeSuggestions } from './use-recipe-suggestions';

const mockRequestRecipeSuggestions = jest.fn();

jest.mock('./recipe-suggestion-gateway', () => ({
  requestRecipeSuggestions: (...args: unknown[]) => mockRequestRecipeSuggestions(...args),
}));

const request: RecipeSuggestionGatewayRequest = {
  householdId: 'household-1',
  userText: 'Was kann ich heute kochen?',
  servings: 2,
  maxMinutes: null,
  dietaryPattern: null,
  allergies: [],
  shoppingDecision: 'no',
  selectedInventoryItemIds: ['lot-tomato'],
};

function response() {
  return {
    requestId: 'request-1',
    provider: 'catalog',
    model: 'catalog',
    generatedAt: '2026-11-06T08:00:00.000Z',
    result: { schema_version: 1 as const, meals: [] },
  };
}

describe('useRecipeSuggestions', () => {
  let queryClient: QueryClient;

  function QueryProvider({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
    mockRequestRecipeSuggestions.mockReset();
    mockRequestRecipeSuggestions.mockResolvedValue(response());
  });

  afterEach(() => queryClient.clear());

  it('exposes the validated read-only Gateway mutation', async () => {
    const { result } = await renderHook(() => useRecipeSuggestions(), {
      wrapper: QueryProvider,
    });

    await act(async () => {
      await result.current.mutateAsync(request);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRequestRecipeSuggestions).toHaveBeenCalledWith(request);
    expect(result.current.data).toEqual(response());
    expect(result.current.isSuccess).toBe(true);
  });
});
