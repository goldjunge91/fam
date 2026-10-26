import type { CrawlerBrochure, LocationDump } from '../types';
import { requiredBringImageUrl } from '../bring-image-url';
import { regionalReferenceKey } from './fetch-detail-pages';

type CatalogDump = Omit<LocationDump, 'brochures'> & {
  brochures: readonly CrawlerBrochure[];
};

export type CanonicalCatalogRecord = CrawlerBrochure & {
  canonicalBrn: string;
  sourceZipCode: string;
  pageCount: number;
  availableZipCodes: string[];
};

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function canonicalRegionalId(zipCode: string, brn: string): string {
  return `canonical:${zipCode}:${brn}`;
}

function validatedBrochure(brochure: CrawlerBrochure, zipCode: string): CanonicalCatalogRecord {
  if (!/^\d{5}$/.test(zipCode)) throw new Error(`Invalid brochure ZIP code ${zipCode}`);
  if (!brochure.id.trim()) throw new Error('Brochure BRN must not be empty');
  if (!Number.isInteger(brochure.pages.length) || brochure.pages.length < 1) {
    throw new Error(`Brochure ${brochure.id} has no complete page set`);
  }

  const pages = brochure.pages
    .slice()
    .sort((left, right) => left.number - right.number)
    .map((page, index) => {
      if (page.number !== index + 1) {
        throw new Error(`Brochure ${brochure.id} pages must be ordered from page 1`);
      }
      return {
        ...page,
        imageUrl: requiredBringImageUrl(page.imageUrl, `Brochure ${brochure.id} page ${page.number}`),
        hotspots: page.hotspots.map((hotspot) => ({
          ...hotspot,
          ...(hotspot.imageUrl
            ? { imageUrl: requiredBringImageUrl(hotspot.imageUrl, `Brochure ${brochure.id} hotspot`) }
            : {}),
        })),
      };
    });

  const coverImage = requiredBringImageUrl(brochure.coverImage, `Brochure ${brochure.id} cover`);

  return {
    ...brochure,
    id: canonicalRegionalId(zipCode, brochure.id),
    canonicalBrn: brochure.id,
    sourceZipCode: zipCode,
    pageCount: pages.length,
    coverImage,
    pages,
    availableZipCodes: [zipCode],
  };
}

/** Keeps each ZIP/BRN page set separate until regional equivalence is established. */
export function buildCanonicalCatalog(
  dumps: readonly CatalogDump[],
): CanonicalCatalogRecord[] {
  const records = new Map<string, CanonicalCatalogRecord>();

  for (const dump of dumps) {
    const zipCode = dump.location.zipCode;
    for (const brochure of dump.brochures) {
      const record = validatedBrochure(brochure, zipCode);
      const existing = records.get(record.id);
      if (!existing) {
        records.set(record.id, record);
        continue;
      }

      if (JSON.stringify(existing) !== JSON.stringify(record)) {
        throw new Error(`Regional brochure ${regionalReferenceKey(record.sourceZipCode, record.canonicalBrn)} has conflicting detail metadata`);
      }
    }
  }

  return [...records.values()].sort(
    (left, right) =>
      compareStrings(left.sourceZipCode, right.sourceZipCode) ||
      compareStrings(left.canonicalBrn, right.canonicalBrn),
  );
}
