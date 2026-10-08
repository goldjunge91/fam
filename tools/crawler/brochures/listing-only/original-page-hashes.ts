import { createHash } from 'node:crypto';
import {
  hashOrderedPageSet,
  type PageContentHash,
} from './full-brochure-signature';

export type OriginalImageBytes = ArrayBuffer | Uint8Array;

export type OriginalImageFetcher = (url: string) => Promise<OriginalImageBytes>;

export type OriginalImageStoreInput = {
  url: string;
  sha256: string;
  bytes: Uint8Array;
};

export type OriginalImageStore = (input: OriginalImageStoreInput) => Promise<void>;
export type OriginalImageHashResolver = (url: string) => Promise<string | undefined>;
export type OriginalImageHashObserver = (input: { url: string; sha256: string }) => Promise<void>;

export type BrochurePageHashingOptions = {
  resolveStoredHash?: OriginalImageHashResolver;
  onPageHashed?: OriginalImageHashObserver;
};

export type BrochurePageSignature = {
  pageHashes: PageContentHash[];
  brochureSha256: string;
};

export type BrochurePageHashingSession = {
  hashBrochurePages: (orderedPageUrls: readonly string[]) => Promise<BrochurePageSignature>;
};

function assertNonEmptyUrl(url: string): void {
  if (url.trim().length === 0) {
    throw new Error('Page image URL must not be empty.');
  }
}

function asBytes(bytes: OriginalImageBytes): Uint8Array {
  return bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
}

function hashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertSha256(sha256: string): void {
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error('Stored page SHA-256 must be 64 lowercase hexadecimal characters.');
  }
}

/** Shares each original image response for hashing and any later in-run asset handling. */
export function createBrochurePageHashingSession(
  fetchOriginalBytes: OriginalImageFetcher,
  storeOriginalBytes: OriginalImageStore,
  options: BrochurePageHashingOptions = {},
): BrochurePageHashingSession {
  const pageHashesByUrl = new Map<string, Promise<string>>();

  function getPageHash(url: string): Promise<string> {
    assertNonEmptyUrl(url);

    const cached = pageHashesByUrl.get(url);
    if (cached) return cached;

    const pending = Promise.resolve().then(async () => {
      const storedHash = await options.resolveStoredHash?.(url);
      if (storedHash !== undefined) {
        assertSha256(storedHash);
        return storedHash;
      }

      const bytes = asBytes(await fetchOriginalBytes(url));
      const sha256 = hashBytes(bytes);
      await options.onPageHashed?.({ url, sha256 });
      await storeOriginalBytes({ url, sha256, bytes });
      return sha256;
    });
    pageHashesByUrl.set(url, pending);
    void pending.catch(() => {
      if (pageHashesByUrl.get(url) === pending) pageHashesByUrl.delete(url);
    });
    return pending;
  }

  async function hashBrochurePages(
    orderedPageUrls: readonly string[],
  ): Promise<BrochurePageSignature> {
    if (orderedPageUrls.length === 0) {
      throw new Error('A brochure must contain at least one page.');
    }
    orderedPageUrls.forEach(assertNonEmptyUrl);

    const pageHashes: PageContentHash[] = [];
    for (const [index, url] of orderedPageUrls.entries()) {
      pageHashes.push({ pageNumber: index + 1, sha256: await getPageHash(url) });
    }

    return {
      pageHashes,
      brochureSha256: hashOrderedPageSet(pageHashes, orderedPageUrls.length),
    };
  }

  return { hashBrochurePages };
}
