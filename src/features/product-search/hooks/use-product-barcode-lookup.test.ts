import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';

import { useProductBarcodeLookup } from '@/features/product-search/hooks/use-product-barcode-lookup';
import type { ProductCatalog } from '@/features/product-search/product-catalog';
import type { CatalogProduct } from '@/features/product-search/types';

const hafermilch: CatalogProduct = {
  name: 'Hafermilch',
  barcode: '4008400401027',
  categoryTags: [],
};

function fakeCatalog(
  respond: (
    barcode: string,
    signal?: AbortSignal,
  ) => Promise<CatalogProduct | null> | CatalogProduct | null,
) {
  const calls: string[] = [];
  const catalog: ProductCatalog = {
    async search() {
      return { products: [], hasMore: false, failed: false };
    },
    async findByBarcode(barcode, signal) {
      calls.push(barcode);
      return respond(barcode, signal);
    },
  };
  return { catalog, calls };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('useProductBarcodeLookup', () => {
  it('liefert das gefundene Produkt und meldet es', async () => {
    const onFound = jest.fn();
    const { catalog, calls } = fakeCatalog(() => hafermilch);

    const { result: hook } = await renderHook(() => useProductBarcodeLookup({ catalog, onFound }));
    await act(async () => {
      await hook.current.lookup(' 4008400401027 ');
    });

    expect(calls).toEqual(['4008400401027']);
    expect(hook.current.product).toEqual(hafermilch);
    expect(onFound).toHaveBeenCalledWith(hafermilch);
    expect(hook.current.errorMessage).toBeNull();
  });

  it('erklaert einen unbekannten Barcode verstaendlich statt technisch', async () => {
    const onNotFound = jest.fn();
    const { catalog } = fakeCatalog(() => null);

    const { result: hook } = await renderHook(() =>
      useProductBarcodeLookup({ catalog, onNotFound }),
    );
    await act(async () => {
      await hook.current.lookup('999');
    });

    expect(hook.current.product).toBeNull();
    expect(hook.current.errorMessage).toBe('Kein Produkt für Barcode 999 gefunden.');
    expect(onNotFound).toHaveBeenCalledWith('999');
  });

  it('loest bei mehrfach erkanntem Code nur einen Lookup aus', async () => {
    const { catalog, calls } = fakeCatalog(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return hafermilch;
    });

    const { result: hook } = await renderHook(() => useProductBarcodeLookup({ catalog }));
    await act(async () => {
      const first = hook.current.lookup('4008400401027');
      const second = hook.current.lookup('4008400401027');
      const third = hook.current.lookup('4008400401027');
      await Promise.all([first, second, third]);
    });

    expect(calls).toEqual(['4008400401027']);
  });

  it('laesst waehrend eines laufenden Lookups keinen zweiten Code durch', async () => {
    // Zwei Barcodes im Kamerabild duerfen nicht zwei Navigationen ausloesen.
    const onFound = jest.fn();
    const { catalog, calls } = fakeCatalog(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return hafermilch;
    });

    const { result: hook } = await renderHook(() => useProductBarcodeLookup({ catalog, onFound }));
    await act(async () => {
      await Promise.all([hook.current.lookup('4008400401027'), hook.current.lookup('999')]);
    });

    expect(calls).toEqual(['4008400401027']);
    expect(onFound).toHaveBeenCalledTimes(1);
  });

  it('setzt den Zustand fuer einen neuen Scan zurueck', async () => {
    const { catalog } = fakeCatalog(() => null);

    const { result: hook } = await renderHook(() => useProductBarcodeLookup({ catalog }));
    await act(async () => {
      await hook.current.lookup('999');
    });
    await waitFor(() => expect(hook.current.errorMessage).not.toBeNull());

    act(() => hook.current.reset());

    expect(hook.current.errorMessage).toBeNull();
    expect(hook.current.product).toBeNull();
  });

  it('bricht einen laufenden Lookup beim Reset ab und verwirft dessen Antwort', async () => {
    const pending = deferred<CatalogProduct | null>();
    const onFound = jest.fn();
    let lookupSignal: AbortSignal | undefined;
    const { catalog } = fakeCatalog((_barcode, signal) => {
      lookupSignal = signal;
      return pending.promise;
    });
    const { result: hook } = await renderHook(() => useProductBarcodeLookup({ catalog, onFound }));
    let lookupPromise = Promise.resolve<CatalogProduct | null>(null);

    await act(() => {
      lookupPromise = hook.current.lookup('4008400401027');
    });
    await waitFor(() => expect(hook.current.looking).toBe(true));

    await act(() => hook.current.reset());

    expect(lookupSignal?.aborted).toBe(true);
    expect(hook.current.looking).toBe(false);

    let lookupResult: CatalogProduct | null = hafermilch;
    await act(async () => {
      pending.resolve(hafermilch);
      lookupResult = await lookupPromise;
    });

    expect(lookupResult).toBeNull();
    expect(onFound).not.toHaveBeenCalled();
    expect(hook.current.product).toBeNull();
  });

  it('laesst einen alten Lookup den Guard eines neuen Lookups nicht entfernen', async () => {
    const first = deferred<CatalogProduct | null>();
    const second = deferred<CatalogProduct | null>();
    const { catalog, calls } = fakeCatalog((barcode) => {
      if (barcode === '111') return first.promise;
      return second.promise;
    });
    const { result: hook } = await renderHook(() => useProductBarcodeLookup({ catalog }));
    let firstLookup = Promise.resolve<CatalogProduct | null>(null);
    let secondLookup = Promise.resolve<CatalogProduct | null>(null);

    await act(() => {
      firstLookup = hook.current.lookup('111');
    });
    await act(() => hook.current.reset());
    await act(() => {
      secondLookup = hook.current.lookup('222');
    });

    await act(async () => {
      first.resolve(hafermilch);
      await firstLookup;
    });
    await act(async () => {
      await hook.current.lookup('333');
    });

    expect(calls).toEqual(['111', '222']);

    await act(async () => {
      second.resolve(hafermilch);
      await secondLookup;
    });
  });
});
