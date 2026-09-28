import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import {
  INITIAL_MODULE_PREFERENCES,
  type ModulePreferences,
  modulePreferencesQueryKey,
  useModulePreferences,
} from '@/features/settings/module-preferences';

const mockMaybeSingle = jest.fn();

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: jest.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mockMaybeSingle }),
      }),
    }),
  })),
}));

function createWrapper(queryClient: QueryClient) {
  return function QueryClientTestProvider({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
    },
  });
}

const remotePreferences = {
  module_fridge: false,
  module_shopping_list: true,
  module_calories: true,
  module_recipes: false,
  module_meal_planner: false,
};

describe('useModulePreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    onlineManager.setOnline(true);
    mockMaybeSingle.mockResolvedValue({ data: remotePreferences, error: null });
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('liefert offline ohne Snapshot sofort die einmalige Startauswahl und ruft Supabase nicht auf', async () => {
    onlineManager.setOnline(false);
    const queryClient = createTestQueryClient();

    const { result, unmount } = await renderHook(() => useModulePreferences('user-1'), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.data).toEqual(INITIAL_MODULE_PREFERENCES);
    expect(result.current.isPlaceholderData).toBe(true);
    expect(mockMaybeSingle).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(modulePreferencesQueryKey('user-1'))).toBeUndefined();
    unmount();
    await queryClient.cancelQueries();
    queryClient.clear();
  });

  it('bevorzugt einen hydratisierten Snapshot gegenueber der Startauswahl', async () => {
    const queryClient = createTestQueryClient();
    const snapshot: ModulePreferences = {
      fridge: false,
      shoppingList: false,
      calories: true,
      recipes: true,
      mealPlanner: false,
    };
    queryClient.setQueryData(modulePreferencesQueryKey('user-1'), snapshot);

    const { result, unmount } = await renderHook(() => useModulePreferences('user-1'), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.data).toEqual(snapshot);
    expect(result.current.isPlaceholderData).toBe(false);
    unmount();
    await queryClient.cancelQueries();
    queryClient.clear();
  });

  it('behaelt einen Snapshot bei fehlgeschlagenem Refresh', async () => {
    const queryClient = createTestQueryClient();
    const snapshot: ModulePreferences = {
      fridge: true,
      shoppingList: false,
      calories: false,
      recipes: true,
      mealPlanner: true,
    };
    queryClient.setQueryData(modulePreferencesQueryKey('user-1'), snapshot);
    mockMaybeSingle.mockResolvedValue({ data: null, error: new Error('offline') });

    const { result, unmount } = await renderHook(() => useModulePreferences('user-1'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toEqual(snapshot);
    unmount();
    await queryClient.cancelQueries();
    queryClient.clear();
  });

  it('uebernimmt erfolgreiche Remote-Werte beim Refresh', async () => {
    const queryClient = createTestQueryClient();
    const snapshot: ModulePreferences = {
      fridge: true,
      shoppingList: false,
      calories: false,
      recipes: true,
      mealPlanner: true,
    };
    queryClient.setQueryData(modulePreferencesQueryKey('user-1'), snapshot);

    const { result, unmount } = await renderHook(() => useModulePreferences('user-1'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() =>
      expect(result.current.data).toEqual({
        fridge: false,
        shoppingList: true,
        calories: true,
        recipes: false,
        mealPlanner: false,
      }),
    );
    expect(result.current.data).toEqual({
      fridge: false,
      shoppingList: true,
      calories: true,
      recipes: false,
      mealPlanner: false,
    });
    unmount();
    await queryClient.cancelQueries();
    queryClient.clear();
  });

  it('liefert fuer einen anonymen Read die Startauswahl ohne Remote-Aufruf', async () => {
    const queryClient = createTestQueryClient();

    const { result, unmount } = await renderHook(() => useModulePreferences(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.data).toEqual(INITIAL_MODULE_PREFERENCES);
    expect(mockMaybeSingle).not.toHaveBeenCalled();
    unmount();
    queryClient.clear();
  });

  it('trennt Snapshots zwischen Accounts', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(modulePreferencesQueryKey('user-1'), {
      ...INITIAL_MODULE_PREFERENCES,
      recipes: true,
    });

    onlineManager.setOnline(false);
    const { result, unmount } = await renderHook(() => useModulePreferences('user-2'), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.data).toEqual(INITIAL_MODULE_PREFERENCES);
    expect(queryClient.getQueryData(modulePreferencesQueryKey('user-2'))).toBeUndefined();
    unmount();
    await queryClient.cancelQueries();
    queryClient.clear();
  });
});
