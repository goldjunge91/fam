import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { useDevSettingsStore } from '@/constants/dev-settings';
import { aiCreditStatusQueryKey } from '@/features/ai-credits/api';
import type { RecipeSuggestionGatewayRequest } from './recipe-suggestion-gateway';
import { useRecipeSuggestions } from './use-recipe-suggestions';

const mockRequestRecipeSuggestions = jest.fn();
const mockHydrateChefHistory = jest.fn();
const mockDatabase = { kind: 'test-database' };
const mockReportError = jest.fn();

jest.mock('./recipe-suggestion-gateway', () => ({
  requestRecipeSuggestions: (...args: unknown[]) => mockRequestRecipeSuggestions(...args),
}));
jest.mock('@/features/chef-koch/data/chef-history-repository', () => ({
  hydrateChefHistory: (...args: unknown[]) => mockHydrateChefHistory(...args),
}));
jest.mock('@/lib/db/local-client', () => ({ getDatabase: () => Promise.resolve(mockDatabase) }));
jest.mock('@/lib/telemetry', () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

const mockStorageData = new Map<string, string>();

jest.mock('@/lib/storage/local-device-storage', () => ({
  getDeviceStorage: () => ({
    getString: (key: string) => mockStorageData.get(key),
    remove: (key: string) => mockStorageData.delete(key),
    set: (key: string, value: string) => mockStorageData.set(key, value),
  }),
}));

const request: RecipeSuggestionGatewayRequest = {
  householdId: 'household-1',
  userText: 'Was kann ich heute kochen?',
  servings: 2,
  maxMinutes: 30,
  dietaryPattern: 'vegetarian',
  shoppingDecision: null,
  clientRequestId: '22222222-2222-4222-8222-222222222222',
};

describe('useRecipeSuggestions', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  const initialDevMode = __DEV__;

  beforeEach(() => {
    mockStorageData.clear();
    mockRequestRecipeSuggestions.mockReset();
    mockHydrateChefHistory.mockReset();
    mockHydrateChefHistory.mockResolvedValue(undefined);
    mockReportError.mockReset();
    mockRequestRecipeSuggestions.mockResolvedValue({ history: { schema_version: 1 } });
    useDevSettingsStore.getState().setAiGatewayModel(null);
    Object.defineProperty(globalThis, '__DEV__', { configurable: true, value: true });
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
  });

  afterEach(async () => {
    Object.defineProperty(globalThis, '__DEV__', { configurable: true, value: initialDevMode });
    await act(async () => queryClient.clear());
  });

  it('fügt das gespeicherte Modell nur in Development hinzu', async () => {
    useDevSettingsStore.getState().setAiGatewayModel('google/gemma-4-26b-a4b-it:free');
    const { result } = await renderHook(() => useRecipeSuggestions(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(request);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRequestRecipeSuggestions).toHaveBeenCalledWith({
      ...request,
      model: 'google/gemma-4-26b-a4b-it:free',
    });
  });

  it('lässt den Request ohne lokale Auswahl unverändert', async () => {
    const { result } = await renderHook(() => useRecipeSuggestions(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(request);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRequestRecipeSuggestions).toHaveBeenCalledWith(request);
    expect(mockHydrateChefHistory).toHaveBeenCalledWith(mockDatabase, { schema_version: 1 });
  });

  it('keeps the live result successful when local History hydration fails', async () => {
    mockHydrateChefHistory.mockRejectedValueOnce(new Error('sqlite unavailable'));
    const { result } = await renderHook(() => useRecipeSuggestions(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(request);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRequestRecipeSuggestions).toHaveBeenCalledTimes(1);
    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ error_code: 'chef_history_hydration_failed' }),
    );
  });

  it('invalidiert den Haushalts-Credit-Stand nach Erfolg und Erstattung', async () => {
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useRecipeSuggestions(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(request);
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: aiCreditStatusQueryKey(request.householdId),
    });

    invalidateQueries.mockClear();
    mockRequestRecipeSuggestions.mockRejectedValueOnce(new Error('provider failed after booking'));
    await act(async () => {
      await expect(result.current.mutateAsync(request)).rejects.toThrow(
        'provider failed after booking',
      );
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: aiCreditStatusQueryKey(request.householdId),
    });
  });

  it('sendet in Production keinen lokalen Modell-Override', async () => {
    useDevSettingsStore.getState().setAiGatewayModel('google/gemma-4-31b-it:free');
    Object.defineProperty(globalThis, '__DEV__', { configurable: true, value: false });
    const { result } = await renderHook(() => useRecipeSuggestions(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(request);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRequestRecipeSuggestions).toHaveBeenCalledWith(request);
  });
});
