import { createHash } from 'node:crypto';

export type PageContentHash = {
  pageNumber: number;
  sha256: string;
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

/** Hashes the complete ordered page-hash vector after validating its coverage. */
export function hashOrderedPageSet(
  pages: readonly PageContentHash[],
  expectedPageCount: number,
): string {
  if (!Number.isSafeInteger(expectedPageCount) || expectedPageCount < 1) {
    throw new Error('Expected page count must be a positive safe integer.');
  }
  if (pages.length !== expectedPageCount) {
    throw new Error(`Expected ${expectedPageCount} page hashes; received ${pages.length}.`);
  }

  const orderedPages = [...pages].sort((left, right) => left.pageNumber - right.pageNumber);
  for (const [index, page] of orderedPages.entries()) {
    if (page.pageNumber !== index + 1) {
      throw new Error(`Page hash set must contain each page number from 1 to ${expectedPageCount}.`);
    }
    if (!SHA256_PATTERN.test(page.sha256)) {
      throw new Error(`Page ${page.pageNumber} has an invalid SHA-256 value.`);
    }
  }

  return createHash('sha256')
    .update(JSON.stringify(orderedPages.map(({ pageNumber, sha256 }) => [pageNumber, sha256])))
    .digest('hex');
}
