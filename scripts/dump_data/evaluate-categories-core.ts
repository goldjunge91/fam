/** Reine Metriklogik auf Basis der produktiven Kategorie-Klassifikation. */

import { CLASSIFIER_VERSION } from '@/features/shopping-list/classification/classifier-version';
import { classifyCategory } from '@/features/shopping-list/classification/shopping-category-classifier';
import type { ShoppingCategoryId } from '@/features/shopping-list/classification/shopping-category-id';
import type { GoldenCorpusEntry } from './category-golden-corpus';

export type DumpProductInput = {
  barcode: string;
  name: string;
  categoryTags?: string[];
};

export type CategorySample = { barcode: string; name: string };

export type GoldenResult = GoldenCorpusEntry & {
  actual: ShoppingCategoryId | null;
  passed: boolean;
};

export type CalibrationReport = {
  classifierVersion: string;
  totalProducts: number;
  sonstigesCount: number;
  sonstigesShare: number;
  sourceCounts: { off_taxonomy: number; name_fallback: number; none: number };
  categoryDistribution: Record<ShoppingCategoryId, number>;
  samples: Record<ShoppingCategoryId, CategorySample[]>;
  golden: {
    total: number;
    passedCount: number;
    failed: GoldenResult[];
  };
};

const SAMPLE_SIZE_PER_CATEGORY = 100;

export const ALL_SHOPPING_CATEGORY_IDS: readonly ShoppingCategoryId[] = [
  'produce',
  'bakery',
  'deli_meat',
  'pantry_canned',
  'pantry_dry',
  'breakfast',
  'snacks',
  'beverages',
  'dairy',
  'frozen',
  'drugstore',
  'checkout',
];

/** Stabiler Hash fuer reihenfolgeunabhaengiges, reproduzierbares Sampling. */
function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function emptyCategoryRecord<T>(fill: () => T): Record<ShoppingCategoryId, T> {
  return Object.fromEntries(ALL_SHOPPING_CATEGORY_IDS.map((id) => [id, fill()])) as Record<
    ShoppingCategoryId,
    T
  >;
}

export function evaluateDump(
  products: readonly DumpProductInput[],
  golden: readonly GoldenCorpusEntry[],
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
      .slice(0, SAMPLE_SIZE_PER_CATEGORY)
      .map((entry) => entry.sample);
  }

  const goldenResults: GoldenResult[] = golden.map((entry) => {
    const actual = classifyCategory({
      name: entry.name,
      categoryTags: entry.categoryTags ?? [],
    }).categoryId;
    return { ...entry, actual, passed: actual === entry.expected };
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
