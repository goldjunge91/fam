import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { useBrochurePages, useBrochures } from './use-brochures';

const mockDatabase = {
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
};

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: async () => mockDatabase,
}));

jest.mock('@/lib/observability/debug-log', () => ({ debugLog: jest.fn() }));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('brochure queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps cached stores and brochures and derives favorites', async () => {
    mockDatabase.getFirstAsync.mockResolvedValue({ zip_code: '10115' });
    mockDatabase.getAllAsync
      .mockResolvedValueOnce([
        { id: 'rewe', name: 'REWE', logoUrl: null, active: 1, isFavorite: 1 },
        { id: 'aldi', name: 'Aldi', logoUrl: 'aldi.png', active: 0, isFavorite: 0 },
      ])
      .mockResolvedValueOnce([
        {
          id: 'brochure-1',
          store_id: 'rewe',
          title: 'Wochenangebote',
          valid_from: '2026-10-10',
          valid_until: '2026-10-16',
          cover_image: 'cover.jpg',
        },
      ]);

    const { result } = await renderHook(() => useBrochures(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      cacheZip: '10115',
      stores: [
        { id: 'rewe', name: 'REWE', logoUrl: null, active: true, isFavorite: true },
        { id: 'aldi', name: 'Aldi', logoUrl: 'aldi.png', active: false, isFavorite: false },
      ],
      brochures: [
        {
          id: 'brochure-1',
          storeId: 'rewe',
          title: 'Wochenangebote',
          validFrom: '2026-10-10',
          validUntil: '2026-10-16',
          coverImage: 'cover.jpg',
        },
      ],
      favorites: [{ id: 'rewe', name: 'REWE', logoUrl: null, active: true, isFavorite: true }],
    });
  });

  it('uses a null cache zip when no cache row exists', async () => {
    mockDatabase.getFirstAsync.mockResolvedValue(null);
    mockDatabase.getAllAsync.mockResolvedValue([]);

    const { result } = await renderHook(() => useBrochures(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      cacheZip: null,
      stores: [],
      brochures: [],
      favorites: [],
    });
  });

  it('returns an empty page list without querying when the brochure id is empty', async () => {
    const { result } = await renderHook(() => useBrochurePages(''), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(mockDatabase.getAllAsync).not.toHaveBeenCalled();
  });

  it('returns an empty loaded page list and records its empty summary', async () => {
    mockDatabase.getAllAsync.mockResolvedValue([]);

    const { result } = await renderHook(() => useBrochurePages('brochure-empty'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('maps pages, parses hotspots and records a summary for the loaded pages', async () => {
    mockDatabase.getAllAsync.mockResolvedValue([
      {
        id: 'page-1',
        brochure_id: 'brochure-1',
        store_name: 'REWE',
        page_number: 1,
        image_url: 'page-1.jpg',
        hotspots_json: '[]',
      },
      {
        id: 'page-2',
        brochure_id: 'brochure-1',
        store_name: 'REWE',
        page_number: 2,
        image_url: 'page-2.jpg',
        hotspots_json: '[{"id":"hotspot-1"}]',
      },
    ]);

    const { result } = await renderHook(() => useBrochurePages('brochure-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      {
        id: 'page-1',
        brochureId: 'brochure-1',
        storeName: 'REWE',
        pageNumber: 1,
        imageUrl: 'page-1.jpg',
        hotspots: [],
      },
      {
        id: 'page-2',
        brochureId: 'brochure-1',
        storeName: 'REWE',
        pageNumber: 2,
        imageUrl: 'page-2.jpg',
        hotspots: [{ id: 'hotspot-1' }],
      },
    ]);
    expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE p.brochure_id = ?'),
      ['brochure-1'],
    );
  });
});
