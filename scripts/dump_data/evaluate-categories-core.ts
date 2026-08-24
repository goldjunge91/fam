/**
 * Reine Aggregationslogik für die Dump-Kalibrierung (#223 Paket 1, Abschnitt
 * 15). Getrennt von `evaluate-categories.ts`, damit der Kern ohne SQLite/
 * Dateisystem testbar ist — die CLI (Datei lesen, JSON/HTML schreiben) bleibt
 * ein dünner Wrapper um `evaluateDump()`.
 *
 * Ruft `classifyCategory()` direkt aus der produktiven Klassifikations-Engine
 * auf (keine Zweitimplementierung), siehe `src/features/shopping-list/classification/`.
 */

import { CLASSIFIER_VERSION } from '@/features/shopping-list/classification/classifier-version';
import {
  normalizePlacementZoneId,
  PLACEMENT_ZONE_IDS,
  type PlacementZoneId,
} from '@/features/shopping-list/classification/placement-taxonomy';
import { classifyCategory } from '@/features/shopping-list/classification/shopping-category-classifier';
import type { GoldenCorpusEntry } from './category-golden-corpus';

export type DumpProductInput = {
  barcode: string;
  name: string;
  /** Leer/undefined solange der Dump noch Schema 1 ist (kein `categories_tags`, siehe #223 Paket 4). */
  categoryTags?: string[];
};

export type CategorySample = { barcode: string; name: string };

export type GoldenResult = GoldenCorpusEntry & {
  actual: PlacementZoneId | null;
  passed: boolean;
};

export type CalibrationReport = {
  classifierVersion: string;
  totalProducts: number;
  sonstigesCount: number;
  sonstigesShare: number;
  sourceCounts: { off_taxonomy: number; name_fallback: number; none: number };
  categoryDistribution: Record<PlacementZoneId, number>;
  /** Bis zu 1.000 deterministisch gewählte Beispiele je Kategorie. */
  samples: Record<PlacementZoneId, CategorySample[]>;
  golden: {
    total: number;
    passedCount: number;
    failed: GoldenResult[];
  };
};

export const DEFAULT_SAMPLE_SIZE_PER_CATEGORY = 1000;

export const ALL_SHOPPING_CATEGORY_IDS: readonly PlacementZoneId[] = PLACEMENT_ZONE_IDS;

/**
 * Stabiler FNV-1a-Hash für deterministisches, von der Dump-Zeilenreihenfolge
 * unabhängiges Sampling — zwei Läufe über denselben Dump liefern dieselben
 * 100 Stichproben je Kategorie, auch wenn eine künftige Dump-Version Zeilen
 * in anderer Reihenfolge liefert.
 */
function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function emptyCategoryRecord<T>(fill: () => T): Record<PlacementZoneId, T> {
  return Object.fromEntries(ALL_SHOPPING_CATEGORY_IDS.map((id) => [id, fill()])) as Record<
    PlacementZoneId,
    T
  >;
}

export function evaluateDump(
  products: readonly DumpProductInput[],
  golden: readonly GoldenCorpusEntry[],
  sampleSizePerCategory = DEFAULT_SAMPLE_SIZE_PER_CATEGORY,
): CalibrationReport {
  const categoryDistribution = emptyCategoryRecord(() => 0);
  const sampleBuckets = emptyCategoryRecord(() => [] as { hash: number; sample: CategorySample }[]);
  const sourceCounts = { off_taxonomy: 0, name_fallback: 0, none: 0 };
  let sonstigesCount = 0;

  for (const product of products) {
    const result = classifyCategory({
      name: product.name,
      categoryTags: product.categoryTags ?? [],
    });

    if (result.categoryId === null) {
      sonstigesCount++;
      sourceCounts.none++;
      continue;
    }

    categoryDistribution[result.categoryId]++;
    if (result.source === 'off_taxonomy') sourceCounts.off_taxonomy++;
    else if (result.source === 'name_fallback') sourceCounts.name_fallback++;

    sampleBuckets[result.categoryId].push({
      hash: stableHash(product.barcode || product.name),
      sample: { barcode: product.barcode, name: product.name },
    });
  }

  const samples = emptyCategoryRecord(() => [] as CategorySample[]);
  for (const categoryId of ALL_SHOPPING_CATEGORY_IDS) {
    samples[categoryId] = sampleBuckets[categoryId]
      .slice()
      .sort((a, b) => a.hash - b.hash)
      .slice(0, sampleSizePerCategory)
      .map((entry) => entry.sample);
  }

  const goldenResults: GoldenResult[] = golden.map((entry) => {
    const actual = classifyCategory({
      name: entry.name,
      categoryTags: entry.categoryTags ?? [],
    }).categoryId;
    const expected = entry.expected === null ? null : normalizePlacementZoneId(entry.expected);
    return { ...entry, actual, passed: actual === expected };
  });

  return {
    classifierVersion: CLASSIFIER_VERSION,
    totalProducts: products.length,
    sonstigesCount,
    sonstigesShare: products.length > 0 ? sonstigesCount / products.length : 0,
    sourceCounts,
    categoryDistribution,
    samples,
    golden: {
      total: goldenResults.length,
      passedCount: goldenResults.filter((r) => r.passed).length,
      failed: goldenResults.filter((r) => !r.passed),
    },
  };
}
