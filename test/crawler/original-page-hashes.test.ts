import { createHash } from 'node:crypto';
import { describe, expect, it, jest } from '@jest/globals';
import { hashOrderedPageSet } from '../../tools/crawler/brochures/listing-only/full-brochure-signature';
import {
  createBrochurePageHashingSession,
  type OriginalImageStoreInput,
} from '../../tools/crawler/brochures/listing-only/original-page-hashes';

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('original brochure page hashes', () => {
  it('hashes original bytes in URL order and produces a full brochure signature', async () => {
    const firstPage = new TextEncoder().encode('original page one');
    const secondPage = new TextEncoder().encode('original page two');
    const session = createBrochurePageHashingSession(
      async (url) => (url === 'https://example.test/one' ? firstPage : secondPage),
      async () => {},
    );

    const result = await session.hashBrochurePages([
      'https://example.test/one',
      'https://example.test/two',
    ]);

    expect(result.pageHashes).toEqual([
      { pageNumber: 1, sha256: sha256(firstPage) },
      { pageNumber: 2, sha256: sha256(secondPage) },
    ]);
    expect(result.brochureSha256).toBe(hashOrderedPageSet(result.pageHashes, 2));

    const reversed = await session.hashBrochurePages([
      'https://example.test/two',
      'https://example.test/one',
    ]);
    expect(reversed.brochureSha256).not.toBe(result.brochureSha256);
  });

  it('fetches and stores a repeated URL once across calls in a session', async () => {
    const bytes = new TextEncoder().encode('shared original image');
    const fetchOriginalBytes = jest.fn(async () => bytes.buffer as ArrayBuffer);
    const storeOriginalBytes = jest.fn(async (_input: OriginalImageStoreInput) => {});
    const session = createBrochurePageHashingSession(fetchOriginalBytes, storeOriginalBytes);

    const firstResult = await session.hashBrochurePages([
      'https://example.test/shared',
      'https://example.test/shared',
    ]);
    const secondResult = await session.hashBrochurePages(['https://example.test/shared']);

    expect(fetchOriginalBytes).toHaveBeenCalledTimes(1);
    expect(storeOriginalBytes).toHaveBeenCalledTimes(1);
    expect(storeOriginalBytes).toHaveBeenCalledWith({
      url: 'https://example.test/shared',
      sha256: sha256(bytes),
      bytes: expect.any(Uint8Array),
    });
    expect(firstResult.pageHashes).toEqual([
      { pageNumber: 1, sha256: sha256(bytes) },
      { pageNumber: 2, sha256: sha256(bytes) },
    ]);
    expect(secondResult.pageHashes).toEqual([{ pageNumber: 1, sha256: sha256(bytes) }]);
  });

  it('reuses a verified stored URL hash without fetching or storing again', async () => {
    const storedHash = sha256(new TextEncoder().encode('already stored page'));
    const fetchOriginalBytes = jest.fn(async () => new ArrayBuffer(0));
    const storeOriginalBytes = jest.fn(async () => {});
    const onPageHashed = jest.fn(async () => {});
    const session = createBrochurePageHashingSession(fetchOriginalBytes, storeOriginalBytes, {
      resolveStoredHash: async () => storedHash,
      onPageHashed,
    });

    const result = await session.hashBrochurePages(['https://example.test/stored']);

    expect(result.pageHashes).toEqual([{ pageNumber: 1, sha256: storedHash }]);
    expect(fetchOriginalBytes).not.toHaveBeenCalled();
    expect(storeOriginalBytes).not.toHaveBeenCalled();
    expect(onPageHashed).not.toHaveBeenCalled();
  });

  it('observes each new hash before storing its asset for resumable progress', async () => {
    const events: string[] = [];
    const bytes = new TextEncoder().encode('checkpoint before asset write');
    const session = createBrochurePageHashingSession(
      async () => bytes,
      async () => {
        events.push('stored');
      },
      {
        onPageHashed: async () => {
          events.push('checkpointed');
        },
      },
    );

    await session.hashBrochurePages(['https://example.test/new']);

    expect(events).toEqual(['checkpointed', 'stored']);
  });

  it('hashes only the bytes in a Uint8Array view', async () => {
    const backing = new TextEncoder().encode('prefix:image:suffix');
    const imageView = backing.subarray(7, 12);
    const storeOriginalBytes = jest.fn(async (_input: OriginalImageStoreInput) => {});
    const session = createBrochurePageHashingSession(async () => imageView, storeOriginalBytes);

    const result = await session.hashBrochurePages(['https://example.test/view']);

    expect(result.pageHashes[0]?.sha256).toBe(sha256(imageView));
    expect(storeOriginalBytes.mock.calls[0]?.[0].bytes).toEqual(imageView);
  });

  it('rejects an empty page list and empty URLs before fetching', async () => {
    const fetchOriginalBytes = jest.fn(async () => new ArrayBuffer(0));
    const storeOriginalBytes = jest.fn(async () => {});
    const session = createBrochurePageHashingSession(fetchOriginalBytes, storeOriginalBytes);

    await expect(session.hashBrochurePages([])).rejects.toThrow(/at least one page/i);
    await expect(session.hashBrochurePages(['  '])).rejects.toThrow(/URL must not be empty/i);
    expect(fetchOriginalBytes).not.toHaveBeenCalled();
    expect(storeOriginalBytes).not.toHaveBeenCalled();
  });

  it('evicts a URL cache entry when storing fails so a retry fetches and stores again', async () => {
    const bytes = new TextEncoder().encode('retry original image');
    const fetchOriginalBytes = jest.fn(async () => bytes);
    let failFirstStore = true;
    const storeOriginalBytes = jest.fn(async (_input: OriginalImageStoreInput) => {
      if (failFirstStore) {
        failFirstStore = false;
        throw new Error('asset budget exceeded');
      }
    });
    const session = createBrochurePageHashingSession(fetchOriginalBytes, storeOriginalBytes);

    await expect(session.hashBrochurePages(['https://example.test/retry'])).rejects.toThrow(
      /asset budget exceeded/i,
    );
    const retry = await session.hashBrochurePages(['https://example.test/retry']);

    expect(fetchOriginalBytes).toHaveBeenCalledTimes(2);
    expect(storeOriginalBytes).toHaveBeenCalledTimes(2);
    expect(retry.pageHashes).toEqual([{ pageNumber: 1, sha256: sha256(bytes) }]);
  });
});
