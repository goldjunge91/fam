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

import type { OffFetchResult } from "./handler.ts";

const OFF_USER_AGENT = "FamApp-Backend/1.0 (contact@fam.app)";
export const DEFAULT_OFF_FETCH_TIMEOUT_MS = 10_000;

export function resolveOffFetchTimeoutMs(
  configuredTimeoutMs: string | undefined,
  cacheLeaseSeconds: number,
): number {
  if (!Number.isFinite(cacheLeaseSeconds) || cacheLeaseSeconds <= 0) {
    throw new Error(
      "OFF_ENRICHMENT_CACHE_LEASE_SECONDS muss positiv und endlich sein.",
    );
  }

  const timeoutMs = configuredTimeoutMs === undefined
    ? DEFAULT_OFF_FETCH_TIMEOUT_MS
    : Number(configuredTimeoutMs);
  const cacheLeaseMs = cacheLeaseSeconds * 1_000;
  if (
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs >= cacheLeaseMs
  ) {
    throw new Error(
      "OFF_ENRICHMENT_FETCH_TIMEOUT_MS muss positiv und kürzer als die Cache-Lease sein.",
    );
  }
  return timeoutMs;
}

/**
 * Parst eine rohe OFF-v3-Antwort. Verlangt sowohl `status: "success"` als
 * auch einen gültigen `last_modified_t` — ohne echten Zeitstempel lässt
 * sich "neuer als der gespeicherte Stand" nicht beurteilen, also lieber gar
 * nicht aktualisieren als raten (dieselbe Vorsicht wie beim Klassifikator:
 * lieber kein Update als ein falsches).
 */
export function parseOffResponse(
  httpStatus: number,
  body: unknown,
): OffFetchResult {
  if (httpStatus === 404) return { ok: false, reason: "not_found" };
  if (httpStatus !== 200) return { ok: false, reason: "upstream_error" };
  if (!body || typeof body !== "object") {
    return { ok: false, reason: "upstream_error" };
  }

  const data = body as Record<string, unknown>;
  if (data.status !== "success") {
    const result = data.result;
    return result === "product_not_found" ||
        (result && typeof result === "object" &&
          (result as Record<string, unknown>).id === "product_not_found")
      ? { ok: false, reason: "not_found" }
      : { ok: false, reason: "upstream_error" };
  }

  const product = data.product;
  if (!product || typeof product !== "object") {
    return { ok: false, reason: "upstream_error" };
  }
  const productData = product as Record<string, unknown>;

  const rawTags = Array.isArray(productData.categories_tags)
    ? productData.categories_tags
    : [];
  const categoryTags = rawTags.filter((tag): tag is string =>
    typeof tag === "string"
  );

  const lastModifiedT = Number(productData.last_modified_t);
  if (!Number.isFinite(lastModifiedT) || lastModifiedT <= 0) {
    return { ok: false, reason: "upstream_error" };
  }

  return {
    ok: true,
    categoryTags,
    offLastModifiedAt: new Date(lastModifiedT * 1000).toISOString(),
  };
}

export async function fetchOffProduct(
  ean: string,
  timeoutMs = DEFAULT_OFF_FETCH_TIMEOUT_MS,
): Promise<OffFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://world.openfoodfacts.org/api/v3/product/${
      encodeURIComponent(ean)
    }.json?fields=code,categories_tags,last_modified_t`;
    const res = await fetch(url, {
      headers: { "User-Agent": OFF_USER_AGENT },
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    return parseOffResponse(res.status, body);
  } catch {
    return { ok: false, reason: "upstream_error" };
  } finally {
    clearTimeout(timeout);
  }
}
