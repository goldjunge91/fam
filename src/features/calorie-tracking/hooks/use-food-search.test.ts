import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';

import { useFoodSearch } from '@/features/calorie-tracking/hooks/use-food-search';

const mockSearchOpenFoodFacts = jest.fn();
const mockFetchProductByBarcode = jest.fn();
const mockSearchOffDump = jest.fn();
const mockFetchProductByBarcodeFromDump = jest.fn();

jest.mock('@/lib/off-dump/off-dump', () => {
  const actual = jest.requireActual('@/lib/off-dump/off-dump');
  return {
    ...actual,
    searchOffDump: (...args: unknown[]) => mockSearchOffDump(...args),
    fetchProductByBarcodeFromDump: (...args: unknown[]) =>
      mockFetchProductByBarcodeFromDump(...args),
  };
});

jest.mock('@/lib/open-food-facts', () => {
  const actual = jest.requireActual('@/lib/open-food-facts');
  return {
    ...actual,
    searchOpenFoodFacts: (...args: unknown[]) => mockSearchOpenFoodFacts(...args),
    fetchProductByBarcode: (...args: unknown[]) => mockFetchProductByBarcode(...args),
  };
});

beforeEach(() => {
  mockSearchOpenFoodFacts.mockReset();
  mockSearchOpenFoodFacts.mockResolvedValue({ products: [], hasMore: false, failed: false });
  mockFetchProductByBarcode.mockReset();
  mockFetchProductByBarcode.mockResolvedValue(null);
  mockSearchOffDump.mockReset();
  mockSearchOffDump.mockResolvedValue({ products: [], hasMore: false });
  mockFetchProductByBarcodeFromDump.mockReset();
  mockFetchProductByBarcodeFromDump.mockResolvedValue(null);
});

// `rankProductSearchResults` filtert Treffer mit Score 0 heraus — die
// Mock-Produktnamen muessen daher tatsaechlich zur jeweiligen Query passen.
//
// `waitFor` statt Fake-Timer: Letztere geraten mit `renderHook`s eigenem
// Scheduling durcheinander (siehe Kommentar in food-search-screen.test.tsx
// zum selben 800ms-Debounce) — echtes Polling auf das Ergebnis ist robuster.
async function search(query: string, expectResultName: string) {
  const { result } = await renderHook(() => useFoodSearch(undefined));
  act(() => {
    result.current.setQuery(query);
  });
  await waitFor(
    () => {
      expect(result.current.results.some((p) => p.name === expectResultName)).toBe(true);
    },
    { timeout: 3000 },
  );
  return result;
}

describe('useFoodSearch', () => {
  it('laedt beim Nachladen die naechste Seite und haengt die Ergebnisse an', async () => {
    mockSearchOffDump.mockResolvedValueOnce({ products: [], hasMore: true }).mockResolvedValueOnce({
      products: [{ barcode: '2', name: 'Kaffee Pads', caloriesPer100g: 10 }],
      hasMore: false,
    });
    mockSearchOpenFoodFacts
      .mockResolvedValueOnce({
        products: [{ barcode: '1', name: 'Kaffee Bohnen', caloriesPer100g: 5 }],
        hasMore: true,
        failed: false,
      })
      .mockResolvedValueOnce({ products: [], hasMore: false, failed: false });

    const result = await search('kaffee', 'Kaffee Bohnen');
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMoreResults();
    });

    expect(result.current.results.map((p) => p.name).sort()).toEqual([
      'Kaffee Bohnen',
      'Kaffee Pads',
    ]);
    expect(result.current.hasMore).toBe(false);
    expect(mockSearchOpenFoodFacts).toHaveBeenLastCalledWith(
      'kaffee',
      expect.objectContaining({ page: 2, pageSize: 20 }),
    );
  });

  it('ignoriert eine veraltete "naechste Seite"-Antwort, wenn die Suchanfrage sich zwischenzeitlich geaendert hat', async () => {
    let resolveSecondPage: (value: { products: never[]; hasMore: boolean }) => void = () => {};
    mockSearchOffDump.mockResolvedValueOnce({ products: [], hasMore: true }).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSecondPage = resolve;
      }),
    );
    mockSearchOpenFoodFacts.mockResolvedValueOnce({
      products: [{ barcode: '1', name: 'Kaffee Bohnen', caloriesPer100g: 5 }],
      hasMore: true,
      failed: false,
    });

    const result = await search('kaffee', 'Kaffee Bohnen');
    expect(result.current.hasMore).toBe(true);

    let loadMorePromise!: Promise<void>;
    act(() => {
      loadMorePromise = result.current.loadMoreResults();
    });

    // Waehrend "naechste Seite" noch laedt, tippt der Nutzer eine neue Suche.
    mockSearchOpenFoodFacts.mockResolvedValueOnce({
      products: [{ barcode: '9', name: 'Tee Beutel', caloriesPer100g: 1 }],
      hasMore: false,
      failed: false,
    });
    mockSearchOffDump.mockResolvedValueOnce({ products: [], hasMore: false });
    act(() => {
      result.current.setQuery('tee');
    });
    await waitFor(
      () => {
        expect(result.current.results.map((p) => p.name)).toEqual(['Tee Beutel']);
      },
      { timeout: 3000 },
    );

    resolveSecondPage({ products: [], hasMore: false });
    await act(async () => {
      await loadMorePromise;
    });

    // Die veraltete "naechste Seite"-Antwort der alten Suchanfrage darf die
    // Ergebnisse der neuen Suche nicht ueberschreiben.
    expect(result.current.results.map((p) => p.name)).toEqual(['Tee Beutel']);
  });
});
