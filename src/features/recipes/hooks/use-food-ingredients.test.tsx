import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';

import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { getDeviceStorage } from '@/lib/storage/local-device-storage';
import { useFoodIngredients } from './use-food-ingredients';

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: jest.fn(),
}));
jest.mock('@/lib/storage/local-device-storage', () => ({
  getDeviceStorage: jest.fn(),
}));

const mockGetSupabase = jest.mocked(getSupabase);
const mockGetDeviceStorage = jest.mocked(getDeviceStorage);

async function renderIngredients() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return await renderHook(() => useFoodIngredients(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe('useFoodIngredients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceStorage.mockReturnValue({
      getString: jest.fn().mockReturnValue(null),
      set: jest.fn(),
    } as never);
  });

  it('loads valid ingredients, filters malformed rows, and caches them', async () => {
    const set = jest.fn();
    mockGetDeviceStorage.mockReturnValue({
      getString: jest.fn().mockReturnValue(null),
      set,
    } as never);
    mockGetSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              { id: 'a', canonical_name: 'Apfel', revision: 1 },
              { id: 'invalid', canonical_name: 'Fehlt Revision', revision: 0 },
              { id: 'b', canonical_name: 'Banane', revision: 2 },
            ],
            error: null,
          }),
        }),
      }),
    } as never);

    const { result } = await renderIngredients();
    await waitFor(() => expect(result.current.data).toHaveLength(2));

    expect(result.current.data).toEqual([
      { id: 'a', canonical_name: 'Apfel', revision: 1 },
      { id: 'b', canonical_name: 'Banane', revision: 2 },
    ]);
    expect(set).toHaveBeenCalledWith(
      'recipe-ingredient-basis.v1',
      JSON.stringify(result.current.data),
    );
  });

  it('falls back to valid cached ingredients when the request fails', async () => {
    const cached = [{ id: 'cached', canonical_name: 'Cached', revision: 3 }];
    mockGetDeviceStorage.mockReturnValue({
      getString: jest.fn().mockReturnValue(JSON.stringify(cached)),
      set: jest.fn(),
    } as never);
    mockGetSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockRejectedValue(new Error('offline')),
        }),
      }),
    } as never);

    const { result } = await renderIngredients();
    await waitFor(() => expect(result.current.data).toEqual(cached));
  });

  it('does not use malformed cache data and exposes the request error', async () => {
    mockGetDeviceStorage.mockReturnValue({
      getString: jest.fn().mockReturnValue('{invalid json'),
      set: jest.fn(),
    } as never);
    const error = new Error('offline');
    mockGetSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ order: jest.fn().mockRejectedValue(error) }),
      }),
    } as never);

    const { result } = await renderIngredients();
    await waitFor(() => expect(result.current.error).toBe(error));
  });
});
