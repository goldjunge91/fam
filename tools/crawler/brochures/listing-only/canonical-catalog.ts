import type { CrawlerBrochure, LocationDump } from '../types';
import { hashOrderedPageSet, type PageContentHash } from './full-brochure-signature';

type HashedCrawlerBrochure = CrawlerBrochure & {
  verifiedSha256?: string;
  verifiedPageHashes?: PageContentHash[];
};
type CatalogDump = Omit<LocationDump, 'brochures'> & {
  brochures: readonly HashedCrawlerBrochure[];
};
type VerifiedCrawlerBrochure = CrawlerBrochure & { verifiedSha256: string };

type CatalogGroup = {
  groupKey: string;
  representative: VerifiedCrawlerBrochure;
  representativeOrder: string;
  availableZipCodes: Set<string>;
};

export type CanonicalCatalogRecord = CrawlerBrochure & {
  canonicalBrn: string;
  pageCount: number;
  verifiedSha256: string;
  availableZipCodes: string[];
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function buildCanonicalCatalog(
  dumps: readonly CatalogDump[],
): CanonicalCatalogRecord[] {
  const groups = new Map<string, CatalogGroup>();

  for (const dump of dumps) {
    const storeNames = new Map(dump.stores.map(({ id, name }) => [id, name]));

    for (const brochure of dump.brochures) {
      const verifiedSha256 = brochure.verifiedSha256;
      if (typeof verifiedSha256 !== 'string' || !SHA256_PATTERN.test(verifiedSha256)) {
        throw new Error(`Brochure ${brochure.id} is missing a valid verified SHA-256`);
      }

      const storeName = storeNames.get(brochure.storeId);
      if (!storeName) {
        throw new Error(`Brochure ${brochure.id} has no store name for ${brochure.storeId}`);
      }

      const groupKey = JSON.stringify([
        storeName,
        brochure.validFrom,
        brochure.validUntil,
        brochure.pages.length,
        brochure.verifiedPageHashes
          ? ['content', hashOrderedPageSet(brochure.verifiedPageHashes, brochure.pages.length)]
          : ['brn', brochure.id],
      ]);
      if (
        brochure.verifiedPageHashes &&
        !brochure.verifiedPageHashes.some(
          ({ pageNumber, sha256 }) => pageNumber === 1 && sha256 === verifiedSha256,
        )
      ) {
        throw new Error(`Brochure ${brochure.id} has inconsistent page 1 SHA-256 values`);
      }
      const verifiedBrochure: VerifiedCrawlerBrochure = { ...brochure, verifiedSha256 };
      const representativeOrder = JSON.stringify(verifiedBrochure);
      const existing = groups.get(groupKey);

      if (existing) {
        existing.availableZipCodes.add(dump.location.zipCode);
        if (
          compareStrings(verifiedBrochure.id, existing.representative.id) < 0 ||
          (verifiedBrochure.id === existing.representative.id &&
            compareStrings(representativeOrder, existing.representativeOrder) < 0)
        ) {
          existing.representative = verifiedBrochure;
          existing.representativeOrder = representativeOrder;
        }
        continue;
      }

      groups.set(groupKey, {
        groupKey,
        representative: verifiedBrochure,
        representativeOrder,
        availableZipCodes: new Set([dump.location.zipCode]),
      });
    }
  }

  return [...groups.values()]
    .sort((left, right) => compareStrings(left.groupKey, right.groupKey))
    .map(({ groupKey, representative, availableZipCodes }) => ({
      ...representative,
      id: `canonical:${groupKey}`,
      canonicalBrn: representative.id,
      pageCount: representative.pages.length,
      availableZipCodes: [...availableZipCodes].sort(compareStrings),
    }));
}
