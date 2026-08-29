import { onlineManager } from '@tanstack/react-query';

import { createProductCatalog } from '@/features/product-search/product-catalog';
import type {
  CatalogProduct,
  CatalogSource,
  ProductSearchResult,
} from '@/features/product-search/types';

function product(overrides: Partial<CatalogProduct> & { name: string }): CatalogProduct {
  return { barcode: '', categoryTags: [], ...overrides };
}

/**
 * Fake-Quelle mit vorgegebenen Seiten. `pages[i]` ist die Antwort auf den
 * i-ten `search`-Aufruf mit einem neuen Offset — der Katalog kennt nur die
 * Schnittstelle, nicht das Backend.
 */
function fakeSource(
  config: { pages?: ProductSearchResult[]; byBarcode?: Record<string, CatalogProduct> } = {},
): CatalogSource & {
  searchCalls: { query: string; offset: number; limit: number }[];
  barcodeCalls: string[];
} {
  const searchCalls: { query: string; offset: number; limit: number }[] = [];
  const barcodeCalls: string[] = [];
  const pages = config.pages ?? [];

  return {
    searchCalls,
    barcodeCalls,
    async search(query, options) {
      searchCalls.push({ query, offset: options.offset, limit: options.limit });
      // Seiten werden ueber die Aufrufreihenfolge zugeordnet: Seite 0 ist die
      // erste Abfrage dieser Quelle, Seite 1 die naechste.
      return pages[searchCalls.length - 1] ?? { products: [], hasMore: false, failed: false };
    },
    async findByBarcode(barcode) {
      barcodeCalls.push(barcode);
      return config.byBarcode?.[barcode] ?? null;
    },
  };
}

function page(
  products: CatalogProduct[],
  overrides: Partial<ProductSearchResult> = {},
): ProductSearchResult {
  return { products, hasMore: false, failed: false, ...overrides };
}

const milk = (suffix: string, barcode = '') =>
  product({ name: `Milch ${suffix}`, barcode, brand: 'Marke' });

let onlineSpy: jest.SpyInstance;

beforeEach(() => {
  onlineSpy = jest.spyOn(onlineManager, 'isOnline').mockReturnValue(true);
});

afterEach(() => {
  onlineSpy.mockRestore();
});

describe('createProductCatalog.search', () => {
  it('fragt die API nicht an, wenn der eigene Katalog genug Treffer liefert', async () => {
    const api = fakeSource();
    const dump = fakeSource();
    const catalog = createProductCatalog({
      local: fakeSource({
        pages: [page([milk('a'), milk('b'), milk('c'), milk('d'), milk('e')], { hasMore: true })],
      }),
      dump,
      api,
    });

    const result = await catalog.search('Milch');

    expect(result.products).toHaveLength(5);
    expect(dump.searchCalls).toHaveLength(0);
    expect(api.searchCalls).toHaveLength(0);
  });

  it('nutzt den Dump, wenn der eigene Katalog leer ist, und laesst die API aus', async () => {
    const api = fakeSource();
    const catalog = createProductCatalog({
      local: fakeSource(),
      dump: fakeSource({
        pages: [page([milk('a'), milk('b'), milk('c'), milk('d'), milk('e')])],
      }),
      api,
    });

    const result = await catalog.search('Milch');

    expect(result.products).toHaveLength(5);
    expect(api.searchCalls).toHaveLength(0);
  });

  it('faellt online auf die API zurueck, wenn lokal zu wenig gefunden wurde', async () => {
    const api = fakeSource({ pages: [page([milk('online', '111')])] });
    const catalog = createProductCatalog({
      local: fakeSource(),
      dump: fakeSource({ pages: [page([milk('dump', '222')])] }),
      api,
    });

    const result = await catalog.search('Milch');

    expect(api.searchCalls).toHaveLength(1);
    expect(result.products.map((p) => p.barcode).sort()).toEqual(['111', '222']);
  });

  it('fragt offline keine API an und meldet keinen Fehler', async () => {
    onlineSpy.mockReturnValue(false);
    const api = fakeSource({ pages: [page([milk('online', '111')])] });
    const catalog = createProductCatalog({ local: fakeSource(), dump: fakeSource(), api });

    const result = await catalog.search('Milch');

    expect(api.searchCalls).toHaveLength(0);
    expect(result.products).toEqual([]);
    expect(result.failed).toBe(false);
    expect(result.hasMore).toBe(false);
  });

  it('bleibt gueltig, wenn der Dump nicht angehaengt ist', async () => {
    const catalog = createProductCatalog({
      local: fakeSource(),
      dump: fakeSource({ pages: [page([], { failed: true })] }),
      api: fakeSource({ pages: [page([milk('online', '111')])] }),
    });

    await expect(catalog.search('Milch')).resolves.toMatchObject({
      products: [expect.objectContaining({ barcode: '111' })],
      failed: false,
    });
  });

  it('zeigt einen Barcode aus Katalog und Dump nur einmal, mit den lokalen Feldern', async () => {
    const catalog = createProductCatalog({
      local: fakeSource({
        pages: [page([product({ name: 'Milch lokal', barcode: '400', productId: 'p1' })])],
      }),
      dump: fakeSource({ pages: [page([product({ name: 'Milch Dump', barcode: '400' })])] }),
      api: fakeSource(),
    });

    const result = await catalog.search('Milch');

    expect(result.products).toHaveLength(1);
    expect(result.products[0].productId).toBe('p1');
    expect(result.products[0].name).toBe('Milch lokal');
  });

  it('reichert einen Dump-Treffer nicht mit API-Feldern an', async () => {
    const catalog = createProductCatalog({
      local: fakeSource(),
      dump: fakeSource({
        pages: [page([product({ name: 'Milch Dump', barcode: '400' })])],
      }),
      api: fakeSource({
        pages: [
          page([product({ name: 'Milch API', barcode: '400', imageUrl: 'https://img/400.jpg' })]),
        ],
      }),
    });

    const result = await catalog.search('Milch');

    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Milch Dump');
    expect(result.products[0].imageUrl).toBeUndefined();
  });

  it('legt Treffer ohne Barcode nie zusammen', async () => {
    const catalog = createProductCatalog({
      local: fakeSource({ pages: [page([product({ name: 'Milch frisch' })])] }),
      dump: fakeSource({ pages: [page([product({ name: 'Milch haltbar' })])] }),
      api: fakeSource(),
    });

    const result = await catalog.search('Milch');

    expect(result.products).toHaveLength(2);
  });

  it('laedt ueber nextCursor erst weitere Dump-Treffer und danach weitere API-Seiten', async () => {
    const dump = fakeSource({
      pages: [
        page([milk('d1', '1'), milk('d2', '2'), milk('d3', '3')], { hasMore: true }),
        page([milk('d4', '4')]),
      ],
    });
    const api = fakeSource({
      pages: [page([milk('a1', '5')], { hasMore: true }), page([milk('a2', '6')])],
    });
    const catalog = createProductCatalog({ local: fakeSource(), dump, api });

    const first = await catalog.search('Milch', { limit: 3 });
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toBeDefined();

    const second = await catalog.search('Milch', { limit: 3, cursor: first.nextCursor });
    expect(dump.searchCalls[1].offset).toBe(3);
    expect(second.products.map((p) => p.barcode)).toEqual(['4', '6']);

    const allBarcodes = [...first.products, ...second.products].map((p) => p.barcode);
    expect(new Set(allBarcodes).size).toBe(allBarcodes.length);
  });

  it('behandelt einen unlesbaren Cursor wie gar keinen', async () => {
    const dump = fakeSource({ pages: [page([milk('d1', '1')])] });
    const catalog = createProductCatalog({ local: fakeSource(), dump, api: fakeSource() });

    const result = await catalog.search('Milch', { cursor: 'nicht-dekodierbar' });

    expect(dump.searchCalls[0].offset).toBe(0);
    expect(result.products).toHaveLength(1);
  });

  it('behaelt lokale Treffer, wenn die API fehlschlaegt', async () => {
    const catalog = createProductCatalog({
      local: fakeSource({ pages: [page([milk('lokal', '1')])] }),
      dump: fakeSource(),
      api: fakeSource({ pages: [page([], { failed: true })] }),
    });

    const result = await catalog.search('Milch');

    expect(result.products).toHaveLength(1);
    expect(result.failed).toBe(true);
  });

  it('meldet einen API-Fehler ohne lokale Treffer als leeres, fehlgeschlagenes Ergebnis', async () => {
    const catalog = createProductCatalog({
      local: fakeSource(),
      dump: fakeSource(),
      api: fakeSource({ pages: [page([], { failed: true })] }),
    });

    const result = await catalog.search('Milch');

    expect(result.products).toEqual([]);
    expect(result.failed).toBe(true);
  });

  it('rankt die zusammengefuehrte Liste und bevorzugt die Marktpraeferenz', async () => {
    const catalog = createProductCatalog({
      local: fakeSource({
        pages: [
          page([
            product({ name: 'Vollmilch', brand: 'Fremdmarke', barcode: '1' }),
            product({ name: 'Vollmilch', brand: 'Milsani', barcode: '2' }),
          ]),
        ],
      }),
      dump: fakeSource(),
      api: fakeSource(),
    });

    const result = await catalog.search('Vollmilch', { preferredMarket: 'aldi' });

    expect(result.products[0].barcode).toBe('2');
  });

  it('behandelt eine abgetippte EAN als Barcode-Lookup', async () => {
    const local = fakeSource({
      byBarcode: { '4019300005307': product({ name: 'Balance', barcode: '4019300005307' }) },
    });
    const catalog = createProductCatalog({ local, dump: fakeSource(), api: fakeSource() });

    const result = await catalog.search('4019300005307');

    expect(local.searchCalls).toHaveLength(0);
    expect(local.barcodeCalls).toEqual(['4019300005307']);
    expect(result.products.map((p) => p.name)).toEqual(['Balance']);
    expect(result.hasMore).toBe(false);
  });

  it('fragt bei gesperrter Online-Ebene auch im Barcode-Pfad keine API an', async () => {
    // Sonst feuert jede Ziffer einer abgetippten EAN einen OFF-Request.
    const api = fakeSource({
      byBarcode: { '4019300005307': product({ name: 'API', barcode: '4019300005307' }) },
    });
    const catalog = createProductCatalog({ local: fakeSource(), dump: fakeSource(), api });

    const result = await catalog.search('4019300005307', { allowApi: false });

    expect(api.barcodeCalls).toEqual([]);
    expect(result.products).toEqual([]);
  });

  it('meldet keine weitere Seite, wenn die Online-Ebene fuer diesen Aufruf gesperrt ist', async () => {
    // `hasMore` mit unveraendertem Cursor liesse die UI dieselbe Seite
    // endlos nachladen.
    const catalog = createProductCatalog({
      local: fakeSource(),
      dump: fakeSource(),
      api: fakeSource(),
    });

    const result = await catalog.search('Milch', { allowApi: false });

    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeUndefined();
  });

  it('sperrt die tieferen Quellen nicht, wenn die lokalen Treffer im Ranking wegfallen', async () => {
    // Fuenf LIKE-Treffer, die zur Eingabe nicht passen: das Ranking wirft sie
    // weg, also muessen Dump und API trotzdem befragt werden.
    const noise = Array.from({ length: 5 }, (_, i) =>
      product({ name: `Ganz anderes Produkt ${i}`, barcode: `n${i}` }),
    );
    const dump = fakeSource({ pages: [page([product({ name: 'Vollmilch', barcode: '400' })])] });
    const catalog = createProductCatalog({
      local: fakeSource({ pages: [page(noise)] }),
      dump,
      api: fakeSource(),
    });

    const result = await catalog.search('Vollmilch');

    expect(dump.searchCalls).toHaveLength(1);
    expect(result.products.map((p) => p.barcode)).toEqual(['400']);
  });

  it('sucht nicht bei zu kurzer Eingabe', async () => {
    const local = fakeSource();
    const catalog = createProductCatalog({ local, dump: fakeSource(), api: fakeSource() });

    const result = await catalog.search('a');

    expect(local.searchCalls).toHaveLength(0);
    expect(result).toMatchObject({ products: [], hasMore: false, failed: false });
  });
});

describe('createProductCatalog.findByBarcode', () => {
  it('nutzt die Reihenfolge lokal, Dump, API', async () => {
    const local = fakeSource();
    const dump = fakeSource();
    const api = fakeSource({
      byBarcode: { '400': product({ name: 'API-Treffer', barcode: '400' }) },
    });
    const catalog = createProductCatalog({ local, dump, api });

    const found = await catalog.findByBarcode('400');

    expect(local.barcodeCalls).toEqual(['400']);
    expect(dump.barcodeCalls).toEqual(['400']);
    expect(found?.name).toBe('API-Treffer');
  });

  it('bevorzugt das eigene Produkt vor Dump und API', async () => {
    const dump = fakeSource({ byBarcode: { '400': product({ name: 'Dump', barcode: '400' }) } });
    const api = fakeSource({ byBarcode: { '400': product({ name: 'API', barcode: '400' }) } });
    const catalog = createProductCatalog({
      local: fakeSource({
        byBarcode: { '400': product({ name: 'Eigenes', barcode: '400', productId: 'p1' }) },
      }),
      dump,
      api,
    });

    const found = await catalog.findByBarcode('400');

    expect(found?.name).toBe('Eigenes');
    expect(dump.barcodeCalls).toEqual([]);
    expect(api.barcodeCalls).toEqual([]);
  });

  it('endet offline nach der Dump-Ebene mit null statt mit einem Fehler', async () => {
    onlineSpy.mockReturnValue(false);
    const api = fakeSource({ byBarcode: { '400': product({ name: 'API', barcode: '400' }) } });
    const catalog = createProductCatalog({ local: fakeSource(), dump: fakeSource(), api });

    await expect(catalog.findByBarcode('400')).resolves.toBeNull();
    expect(api.barcodeCalls).toEqual([]);
  });
});
