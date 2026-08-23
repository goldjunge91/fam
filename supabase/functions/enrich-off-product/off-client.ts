/** Eigenstaendiger Deno-kompatibler OFF-v3-Client fuer die Edge Function. */

import type { OffFetchResult } from './handler.ts';

const OFF_USER_AGENT = 'FamApp-Backend/1.0 (contact@fam.app)';

/** Verwirft Antworten ohne gueltigen Zeitstempel fuer den Neuheitsvergleich. */
export function parseOffResponse(httpStatus: number, body: unknown): OffFetchResult {
  if (httpStatus !== 200) return { ok: false };
  if (!body || typeof body !== 'object') return { ok: false };

  const data = body as Record<string, unknown>;
  if (data.status !== 'success') return { ok: false };

  const product = data.product;
  if (!product || typeof product !== 'object') return { ok: false };
  const productData = product as Record<string, unknown>;

  const rawTags = Array.isArray(productData.categories_tags) ? productData.categories_tags : [];
  const categoryTags = rawTags.filter((tag): tag is string => typeof tag === 'string');

  const lastModifiedT = Number(productData.last_modified_t);
  if (!Number.isFinite(lastModifiedT) || lastModifiedT <= 0) return { ok: false };

  return {
    ok: true,
    categoryTags,
    offLastModifiedAt: new Date(lastModifiedT * 1000).toISOString(),
  };
}

export async function fetchOffProduct(ean: string): Promise<OffFetchResult> {
  try {
    const url = `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(ean)}.json?fields=code,categories_tags,last_modified_t`;
    const res = await fetch(url, { headers: { 'User-Agent': OFF_USER_AGENT } });
    const body = await res.json().catch(() => null);
    return parseOffResponse(res.status, body);
  } catch {
    return { ok: false };
  }
}
