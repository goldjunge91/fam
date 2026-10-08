import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  mirrorBrochureImagesToR2,
  type R2Config,
} from '../../tools/crawler/brochures/r2-storage';
import type { CrawlerBrochure } from '../../tools/crawler/brochures/types';

function response(status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    arrayBuffer: async () => new ArrayBuffer(0),
    text: async () => '',
  } as unknown as Response;
}

describe('private R2 brochure storage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores a private object key in the brochure instead of a public URL', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(response());
    const config: R2Config = {
      accountId: 'account',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret',
      bucket: 'brochures',
    };
    const brochure: CrawlerBrochure = {
      id: 'brochure-1',
      storeId: 'store-1',
      title: 'Store brochure',
      validFrom: '2026-10-01',
      validUntil: '2026-10-07',
      coverImage: 'https://cdn.example.test/cover.jpg',
      pages: [],
    };

    const result = await mirrorBrochureImagesToR2(brochure, config, new Map());

    expect(result.coverImage).toMatch(/^brochures\/dumps\/assets\/[a-f0-9]{64}\.jpg$/);
    expect(result.coverImage).not.toContain('.r2.dev');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('HEAD');
  });
});
