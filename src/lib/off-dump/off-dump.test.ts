import { checkForNewDumpRelease, pickDbAsset } from '@/lib/off-dump/off-dump';

describe('pickDbAsset', () => {
  it('waehlt das unkomprimierte .db-Asset, nicht das .db.gz', () => {
    const asset = pickDbAsset([
      { name: 'products_de_2026-08-01.db.gz', browser_download_url: 'https://x/gz' },
      { name: 'products_de_2026-08-01.db', browser_download_url: 'https://x/db' },
    ]);
    expect(asset?.browser_download_url).toBe('https://x/db');
  });

  it('liefert undefined, wenn kein .db-Asset dabei ist', () => {
    expect(
      pickDbAsset([{ name: 'checksums.txt', browser_download_url: 'https://x/txt' }]),
    ).toBeUndefined();
  });

  it('liefert undefined bei leerer Asset-Liste', () => {
    expect(pickDbAsset([])).toBeUndefined();
  });
});

describe('checkForNewDumpRelease', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('liefert Tag und Download-URL des neuesten Releases', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: 'dump-2026-08-01',
        assets: [{ name: 'products_de_2026-08-01.db', browser_download_url: 'https://x/db' }],
      }),
    }) as unknown as typeof fetch;

    expect(await checkForNewDumpRelease()).toEqual({
      tag: 'dump-2026-08-01',
      downloadUrl: 'https://x/db',
    });
  });

  it('liefert null bei einer Nicht-2xx-Antwort statt zu werfen', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    expect(await checkForNewDumpRelease()).toBeNull();
  });

  it('liefert null, wenn kein .db-Asset im Release ist', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'dump-2026-08-01', assets: [] }),
    }) as unknown as typeof fetch;
    expect(await checkForNewDumpRelease()).toBeNull();
  });

  it('liefert null bei einem Netzwerkfehler statt zu werfen', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    expect(await checkForNewDumpRelease()).toBeNull();
  });
});

describe('toOpenFoodFactsProductFromDump', () => {
  it('mappt DB-Zeile korrekt in OpenFoodFactsProduct', () => {
    const { toOpenFoodFactsProductFromDump } = require('@/lib/off-dump/off-dump');
    const product = toOpenFoodFactsProductFromDump({
      code: '4008400404127',
      product_name: 'Kinder Riegel',
      brand: 'Ferrero',
      quantity: '210 g',
      nutriscore: 'e',
      energy_kcal: 566,
      fat: 35,
      saturated_fat: 22.6,
      carbohydrates: 53.5,
      sugars: 53.3,
      proteins: 8.7,
      salt: 0.313,
    });

    expect(product).toEqual({
      barcode: '4008400404127',
      name: 'Kinder Riegel',
      brand: 'Ferrero',
      quantity: 210,
      unit: 'g',
      nutriScore: 'e',
      caloriesPer100g: 566,
      fatPer100g: 35,
      saturatedFatPer100g: 22.6,
      carbsPer100g: 53.5,
      sugarsPer100g: 53.3,
      proteinsPer100g: 8.7,
      saltPer100g: 0.313,
    });
  });
});

describe('dedupeProductsByBarcode', () => {
  it('filtert Duplikate anhand des Barcodes heraus und behält eindeutige Produkte', () => {
    const { dedupeProductsByBarcode } = require('@/lib/off-dump/off-dump');
    const list = [
      { barcode: '111', name: 'Produkt 1 (lokal)' },
      { barcode: '222', name: 'Produkt 2' },
      { barcode: '111', name: 'Produkt 1 (remote)' },
      { barcode: '', name: 'Produkt ohne Barcode 1' },
      { barcode: '', name: 'Produkt ohne Barcode 2' },
    ];

    const deduped = dedupeProductsByBarcode(
      list as unknown as Parameters<typeof dedupeProductsByBarcode>[0],
    );
    expect(deduped).toHaveLength(4);
    expect(deduped[0].name).toBe('Produkt 1 (lokal)');
    expect(deduped[1].name).toBe('Produkt 2');
    expect(deduped[2].name).toBe('Produkt ohne Barcode 1');
    expect(deduped[3].name).toBe('Produkt ohne Barcode 2');
  });
});
