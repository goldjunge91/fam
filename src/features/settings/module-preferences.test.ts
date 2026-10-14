import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import {
  INITIAL_MODULE_PREFERENCES,
  type ModulePreferences,
  modulePreferencesQueryKey,
  saveModulePreferences,
  useModulePreferences,
  useUpdateModulePreferencesMutation,
} from '@/features/settings/module-preferences';

const mockMaybeSingle = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateEq = jest.fn();
let mockUpdateError: { message: string } | null = null;

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: jest.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mockMaybeSingle }),
      }),
      update: (values: unknown) => {
        mockUpdate(values);
        return {
          eq: (column: string, userId: string) => {
            mockUpdateEq(column, userId);
            return { error: mockUpdateError };
          },
        };
      },
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
      mutations: { gcTime: Infinity, retry: false },
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
    mockUpdateError = null;
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
    await unmount();
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
    await unmount();
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
    await unmount();
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
    await unmount();
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
    await unmount();
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
    await unmount();
    await queryClient.cancelQueries();
    queryClient.clear();
  });

  it('verwendet Startwerte fuer ein fehlendes Profil und null gespeicherte Werte', async () => {
    const queryClient = createTestQueryClient();
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const missingProfile = await renderHook(() => useModulePreferences('user-1'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(missingProfile.result.current.isFetching).toBe(false));
    expect(missingProfile.result.current.data).toEqual(INITIAL_MODULE_PREFERENCES);
    await missingProfile.unmount();

    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        module_fridge: null,
        module_shopping_list: null,
        module_calories: null,
        module_recipes: null,
        module_meal_planner: null,
      },
      error: null,
    });
    const nullValues = await renderHook(() => useModulePreferences('user-2'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(nullValues.result.current.isFetching).toBe(false));
    expect(nullValues.result.current.data).toEqual({
      fridge: true,
      shoppingList: true,
      calories: true,
      recipes: true,
      mealPlanner: true,
    });
    await nullValues.unmount();
    await queryClient.cancelQueries();
    queryClient.clear();
  });
});

describe('useUpdateModulePreferencesMutation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateError = null;
  });

  it('optimistically saves each supplied module and invalidates that account', async () => {
    const queryClient = createTestQueryClient();
    const queryKey = modulePreferencesQueryKey('user-1');
    const previous: ModulePreferences = {
      fridge: true,
      shoppingList: false,
      calories: false,
      recipes: true,
      mealPlanner: true,
    };
    const updated: ModulePreferences = {
      fridge: false,
      shoppingList: true,
      calories: true,
      recipes: false,
      mealPlanner: false,
    };
    queryClient.setQueryData(queryKey, previous);
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result, unmount } = await renderHook(() => useUpdateModulePreferencesMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ userId: 'user-1', modules: updated });
    });

    expect(queryClient.getQueryData(queryKey)).toEqual(updated);
    expect(mockUpdate).toHaveBeenCalledWith({
      module_fridge: false,
      module_shopping_list: true,
      module_calories: true,
      module_recipes: false,
      module_meal_planner: false,
    });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-1');
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey });
    await unmount();
    queryClient.clear();
  });

  it('uses initial values without a prior snapshot and rolls back a failed write', async () => {
    const queryClient = createTestQueryClient();
    const queryKey = modulePreferencesQueryKey('user-2');
    const { result, unmount } = await renderHook(() => useUpdateModulePreferencesMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ userId: 'user-2', modules: {} });
    });
    expect(queryClient.getQueryData(queryKey)).toEqual(INITIAL_MODULE_PREFERENCES);
    expect(mockUpdate).toHaveBeenCalledWith({});

    const previous = { ...INITIAL_MODULE_PREFERENCES, recipes: true };
    queryClient.setQueryData(queryKey, previous);
    mockUpdateError = { message: 'write failed' };

    await act(async () => {
      await expect(
        result.current.mutateAsync({ userId: 'user-2', modules: { recipes: false } }),
      ).rejects.toThrow('write failed');
    });

    expect(queryClient.getQueryData(queryKey)).toEqual(previous);
    await unmount();
    queryClient.clear();
  });
});

describe('saveModulePreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateError = null;
  });

  it('writes the complete preference set and returns the Supabase error', async () => {
    const modules: ModulePreferences = {
      fridge: true,
      shoppingList: false,
      calories: true,
      recipes: false,
      mealPlanner: true,
    };

    await expect(saveModulePreferences('user-3', modules)).resolves.toEqual({ error: null });
    expect(mockUpdate).toHaveBeenCalledWith({
      module_fridge: true,
      module_shopping_list: false,
      module_calories: true,
      module_recipes: false,
      module_meal_planner: true,
    });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-3');

    mockUpdateError = { message: 'save rejected' };
    await expect(saveModulePreferences('user-3', modules)).resolves.toEqual({
      error: mockUpdateError,
    });
  });
});
