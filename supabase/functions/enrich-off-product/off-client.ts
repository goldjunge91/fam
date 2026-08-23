/**
 * Eigenständiger OFF-Lookup für die serverseitige Anreicherung (#223 Paket
 * 10). Nutzt bewusst die OFF-Produkt-API v3 (siehe Abschnitt 6,
 * "Barcode-Lookup: ... aktuelle OFF-Produkt-API v3.6") statt der v2-API, die
 * der App-Client noch verwendet — unabhängige Implementierungen, kein
 * gemeinsamer Import zwischen Deno (Edge Function) und React Native möglich.
 *
 * `parseOffResponse()` ist bewusst von `fetch()` getrennt: reine Funktion,
 * ohne Netzwerk testbar (dieselbe Architektur wie `formatOFFProduct()` in
 * src/lib/open-food-facts.ts für den Client).
 */

import type { OffFetchResult } from './handler.ts';

const OFF_USER_AGENT = 'FamApp-Backend/1.0 (contact@fam.app)';

/**
 * Parst eine rohe OFF-v3-Antwort. Verlangt sowohl `status: "success"` als
 * auch einen gültigen `last_modified_t` — ohne echten Zeitstempel lässt
 * sich "neuer als der gespeicherte Stand" nicht beurteilen, also lieber gar
 * nicht aktualisieren als raten (dieselbe Vorsicht wie beim Klassifikator:
 * lieber kein Update als ein falsches).
 */
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
