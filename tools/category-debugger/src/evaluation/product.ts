import type { EvaluationProduct, EvaluationSplit } from './types';

type ProductSnapshotInput = {
  code: string | null;
  product_name: string;
  brand: string | null;
  quantity: string | null;
  categories_tags?: string | null;
};

export function parseCategoryTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === 'string')
      : [];
  } catch {
    return [];
  }
}

export function canonicalProductSnapshot(input: ProductSnapshotInput): string {
  return JSON.stringify({
    barcode: input.code?.trim() || null,
    name: input.product_name.trim(),
    brand: input.brand?.trim() || null,
    quantity: input.quantity?.trim() || null,
    categoryTags: [...parseCategoryTags(input.categories_tags)].sort(),
  });
}

export async function sha256Hex(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function splitForHash(hash: string): EvaluationSplit {
  return Number.parseInt(hash.slice(0, 8), 16) % 5 === 0 ? 'holdout' : 'calibration';
}

export async function evaluationProductOf(input: ProductSnapshotInput): Promise<EvaluationProduct> {
  const snapshot = canonicalProductSnapshot(input);
  const snapshotHash = await sha256Hex(snapshot);
  const barcode = input.code?.trim() || null;
  const productKey = barcode ? `barcode:${barcode}` : `content:${snapshotHash}`;
  const splitHash = await sha256Hex(productKey);

  return {
    productKey,
    snapshotHash,
    barcode,
    name: input.product_name.trim(),
    brand: input.brand?.trim() || null,
    quantity: input.quantity?.trim() || null,
    categoryTags: parseCategoryTags(input.categories_tags),
    split: splitForHash(splitHash),
  };
}

