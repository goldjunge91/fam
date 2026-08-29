import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import { useProductSearch } from '@/features/product-search/hooks/use-product-search';
import type {
  ProductCatalog,
  ProductCatalogSearchOptions,
  ProductCatalogSearchResult,
} from '@/features/product-search/product-catalog';
import type { CatalogProduct } from '@/features/product-search/types';

function product(name: string, barcode = ''): CatalogProduct {
  return { name, barcode, categoryTags: [] };
}

type SearchCall = { query: string; options: ProductCatalogSearchOptions };

/** Fake-Katalog: der Hook kennt nur diese Schnittstelle, keine Quellen. */
function fakeCatalog(
  respond: (call: SearchCall) => Promise<ProductCatalogSearchResult> | ProductCatalogSearchResult,
) {
  const calls: SearchCall[] = [];
  const catalog: ProductCatalog = {
    async search(query, options = {}) {
      const call = { query, options };
      calls.push(call);
      return respond(call);
    },
    async findByBarcode() {
      return null;
    },
  };
  return { catalog, calls };
}

function result(
  products: CatalogProduct[],
  overrides: Partial<ProductCatalogSearchResult> = {},
): ProductCatalogSearchResult {
  return { products, hasMore: false, failed: false, ...overrides };
}

// Kurze Debounces statt Fake-Timer: Letztere geraten mit renderHooks eigenem
// Scheduling durcheinander (siehe use-food-search.test.ts).
const fast = { localDebounceMs: 5, apiDebounceMs: 10 };

describe('useProductSearch', () => {
  it('sucht nach dem Debounce und liefert die Treffer', async () => {
    const { catalog, calls } = fakeCatalog(() => result([product('Hafermilch')]));

    const { result: hook } = await renderHook(() =>
      useProductSearch('Hafermilch', { catalog, ...fast }),
    );

    await waitFor(() => expect(hook.current.results).toHaveLength(1));
    expect(calls[0].query).toBe('Hafermilch');
    await waitFor(() => expect(hook.current.searching).toBe(false));
  });

  it('sucht ohne Online-Ebene zuerst und ergaenzt danach still online', async () => {
    const { catalog, calls } = fakeCatalog(({ options }) =>
      options.allowApi === false
        ? result([product('Hafermilch lokal', '1')])
        : result([product('Hafermilch lokal', '1'), product('Hafermilch online', '2')]),
    );

    const { result: hook } = await renderHook(() =>
      useProductSearch('Hafermilch', { catalog, ...fast }),
    );

    await waitFor(() => expect(hook.current.results).toHaveLength(2));
    await waitFor(() => expect(hook.current.searching).toBe(false));
    expect(calls).toHaveLength(2);
    expect(calls[0].options.allowApi).toBe(false);
    // Die zweite Stufe sperrt die Online-Ebene nicht mehr.
    expect(calls[1].options.allowApi).not.toBe(false);
  });

  it('bleibt zwischen lokaler und Online-Stufe im Suchzustand', async () => {
    const { catalog } = fakeCatalog(async ({ options }) => {
      if (options.allowApi === false) return result([]);
      await new Promise((resolve) => setTimeout(resolve, 40));
      return result([product('Hafermilch online', '1')]);
    });

    const { result: hook } = await renderHook(() =>
      useProductSearch('Hafermilch', { catalog, ...fast }),
    );

    // Ohne das blitzt zwischen den Stufen der Leerzustand auf.
    await waitFor(() => expect(hook.current.searched).toBe(true));
    expect(hook.current.searching).toBe(true);

    await waitFor(() => expect(hook.current.results).toHaveLength(1));
    await waitFor(() => expect(hook.current.searching).toBe(false));
  });

  it('sucht bei zu kurzer Eingabe gar nicht', async () => {
    const { catalog, calls } = fakeCatalog(() => result([product('Hafermilch')]));

    const { result: hook } = await renderHook(() => useProductSearch('H', { catalog, ...fast }));

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(calls).toHaveLength(0);
    expect(hook.current.results).toEqual([]);
  });

  it('verwirft die Antwort einer ueberholten Suche', async () => {
    const { catalog } = fakeCatalog(async ({ query }) => {
      // Die erste Eingabe antwortet bewusst spaeter als die zweite.
      if (query === 'Hafer') {
        await new Promise((resolve) => setTimeout(resolve, 60));
        return result([product('Hafer alt')]);
      }
      return result([product('Haferflocken neu')]);
    });

    const { result: hook, rerender } = await renderHook(
      ({ query }: { query: string }) => useProductSearch(query, { catalog, ...fast }),
      { initialProps: { query: 'Hafer' } },
    );
    await rerender({ query: 'Haferflocken' });

    await waitFor(() => expect(hook.current.results).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(hook.current.results[0].name).toBe('Haferflocken neu');
  });

  it('haengt beim Nachladen an, statt die Liste zuruecksetzen', async () => {
    const { catalog, calls } = fakeCatalog(({ options }) => {
      if (options.cursor === 'seite-2') return result([product('Treffer 3', '3')]);
      return result([product('Treffer 1', '1'), product('Treffer 2', '2')], {
        hasMore: true,
        nextCursor: 'seite-2',
      });
    });

    const { result: hook } = await renderHook(() =>
      useProductSearch('Treffer', { catalog, ...fast }),
    );
    await waitFor(() => expect(hook.current.results).toHaveLength(2));

    await act(async () => {
      await hook.current.loadMore();
    });

    await waitFor(() => expect(hook.current.results).toHaveLength(3));
    expect(hook.current.results.map((p) => p.barcode)).toEqual(['1', '2', '3']);
    expect(calls.at(-1)?.options.cursor).toBe('seite-2');
    expect(hook.current.hasMore).toBe(false);
  });

  it('laedt keine Dubletten nach', async () => {
    const { catalog } = fakeCatalog(({ options }) =>
      options.cursor === 'seite-2'
        ? result([product('Treffer 2', '2'), product('Treffer 3', '3')])
        : result([product('Treffer 1', '1'), product('Treffer 2', '2')], {
            hasMore: true,
            nextCursor: 'seite-2',
          }),
    );

    const { result: hook } = await renderHook(() =>
      useProductSearch('Treffer', { catalog, ...fast }),
    );
    await waitFor(() => expect(hook.current.results).toHaveLength(2));

    await act(async () => {
      await hook.current.loadMore();
    });

    await waitFor(() => expect(hook.current.results).toHaveLength(3));
    expect(hook.current.results.map((p) => p.barcode)).toEqual(['1', '2', '3']);
  });

  it('meldet einen Fehler nur, wenn gar keine Treffer da sind', async () => {
    const { catalog } = fakeCatalog(({ options }) =>
      options.allowApi === false
        ? result([product('Hafermilch lokal', '1')])
        : result([product('Hafermilch lokal', '1')], { failed: true }),
    );

    const { result: hook } = await renderHook(() =>
      useProductSearch('Hafermilch', { catalog, ...fast }),
    );

    await waitFor(() => expect(hook.current.results).toHaveLength(1));
    expect(hook.current.failed).toBe(false);
  });

  it('meldet einen Fehler, wenn die Suche ohne Treffer fehlschlaegt', async () => {
    const { catalog } = fakeCatalog(() => result([], { failed: true }));

    const { result: hook } = await renderHook(() =>
      useProductSearch('Hafermilch', { catalog, ...fast }),
    );

    await waitFor(() => expect(hook.current.failed).toBe(true));
  });

  it('sucht nach einem Fehler auf Wunsch erneut', async () => {
    let shouldFail = true;
    const { catalog } = fakeCatalog(() =>
      shouldFail ? result([], { failed: true }) : result([product('Hafermilch')]),
    );

    const { result: hook } = await renderHook(() =>
      useProductSearch('Hafermilch', { catalog, ...fast }),
    );
    await waitFor(() => expect(hook.current.failed).toBe(true));

    shouldFail = false;
    await act(async () => {
      await hook.current.retry();
    });

    await waitFor(() => expect(hook.current.results).toHaveLength(1));
    expect(hook.current.failed).toBe(false);
  });

  it('leert die Treffer, sobald die Eingabe wieder zu kurz wird', async () => {
    const { catalog } = fakeCatalog(() => result([product('Hafermilch')]));

    const { result: hook, rerender } = await renderHook(
      ({ query }: { query: string }) => useProductSearch(query, { catalog, ...fast }),
      { initialProps: { query: 'Hafermilch' } },
    );
    await waitFor(() => expect(hook.current.results).toHaveLength(1));

    await rerender({ query: '' });

    await waitFor(() => expect(hook.current.results).toEqual([]));
    expect(hook.current.searched).toBe(false);
  });
});
