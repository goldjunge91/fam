/**
 * Vertrauenswürdige serverseitige Anreicherung globaler OFF-Produktdaten
 * (#223 Paket 10, Abschnitt 4 in docs/issue#223_V2.md — "Vertrauenswürdige
 * Aktualisierung globaler OFF-Produkte").
 *
 * Die bestehende RLS-Regel (siehe supabase/tests/05_products.test.sql,
 * "OFF-Metadaten nur vom Backend pflegen") verbietet Clients JEDE direkte
 * Änderung an `off_category_tags`/`off_last_modified_at` — auch dem
 * Anleger des Platzhalters. Diese Function ist der einzige Weg, wie diese
 * Felder je aktualisiert werden: sie nimmt vom Client ausschließlich die
 * EAN entgegen, lädt die Taxonomie-Daten SELBST von Open Food Facts (siehe
 * Glossar "Externe Produktdatenbank (OFF / Open Food Facts)" in AGENTS.md)
 * und verwirft alles, was der Client sonst an Produktdaten mitschickt.
 */

/** Ergebnis des eigenen OFF-Lookups — nie aus Client-Eingaben abgeleitet. */
export type OffFetchResult =
  | { ok: true; categoryTags: string[]; offLastModifiedAt: string }
  | { ok: false; reason?: "not_found" | "upstream_error" };

export type UpdateResult = {
  error: { message: string } | null;
  /**
   * `null` bei einem echten DB-Fehler; `0`, wenn die atomare
   * "nur wenn neuer"-Bedingung nicht griff (kein passendes Produkt oder
   * vorhandener Stand nicht älter) — beides kein Fehler, nur kein Update.
   */
  count: number | null;
};

export type AuthenticationResult =
  | { ok: true; userId: string }
  | {
    ok: false;
    status: 401 | 500;
    error: "missing_authorization" | "unauthorized" | "auth_failed";
  };

export type RequestLimitResult = {
  allowed: boolean;
  retryAfter: number | null;
};

export type OffCacheClaim =
  | {
    state: "claimed";
    leaseToken: string;
  }
  | {
    state: "hit";
    lookupStatus: "success" | "not_found";
    categoryTags: string[];
    offLastModifiedAt: string | null;
  }
  | {
    state: "in_flight";
    retryAfter: number;
  };

type Dependencies = {
  authenticate: (req: Request) => Promise<AuthenticationResult>;
  checkRequestLimit: (userId: string) => Promise<RequestLimitResult>;
  /** Geteilter, prozessweiter Zustand (nicht pro EAN) — schützt das eigene
   * Aufrufbudget gegenüber Open Food Facts, nicht einzelne Nutzer. */
  isRateLimited: () => boolean;
  recordAttempt: () => void;
  fetchOffProduct: (ean: string) => Promise<OffFetchResult>;
  claimCache: (ean: string) => Promise<OffCacheClaim>;
  storeCache: (
    ean: string,
    leaseToken: string,
    result: OffFetchResult,
  ) => Promise<boolean>;
  releaseCache: (ean: string, leaseToken: string) => Promise<boolean>;
  /**
   * Atomares `UPDATE ... WHERE barcode = ean AND source = 'off' AND
   * (off_last_modified_at IS NULL OR off_last_modified_at < offLastModifiedAt)`.
   * Race-frei per Konstruktion: zwei gleichzeitige Aufrufe für dieselbe EAN
   * können sich nicht gegenseitig mit einem älteren Stand überschreiben,
   * ohne dass ein zusätzlicher Read-then-Write nötig wäre.
   */
  updateIfNewer: (
    ean: string,
    categoryTags: string[],
    offLastModifiedAt: string,
  ) => Promise<UpdateResult>;
};

const EAN_PATTERN = /^\d{6,14}$/;

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const JSON_HEADERS = { "Content-Type": "application/json" };

function json(body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, ...JSON_HEADERS, ...extraHeaders },
  });
}

/**
 * Baut den HTTP-Handler getrennt vom Deno-Einstiegspunkt (dasselbe Muster
 * wie `revenuecat-webhook/handler.ts`) — Rate-Limiting, OFF-Lookup und
 * DB-Zugriff sind austauschbare Abhängigkeiten, der Handler selbst läuft
 * ohne Netzwerk oder echte Datenbank testbar.
 */
export function createEnrichOffProductHandler({
  authenticate,
  checkRequestLimit,
  isRateLimited,
  recordAttempt,
  fetchOffProduct,
  claimCache,
  storeCache,
  releaseCache,
  updateIfNewer,
}: Dependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    let auth: AuthenticationResult;
    try {
      auth = await authenticate(req);
    } catch {
      return json({ error: "auth_failed" }, 500);
    }
    if (!auth.ok) {
      return json({ error: auth.error }, auth.status);
    }

    let ean: string;
    try {
      const body: unknown = await req.json();
      const candidate = body && typeof body === "object"
        ? (body as Record<string, unknown>).ean
        : undefined;
      if (typeof candidate !== "string" || !EAN_PATTERN.test(candidate)) {
        throw new Error("invalid ean");
      }
      ean = candidate;
    } catch {
      // Absichtlich EINZIGES Feld, das aus dem Request-Body gelesen wird —
      // alles andere (z.B. vom Client behauptete category_tags) existiert
      // fuer diese Function schlicht nicht.
      return json({ error: "invalid_ean" }, 400);
    }

    let requestLimit: RequestLimitResult;
    try {
      requestLimit = await checkRequestLimit(auth.userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: "rate_limit_failed", message }, 500);
    }
    if (!requestLimit.allowed) {
      const retryAfter = Math.max(1, requestLimit.retryAfter ?? 60);
      return new Response(
        JSON.stringify({
          updated: false,
          reason: "rate_limited",
          retry_after: retryAfter,
        }),
        {
          status: 429,
          headers: {
            ...CORS_HEADERS,
            ...JSON_HEADERS,
            "Retry-After": String(retryAfter),
          },
        },
      );
    }

    // Sowohl der OFF-Lookup (Netzwerk zu Open Food Facts) als auch der DB-
    // Zugriff (Netzwerk zu Supabase) koennen bei einer Infrastruktur-Stoerung
    // werfen statt ihr dokumentiertes { ok: false }/{ error, count } zu
    // liefern (z.B. Timeout, Connection Reset) — ohne dieses try/catch wuerde
    // ein einzelner Netzwerkfehler als unbehandelte Exception aus dem Handler
    // fallen, statt als strukturierte 500-Antwort wie jeder andere Fehlerpfad
    // hier.
    let leaseToken: string | null = null;
    const releaseLease = async () => {
      if (!leaseToken) return;
      const token = leaseToken;
      leaseToken = null;
      await releaseCache(ean, token).catch(() => false);
    };

    try {
      const claim = await claimCache(ean);
      if (claim.state === "in_flight") {
        return json({
          updated: false,
          reason: "in_flight",
          retry_after: claim.retryAfter,
        }, 202);
      }

      if (claim.state === "claimed") {
        leaseToken = claim.leaseToken;
      }

      if (claim.state === "hit") {
        if (claim.lookupStatus === "not_found") {
          return json({ updated: false, reason: "off_not_found" });
        }
        if (!claim.offLastModifiedAt) {
          return json({ error: "invalid_cache_entry" }, 500);
        }
        const result = await updateIfNewer(
          ean,
          claim.categoryTags,
          claim.offLastModifiedAt,
        );
        if (result.error) {
          return json(
            { error: "update_failed", message: result.error.message },
            500,
          );
        }
        return result.count ? json({ updated: true, cached: true }) : json({
          updated: false,
          reason: "not_newer_or_missing",
          cached: true,
        });
      }

      // This is the only path that reaches Open Food Facts. The process-local
      // guard remains useful as a safety net for the provider's per-IP budget;
      // the durable user limit above is the application abuse boundary.
      if (isRateLimited()) {
        await releaseLease();
        return json({ updated: false, reason: "upstream_rate_limited" }, 429);
      }
      recordAttempt();

      const offResult = await fetchOffProduct(ean);
      if (!offResult.ok) {
        if (offResult.reason === "not_found") {
          const stored = await storeCache(ean, claim.leaseToken, offResult);
          if (!stored) {
            await releaseLease();
            return json({ error: "cache_store_failed" }, 500);
          }
          leaseToken = null;
          return json({ updated: false, reason: "off_not_found" });
        }
        await releaseLease();
        return json({ updated: false, reason: "off_lookup_failed" });
      }

      const result = await updateIfNewer(
        ean,
        offResult.categoryTags,
        offResult.offLastModifiedAt,
      );

      if (result.error) {
        await releaseLease();
        return json(
          { error: "update_failed", message: result.error.message },
          500,
        );
      }

      const stored = await storeCache(ean, claim.leaseToken, offResult);
      if (!stored) {
        await releaseLease();
        return json({ error: "cache_store_failed" }, 500);
      }
      leaseToken = null;

      if (!result.count) {
        return json({ updated: false, reason: "not_newer_or_missing" });
      }

      return json({ updated: true });
    } catch (err) {
      await releaseLease();
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: "internal_error", message }, 500);
    }
  };
}
