import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { crawlAllLocations } from '../../tools/crawler/brochures/engine';
import {
  imageKeyFor,
  mirrorBrochureImagesToR2,
  type R2Config,
} from '../../tools/crawler/brochures/r2-storage';
import type { BrochureSource, CrawlerBrochure } from '../../tools/crawler/brochures/types';

const r2Config: R2Config = {
  accountId: 'test-account',
  accessKeyId: 'test-key',
  secretAccessKey: 'test-secret',
  bucket: 'test-bucket',
};

function response(status: number, bytes?: Uint8Array): Response {
  const body = bytes ? new Uint8Array(bytes) : new Uint8Array();
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    arrayBuffer: async () => body.slice().buffer,
    text: async () => Buffer.from(body).toString('utf8'),
  } as unknown as Response;
}

function brochureWithVerifiedPage(
  originalUrl: string,
  sha256: string,
  id = 'verified-brochure',
): CrawlerBrochure {
  return {
    id,
    storeId: 'store',
    title: 'Verified brochure',
    validFrom: '2026-10-01T00:00:00Z',
    validUntil: '2026-10-07T00:00:00Z',
    coverImage: '',
    pages: [{ number: 1, imageUrl: originalUrl, hotspots: [] }],
    verifiedPageHashes: [{ pageNumber: 1, sha256 }],
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('verified original bytes in the production mirror', () => {
  it('uploads resolver bytes under the existing URL-derived R2 key', async () => {
    const originalUrl = 'https://cdn.example.test/page-1.jpg';
    const originalBytes = new TextEncoder().encode('verified original page bytes');
    const sha256 = createHash('sha256').update(originalBytes).digest('hex');
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      if (init?.method === 'HEAD') return response(404);
      if (init?.method === 'PUT') return response(200);
      throw new Error('Verified resolver bytes must avoid downloading from the source URL.');
    });
    const resolver = jest.fn(async (requestedHash: string) =>
      requestedHash === sha256 ? originalBytes : undefined,
    );

    const mirrored = await mirrorBrochureImagesToR2(
      brochureWithVerifiedPage(originalUrl, sha256),
      r2Config,
      new Map(),
      resolver,
    );

    const upload = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(resolver).toHaveBeenCalledWith(sha256);
    expect(upload?.[1]?.body).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(upload?.[1]?.body as ArrayBuffer)).toEqual(originalBytes);
    expect(mirrored.pages[0]?.imageUrl).toBe(imageKeyFor(originalUrl));
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
  });

  it('never uploads or downloads when verified resolver bytes are missing or corrupt', async () => {
    const originalUrl = 'https://cdn.example.test/page-1-missing.jpg';
    const expectedBytes = new TextEncoder().encode('expected original page');
    const sha256 = createHash('sha256').update(expectedBytes).digest('hex');
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(response(404));
    const brochure = brochureWithVerifiedPage(originalUrl, sha256);

    await expect(
      mirrorBrochureImagesToR2(brochure, r2Config, new Map(), async () => undefined),
    ).rejects.toThrow(/verifizierte Originalbytes.*fehlen/i);
    await expect(
      mirrorBrochureImagesToR2(
        brochure,
        r2Config,
        new Map(),
        async () => new TextEncoder().encode('wrong original page'),
      ),
    ).rejects.toThrow(/SHA-256.*überein/i);

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0);
    expect(fetchMock.mock.calls.some(([input, init]) =>
      String(input) === originalUrl && init?.method !== 'HEAD'
    )).toBe(false);
  });

  it('passes the configured byte resolver through the crawl engine', async () => {
    const originalUrl = 'https://cdn.example.test/engine-page-1.jpg';
    const originalBytes = new TextEncoder().encode('bytes through the engine');
    const sha256 = createHash('sha256').update(originalBytes).digest('hex');
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      if (init?.method === 'HEAD') return response(404);
      if (init?.method === 'PUT') return response(200);
      throw new Error('The engine must pass the verified local bytes to the mirror.');
    });
    const resolver = jest.fn(async (requestedHash: string) =>
      requestedHash === sha256 ? originalBytes : undefined,
    );
    const sourceBrochure = brochureWithVerifiedPage(originalUrl, sha256, 'engine-brochure');
    const source: BrochureSource = {
      name: 'fixture',
      async fetchBrochuresForLocation() {
        return [{
          store: { id: 'store', name: 'Store' },
          brochures: [sourceBrochure],
        }];
      },
    };

    const result = await crawlAllLocations(
      [{ zipCode: '10115', latitude: 52.53, longitude: 13.4 }],
      {
        concurrency: 1,
        sources: [source],
        r2Config,
        backupPath: null,
        resolveOriginalBytesBySha256: resolver,
      },
    );

    expect(result.dumps[0]?.brochures[0]?.pages[0]?.imageUrl).toBe(imageKeyFor(originalUrl));
    expect(resolver).toHaveBeenCalledWith(sha256);
    expect(fetchMock.mock.calls.some(([input]) => String(input) === originalUrl)).toBe(false);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
  });
});
