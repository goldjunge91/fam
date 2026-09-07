// @ts-nocheck deno-lint-ignore-file
import { createClient } from "jsr:@supabase/supabase-js@2";

import {
  type AuthenticationResult,
  createEnrichOffProductHandler,
  type OffCacheClaim,
  type OffFetchResult,
} from "./handler.ts";
import { fetchOffProduct, resolveOffFetchTimeoutMs } from "./off-client.ts";
import { SlidingWindowRateLimiter } from "./rate-limiter.ts";

/**
 * Wird ausschließlich von eingeloggten Nutzern der App aufgerufen (Standard-
 * JWT-Verifikation der Edge Runtime läuft davor bereits — kein Eintrag in
 * config.toml, `verify_jwt` bleibt auf dem Default `true`, wie bei
 * `delete-account`). Welcher Nutzer ruft, spielt keine Rolle: `products` ist
 * global, die Anreicherung ist nicht haushaltsgebunden.
 *
 * Der dauerhafte Nutzergrenzwert wird zusaetzlich zum prozesslokalen Upstream-
 * Schutz ueber `public.consume_request_limit()` erzwungen. Die RPC-Pruefung
 * laeuft ueber den Service-Role-Client, damit alle Edge-Isolates denselben
 * atomaren Zaehler verwenden.
 */
const userRateLimit = Number(Deno.env.get("OFF_ENRICHMENT_RATE_LIMIT") ?? 12);
const userRateWindowSeconds = Number(
  Deno.env.get("OFF_ENRICHMENT_RATE_WINDOW_SECONDS") ?? 60,
);
const upstreamRateLimiter = new SlidingWindowRateLimiter(
  Number(Deno.env.get("OFF_UPSTREAM_RATE_LIMIT") ?? 12),
  60_000,
);
const cacheTtlSeconds = Number(
  Deno.env.get("OFF_ENRICHMENT_CACHE_TTL_SECONDS") ?? 86_400,
);
const cacheLeaseSeconds = Number(
  Deno.env.get("OFF_ENRICHMENT_CACHE_LEASE_SECONDS") ?? 30,
);
const offFetchTimeoutMs = resolveOffFetchTimeoutMs(
  Deno.env.get("OFF_ENRICHMENT_FETCH_TIMEOUT_MS"),
  cacheLeaseSeconds,
);

const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  serviceRoleKey,
);

function firstRow<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function authenticate(request: Request): Promise<AuthenticationResult> {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return { ok: false, status: 401, error: "missing_authorization" };
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY")!,
    { global: { headers: { Authorization: authorization } } },
  );
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true, userId: data.user.id };
}

async function checkRequestLimit(userId: string) {
  const { data, error } = await adminClient.rpc("consume_request_limit", {
    p_user_id: userId,
    p_scope: "off-enrichment",
    p_limit: userRateLimit,
    p_window_seconds: userRateWindowSeconds,
  });
  if (error) throw new Error(error.message);
  const row = firstRow(
    data as unknown as Array<{ allowed: boolean; retry_after: number }>,
  );
  if (!row || typeof row.allowed !== "boolean") {
    throw new Error("invalid rate limit response");
  }
  return {
    allowed: row.allowed,
    retryAfter: Number.isFinite(row.retry_after)
      ? Math.max(1, row.retry_after)
      : null,
  };
}

async function claimCache(ean: string): Promise<OffCacheClaim> {
  const { data, error } = await adminClient.rpc("claim_off_enrichment_cache", {
    p_ean: ean,
    p_lease_seconds: cacheLeaseSeconds,
  });
  if (error) throw new Error(error.message);
  const row = firstRow(data as unknown as Array<Record<string, unknown>>);
  if (!row || typeof row.state !== "string") {
    throw new Error("invalid cache claim response");
  }
  if (row.state === "claimed" && typeof row.lease_token === "string") {
    return { state: "claimed", leaseToken: row.lease_token };
  }
  if (
    row.state === "hit" &&
    (row.lookup_status === "success" || row.lookup_status === "not_found")
  ) {
    return {
      state: "hit",
      lookupStatus: row.lookup_status,
      categoryTags: Array.isArray(row.category_tags)
        ? row.category_tags.filter((tag): tag is string =>
          typeof tag === "string"
        )
        : [],
      offLastModifiedAt: typeof row.off_last_modified_at === "string"
        ? row.off_last_modified_at
        : null,
    };
  }
  if (row.state === "in_flight") {
    const retryAfter = Number(row.retry_after);
    return {
      state: "in_flight",
      retryAfter: Number.isFinite(retryAfter) ? Math.max(1, retryAfter) : 1,
    };
  }
  throw new Error("invalid cache claim state");
}

async function storeCache(
  ean: string,
  leaseToken: string,
  result: OffFetchResult,
) {
  const { data, error } = await adminClient.rpc("store_off_enrichment_cache", {
    p_ean: ean,
    p_lease_token: leaseToken,
    p_lookup_status: result.ok ? "success" : "not_found",
    p_category_tags: result.ok ? result.categoryTags : [],
    p_off_last_modified_at: result.ok ? result.offLastModifiedAt : null,
    p_ttl_seconds: cacheTtlSeconds,
  });
  if (error) throw new Error(error.message);
  return firstRow(data as unknown as boolean[] | boolean) === true;
}

async function releaseCache(ean: string, leaseToken: string) {
  const { data, error } = await adminClient.rpc(
    "release_off_enrichment_cache",
    {
      p_ean: ean,
      p_lease_token: leaseToken,
    },
  );
  if (error) return false;
  return firstRow(data as unknown as boolean[] | boolean) === true;
}

Deno.serve(
  createEnrichOffProductHandler({
    authenticate,
    checkRequestLimit,
    isRateLimited: () => upstreamRateLimiter.isLimited(),
    recordAttempt: () => upstreamRateLimiter.record(),
    fetchOffProduct: (ean) => fetchOffProduct(ean, offFetchTimeoutMs),
    claimCache,
    storeCache,
    releaseCache,
    updateIfNewer: async (ean, categoryTags, offLastModifiedAt) => {
      const { error, count } = await adminClient
        .from("products")
        .update(
          {
            off_category_tags: categoryTags,
            off_last_modified_at: offLastModifiedAt,
          },
          { count: "exact" },
        )
        .eq("barcode", ean)
        .eq("source", "off")
        .or(
          `off_last_modified_at.is.null,off_last_modified_at.lt.${offLastModifiedAt}`,
        );

      return { error, count };
    },
  }),
);
