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
