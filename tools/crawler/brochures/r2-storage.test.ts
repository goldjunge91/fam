import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  ensureR2StorageBudget,
  imageKeyFor,
  listR2Objects,
  loadR2Config,
  mirrorBrochureImagesToR2,
  type R2Config,
  r2ObjectExists,
  sanitizeKeyPart,
  signR2Request,
  uploadToR2,
} from './r2-storage';
import type { CrawlerBrochure } from './types';

function testResponse(body: Uint8Array | null, status = 200): Response {
  const bytes = body ? new Uint8Array(body) : new Uint8Array();
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    arrayBuffer: async () => bytes.slice().buffer,
    text: async () => Buffer.from(bytes).toString('utf8'),
  } as unknown as Response;
}

describe('Cloudflare R2 Storage & Hash-based Image Keys', () => {
  const mockR2Config: R2Config = {
    accountId: 'mock_account_123',
    accessKeyId: 'mock_key_456',
    secretAccessKey: 'mock_secret_789',
    bucket: 'fam-brochures',
    publicUrl: 'https://pub-7c414d76492b43308e61c64079d2bbaa.r2.dev',
  };

  beforeEach(() => {
    if (!AbortSignal.timeout) {
      Object.defineProperty(AbortSignal, 'timeout', {
        configurable: true,
        value: () => new AbortController().signal,
      });
    }
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('erzeugt globale deterministische SHA-256 Asset-Keys', () => {
    const url1 = 'https://offerscdn.bringapi.app/offers/de/123/cover.jpg';
    const url2 = 'https://offerscdn.bringapi.app/offers/de/123/page1.jpg';

    const keyCover = imageKeyFor(url1);
    const keyPage1 = imageKeyFor(url2);

    expect(keyCover).toMatch(/^brochures\/dumps\/assets\/[a-f0-9]{64}\.jpg$/);
    expect(keyPage1).toMatch(/^brochures\/dumps\/assets\/[a-f0-9]{64}\.jpg$/);

    // Gleiche URL muss unabhängig von Prospekt und Kontext exakt denselben Key erzeugen.
    const keyCoverAgain = imageKeyFor(url1);
    expect(keyCoverAgain).toBe(keyCover);
  });

  it('hält neue Assets unter dem bestehenden Lifecycle-Prefix', () => {
    const key = imageKeyFor('https://example.com/test.jpg');
    expect(key).toMatch(/^brochures\/dumps\/assets\/[a-f0-9]{64}\.jpg$/);
    expect(sanitizeKeyPart('a b/c:d')).toBe('a_b_c_d');
  });

  it('erzeugt gültige AWS SigV4 Signatur-Header für Cloudflare R2', () => {
    const key = 'brochures/dumps/test/cover-1234.jpg';
    const signed = signR2Request(mockR2Config, key);

    expect(signed.url).toBe(
      'https://mock_account_123.r2.cloudflarestorage.com/fam-brochures/brochures/dumps/test/cover-1234.jpg',
    );
    expect(signed.headers.host).toBe('mock_account_123.r2.cloudflarestorage.com');
    expect(signed.headers['x-amz-content-sha256']).toBe('UNSIGNED-PAYLOAD');
    expect(signed.headers.Authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=mock_key_456\/\d{8}\/auto\/s3\/aws4_request/,
    );
  });

  it('nutzt Cache und überspringt bereits migrierte URLs', async () => {
    const mockBrochure: CrawlerBrochure = {
      id: 'b-1',
      storeId: 'lidl',
      title: 'Lidl Prospekt',
      validFrom: '2026-08-25T00:00:00Z',
      validUntil: '2026-09-01T00:00:00Z',
      coverImage: 'https://cdn.example.com/cover.jpg',
      pages: [
        {
          number: 1,
          imageUrl: 'https://cdn.example.com/page1.jpg',
          hotspots: [],
        },
      ],
    };

    const cache = new Map<string, string>();
    cache.set(
      'https://cdn.example.com/cover.jpg',
      'https://pub-7c414d76492b43308e61c64079d2bbaa.r2.dev/cached-cover.jpg',
    );
    cache.set(
      'https://cdn.example.com/page1.jpg',
      'https://pub-7c414d76492b43308e61c64079d2bbaa.r2.dev/cached-page1.jpg',
    );

    const result = await mirrorBrochureImagesToR2(mockBrochure, mockR2Config, cache);

    expect(result.coverImage).toBe(
      'https://pub-7c414d76492b43308e61c64079d2bbaa.r2.dev/cached-cover.jpg',
    );
    expect(result.pages[0].imageUrl).toBe(
      'https://pub-7c414d76492b43308e61c64079d2bbaa.r2.dev/cached-page1.jpg',
    );
  });

  it('deaktiviert R2 vollständig für einen Dry-Run', () => {
    expect(loadR2Config({ disabled: true })).toBeNull();
  });

  it('inventarisiert für das Budget den gesamten Bucket statt nur den Prospektpräfix', async () => {
    const xml = `<ListBucketResult>
      <IsTruncated>false</IsTruncated>
      <Contents><Key>other/config.json</Key><Size>40</Size></Contents>
      <Contents><Key>brochures/dumps/assets/page.jpg</Key><Size>60</Size></Contents>
    </ListBucketResult>`;
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(testResponse(Buffer.from(xml)));
    const config: R2Config = { ...mockR2Config, storageBudgetBytes: 100 };

    const budget = await ensureR2StorageBudget(config);
    const objects = await listR2Objects({ ...mockR2Config });

    expect(budget?.snapshot().occupiedBytes).toBe(100);
    expect(objects.map(({ key }) => key)).toEqual([
      'other/config.json',
      'brochures/dumps/assets/page.jpg',
    ]);
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('prefix=brochures%2Fdumps%2F');
  });

  it('erkennt über HEAD bereits vorhandene Objekte', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(testResponse(null));

    await expect(r2ObjectExists(mockR2Config, 'brochures/dumps/existing.jpg')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe('HEAD');
  });

  it('lädt bereits vorhandene Bilder weder herunter noch erneut hoch', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(testResponse(null));
    const brochure: CrawlerBrochure = {
      id: 'existing-brochure',
      storeId: 'store',
      title: 'Prospekt',
      validFrom: '2026-08-25T00:00:00Z',
      validUntil: '2026-09-01T00:00:00Z',
      coverImage: 'https://cdn.example.com/cover.jpg',
      pages: [],
    };

    const result = await mirrorBrochureImagesToR2(brochure, mockR2Config, new Map());

    expect(result.coverImage).toMatch(/\/brochures\/dumps\/assets\/[a-f0-9]{64}\.jpg$/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe('HEAD');
  });

  it('verwendet während der Umstellung vorhandene Legacy-Objekte weiter', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      if (init?.method === 'HEAD') {
        const url = String(_input);
        return testResponse(null, url.includes('/assets/') ? 404 : 200);
      }
      throw new Error('Das Legacy-Objekt darf keinen Download auslösen.');
    });

    const brochure: CrawlerBrochure = {
      id: 'legacy-brochure',
      storeId: 'store',
      title: 'Prospekt',
      validFrom: '2026-08-25T00:00:00Z',
      validUntil: '2026-09-01T00:00:00Z',
      coverImage: 'https://cdn.example.com/cover.jpg',
      pages: [],
    };

    const result = await mirrorBrochureImagesToR2(brochure, mockR2Config, new Map());

    expect(result.coverImage).toContain('/brochures/dumps/legacy-brochure/cover-');
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'HEAD')).toHaveLength(2);
  });

  it('dedupliziert parallele Uploads über einen gemeinsamen Promise-Cache', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      if (init?.method === 'HEAD') return testResponse(null, 404);
      if (init?.method === 'PUT') return testResponse(null);
      return testResponse(new Uint8Array([1, 2, 3]));
    });
    const cache = new Map<string, string | Promise<string>>();
    const brochure: CrawlerBrochure = {
      id: 'shared-brochure',
      storeId: 'store',
      title: 'Prospekt',
      validFrom: '2026-08-25T00:00:00Z',
      validUntil: '2026-09-01T00:00:00Z',
      coverImage: 'https://cdn.example.com/shared.jpg',
      pages: [],
    };

    const [first, second] = await Promise.all([
      mirrorBrochureImagesToR2(brochure, mockR2Config, cache),
      mirrorBrochureImagesToR2(brochure, mockR2Config, cache),
    ]);

    expect(first.coverImage).toBe(second.coverImage);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'HEAD')).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('verhindert mit If-None-Match konkurrierende Überschreibungen', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(testResponse(null, 412));

    await expect(
      uploadToR2(mockR2Config, 'brochures/dumps/race.jpg', new ArrayBuffer(1)),
    ).resolves.toBe('already-existed');
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual(
      expect.objectContaining({ 'if-none-match': '*' }),
    );
  });
});
