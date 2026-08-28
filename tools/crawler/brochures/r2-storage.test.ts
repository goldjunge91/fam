import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  imageKeyFor,
  loadR2Config,
  mirrorBrochureImagesToR2,
  r2ObjectExists,
  sanitizeKeyPart,
  signR2Request,
  type R2Config,
  uploadToR2,
  verifyBrochureLifecycle,
} from './r2-storage';
import type { CrawlerBrochure } from './types';

describe('Cloudflare R2 Storage & Hash-based Image Keys', () => {
  const mockR2Config: R2Config = {
    accountId: 'mock_account_123',
    accessKeyId: 'mock_key_456',
    secretAccessKey: 'mock_secret_789',
    bucket: 'fam-brochures',
    publicUrl: 'https://pub-7c414d76492b43308e61c64079d2bbaa.r2.dev',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('erzeugt deterministische SHA-256 Hash-Keys analog zu migrate-brochures-r2.ts', () => {
    const url1 = 'https://offerscdn.bringapi.app/offers/de/123/cover.jpg';
    const url2 = 'https://offerscdn.bringapi.app/offers/de/123/page1.jpg';

    const keyCover = imageKeyFor(url1, 'lidl_kw35', 'cover');
    const keyPage1 = imageKeyFor(url2, 'lidl_kw35', 'page-001');

    expect(keyCover).toMatch(/^brochures\/dumps\/lidl_kw35\/cover-[a-f0-9]{16}\.jpg$/);
    expect(keyPage1).toMatch(/^brochures\/dumps\/lidl_kw35\/page-001-[a-f0-9]{16}\.jpg$/);

    // Gleiche URL muss exakt denselben Hash erzeugen (Deterministisch)
    const keyCoverAgain = imageKeyFor(url1, 'lidl_kw35', 'cover');
    expect(keyCoverAgain).toBe(keyCover);
  });

  it('bereinigt Sonderzeichen im brochureId Key-Pfad', () => {
    const key = imageKeyFor(
      'https://example.com/test.jpg',
      'aldi:nord/special#2026',
      'cover',
    );
    expect(key).toBe('brochures/dumps/aldi_nord_special_2026/cover-a4e3f584073a0ae9.jpg');
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
    cache.set('https://cdn.example.com/cover.jpg', 'https://pub-7c414d76492b43308e61c64079d2bbaa.r2.dev/cached-cover.jpg');
    cache.set('https://cdn.example.com/page1.jpg', 'https://pub-7c414d76492b43308e61c64079d2bbaa.r2.dev/cached-page1.jpg');

    const result = await mirrorBrochureImagesToR2(mockBrochure, mockR2Config, cache);

    expect(result.coverImage).toBe('https://pub-7c414d76492b43308e61c64079d2bbaa.r2.dev/cached-cover.jpg');
    expect(result.pages[0].imageUrl).toBe('https://pub-7c414d76492b43308e61c64079d2bbaa.r2.dev/cached-page1.jpg');
  });

  it('deaktiviert R2 vollständig für einen Dry-Run', () => {
    expect(loadR2Config({ disabled: true })).toBeNull();
  });

  it('erkennt über HEAD bereits vorhandene Objekte', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null));

    await expect(r2ObjectExists(mockR2Config, 'brochures/dumps/existing.jpg')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe('HEAD');
  });

  it('lädt bereits vorhandene Bilder weder herunter noch erneut hoch', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null));
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

    expect(result.coverImage).toContain('/brochures/dumps/existing-brochure/cover-');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe('HEAD');
  });

  it('dedupliziert parallele Uploads über einen gemeinsamen Promise-Cache', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      if (init?.method === 'HEAD') return new Response(null, { status: 404 });
      if (init?.method === 'PUT') return new Response(null);
      return new Response(new Uint8Array([1, 2, 3]));
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
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'HEAD')).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('verhindert mit If-None-Match konkurrierende Überschreibungen', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 412 }));

    await expect(
      uploadToR2(mockR2Config, 'brochures/dumps/race.jpg', new ArrayBuffer(1)),
    ).resolves.toBe('already-existed');
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual(
      expect.objectContaining({ 'if-none-match': '*' }),
    );
  });

  it('verifiziert die 60-Tage-Regel über ein bestehendes Probeobjekt', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(null, {
          headers: {
            'last-modified': 'Fri, 28 Aug 2026 10:00:00 GMT',
            'x-amz-expiration': 'expiry-date="Tue, 27 Oct 2026 10:00:00 GMT", rule-id="dump-retention"',
          },
        }),
      );

    await expect(verifyBrochureLifecycle(mockR2Config)).resolves.toEqual({
      expiresAt: '2026-10-27T10:00:00.000Z',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe('HEAD');
    expect(fetchMock.mock.calls[0][0]).toEqual(
      expect.stringContaining('/brochures/dumps/.lifecycle-probe'),
    );
  });

  it('legt ein fehlendes Probeobjekt höchstens einmal an und prüft es danach', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null))
      .mockResolvedValueOnce(
        new Response(null, {
          headers: {
            'last-modified': 'Fri, 28 Aug 2026 10:00:00 GMT',
            'x-amz-expiration': 'expiry-date="Tue, 27 Oct 2026 10:00:00 GMT"',
          },
        }),
      );

    await expect(verifyBrochureLifecycle(mockR2Config)).resolves.toEqual({
      expiresAt: '2026-10-27T10:00:00.000Z',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual(['HEAD', 'PUT', 'HEAD']);
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual(
      expect.objectContaining({ 'if-none-match': '*' }),
    );
  });

  it('stoppt vor dem Crawl, wenn das Probeobjekt nicht nach 60 Tagen abläuft', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(null, {
        headers: {
          'last-modified': 'Fri, 28 Aug 2026 10:00:00 GMT',
          'x-amz-expiration': 'expiry-date="Fri, 11 Sep 2026 10:00:00 GMT"',
        },
      }),
    );

    await expect(verifyBrochureLifecycle(mockR2Config)).rejects.toThrow(
      'R2 Lifecycle ist für brochures/dumps/ nicht auf 60 Tage aktiv',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
