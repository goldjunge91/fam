import { assertEquals } from "jsr:@std/assert@1";

import {
  type AuthenticationResult,
  createEnrichOffProductHandler,
  type OffCacheClaim,
  type OffFetchResult,
  type UpdateResult,
} from "./handler.ts";

const EAN = "4008400401027";

type Call = { ean: string; categoryTags: string[]; offLastModifiedAt: string };

function request(body: unknown) {
  return new Request("http://localhost/enrich-off-product", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setup(options: {
  rateLimited?: boolean;
  requestLimited?: boolean;
  offResult?: OffFetchResult;
  updateResult?: UpdateResult;
  cacheClaim?: OffCacheClaim;
  cacheStoreResult?: boolean;
  fetchError?: Error;
  authResult?: AuthenticationResult;
} = {}) {
  const {
    rateLimited = false,
    requestLimited = false,
    offResult = {
      ok: true,
      categoryTags: ["en:porks"],
      offLastModifiedAt: "2026-08-01T00:00:00.000Z",
    },
    updateResult = { error: null, count: 1 },
    cacheClaim = { state: "claimed", leaseToken: "lease-1" } as OffCacheClaim,
    cacheStoreResult = true,
    fetchError,
    authResult = {
      ok: true as const,
      userId: "11111111-1111-1111-1111-111111111111",
    },
  } = options;

  const offCalls: string[] = [];
  const updateCalls: Call[] = [];
  const recordedAttempts: number[] = [];
  const releasedLeases: string[] = [];
  const requestLimitCalls: string[] = [];
  const cacheClaims: string[] = [];
  const storedResults: OffFetchResult[] = [];

  const handler = createEnrichOffProductHandler({
    authenticate: async () => authResult,
    checkRequestLimit: async (userId) => {
      requestLimitCalls.push(userId);
      return { allowed: !requestLimited, retryAfter: 17 };
    },
    isRateLimited: () => rateLimited,
    recordAttempt: () => {
      recordedAttempts.push(1);
    },
    fetchOffProduct: (ean) => {
      offCalls.push(ean);
      if (fetchError) return Promise.reject(fetchError);
      return Promise.resolve(offResult);
    },
    updateIfNewer: (ean, categoryTags, offLastModifiedAt) => {
      updateCalls.push({ ean, categoryTags, offLastModifiedAt });
      return Promise.resolve(updateResult);
    },
    claimCache: async (ean): Promise<OffCacheClaim> => {
      cacheClaims.push(ean);
      return cacheClaim;
    },
    storeCache: async (_ean, _leaseToken, result) => {
      storedResults.push(result);
      return cacheStoreResult;
    },
    releaseCache: async (_ean, leaseToken) => {
      releasedLeases.push(leaseToken);
      return true;
    },
  });

  return {
    handler,
    offCalls,
    updateCalls,
    recordedAttempts,
    releasedLeases,
    requestLimitCalls,
    cacheClaims,
    storedResults,
  };
}

Deno.test("rejects a non-POST request", async () => {
  const { handler } = setup();
  const response = await handler(
    new Request("http://localhost/enrich-off-product", { method: "GET" }),
  );
  assertEquals(response.status, 405);
});

Deno.test("weist nicht authentifizierte Requests vor Limit, Cache und OFF ab", async () => {
  const { handler, requestLimitCalls, cacheClaims, offCalls, updateCalls } =
    setup({
      authResult: { ok: false, status: 401, error: "unauthorized" },
    });
  const response = await handler(request({ ean: EAN }));

  assertEquals(response.status, 401);
  assertEquals(await response.json(), { error: "unauthorized" });
  assertEquals(requestLimitCalls, []);
  assertEquals(cacheClaims, []);
  assertEquals(offCalls, []);
  assertEquals(updateCalls, []);
});

Deno.test("rejects a missing EAN", async () => {
  const { handler, offCalls } = setup();
  const response = await handler(request({}));
  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: "invalid_ean" });
  assertEquals(offCalls, []);
});

Deno.test("rejects a malformed EAN (non-numeric / falsche Länge) ohne OFF anzufragen", async () => {
  const { handler, offCalls } = setup();

  for (const bad of ["abc123", "12345", "123456789012345", ""]) {
    const response = await handler(request({ ean: bad }));
    assertEquals(response.status, 400, `EAN "${bad}" sollte 400 liefern`);
  }
  assertEquals(offCalls, []);
});

Deno.test("ignoriert vom Client mitgeschickte Tags vollständig — laedt OFF-Daten selbst", async () => {
  const { handler, offCalls, updateCalls } = setup();

  const response = await handler(
    request({
      ean: EAN,
      category_tags: ["en:fake-category"],
      off_last_modified_at: "2099-01-01T00:00:00.000Z",
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(offCalls, [EAN]);
  // Die tatsaechlich gespeicherten Tags kommen aus fetchOffProduct(), nie aus dem Request-Body.
  assertEquals(updateCalls, [
    {
      ean: EAN,
      categoryTags: ["en:porks"],
      offLastModifiedAt: "2026-08-01T00:00:00.000Z",
    },
  ]);
});

Deno.test("übernimmt einen neueren OFF-Stand (DB meldet count: 1)", async () => {
  const { handler } = setup({ updateResult: { error: null, count: 1 } });
  const response = await handler(request({ ean: EAN }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { updated: true });
});

Deno.test("überschreibt keinen gleich alten oder neueren Stand (DB meldet count: 0)", async () => {
  const { handler, updateCalls } = setup({
    updateResult: { error: null, count: 0 },
  });
  const response = await handler(request({ ean: EAN }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    updated: false,
    reason: "not_newer_or_missing",
  });
  // Der Versuch wurde gemacht (atomare WHERE-Klausel entscheidet), nur eben abgelehnt.
  assertEquals(updateCalls.length, 1);
});

Deno.test("ein fehlgeschlagener OFF-Lookup verändert den Produktdatensatz nicht", async () => {
  const { handler, updateCalls } = setup({ offResult: { ok: false } });
  const response = await handler(request({ ean: EAN }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    updated: false,
    reason: "off_lookup_failed",
  });
  assertEquals(updateCalls, []);
});

Deno.test("Rate-Limit blockiert den Aufruf, bevor OFF oder die DB angefasst werden — idempotent", async () => {
  const { handler, offCalls, updateCalls, recordedAttempts } = setup({
    rateLimited: true,
  });

  const first = await handler(request({ ean: EAN }));
  const second = await handler(request({ ean: EAN }));

  assertEquals(first.status, 429);
  assertEquals(await first.json(), {
    updated: false,
    reason: "upstream_rate_limited",
  });
  assertEquals(second.status, 429);
  assertEquals(await second.json(), {
    updated: false,
    reason: "upstream_rate_limited",
  });
  assertEquals(offCalls, []);
  assertEquals(updateCalls, []);
  assertEquals(recordedAttempts, []);
});

Deno.test("gemeinsames Nutzerlimit blockiert vor Cache und OFF", async () => {
  const { handler, offCalls, updateCalls, recordedAttempts } = setup({
    requestLimited: true,
  });
  const response = await handler(request({ ean: EAN }));

  assertEquals(response.status, 429);
  assertEquals(await response.json(), {
    updated: false,
    reason: "rate_limited",
    retry_after: 17,
  });
  assertEquals(response.headers.get("Retry-After"), "17");
  assertEquals(offCalls, []);
  assertEquals(updateCalls, []);
  assertEquals(recordedAttempts, []);
});

Deno.test("verwendet einen frischen positiven Cache-Treffer ohne OFF-Aufruf", async () => {
  const { handler, offCalls, updateCalls, recordedAttempts } = setup({
    cacheClaim: {
      state: "hit",
      lookupStatus: "success",
      categoryTags: ["en:dairy"],
      offLastModifiedAt: "2026-08-02T00:00:00.000Z",
    },
  });
  const response = await handler(request({ ean: EAN }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { updated: true, cached: true });
  assertEquals(offCalls, []);
  assertEquals(recordedAttempts, []);
  assertEquals(updateCalls, [
    {
      ean: EAN,
      categoryTags: ["en:dairy"],
      offLastModifiedAt: "2026-08-02T00:00:00.000Z",
    },
  ]);
});

Deno.test("behandelt einen aktiven EAN-Lease ohne parallelen OFF-Aufruf", async () => {
  const { handler, offCalls, updateCalls } = setup({
    cacheClaim: { state: "in_flight", retryAfter: 9 },
  });
  const response = await handler(request({ ean: EAN }));

  assertEquals(response.status, 202);
  assertEquals(await response.json(), {
    updated: false,
    reason: "in_flight",
    retry_after: 9,
  });
  assertEquals(offCalls, []);
  assertEquals(updateCalls, []);
});

Deno.test("liefert einen gecachten OFF-Nichtfund ohne erneute Provider-Anfrage", async () => {
  const { handler, offCalls, updateCalls, storedResults } = setup({
    cacheClaim: {
      state: "hit",
      lookupStatus: "not_found",
      categoryTags: [],
      offLastModifiedAt: null,
    },
  });
  const response = await handler(request({ ean: EAN }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    updated: false,
    reason: "off_not_found",
  });
  assertEquals(offCalls, []);
  assertEquals(updateCalls, []);
  assertEquals(storedResults, []);
});

Deno.test("speichert einen echten OFF-Nichtfund, aber keinen transienten Fehler", async () => {
  const { handler, storedResults, releasedLeases } = setup({
    offResult: { ok: false, reason: "not_found" },
  });
  const response = await handler(request({ ean: EAN }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    updated: false,
    reason: "off_not_found",
  });
  assertEquals(storedResults, [{ ok: false, reason: "not_found" }]);
  assertEquals(releasedLeases, []);
});

Deno.test("gibt einen Lease bei einem transienten Fehler frei", async () => {
  const { handler, releasedLeases, storedResults } = setup({
    fetchError: new Error("OFF timeout"),
  });
  const response = await handler(request({ ean: EAN }));

  assertEquals(response.status, 500);
  assertEquals(await response.json(), {
    error: "internal_error",
    message: "OFF timeout",
  });
  assertEquals(releasedLeases, ["lease-1"]);
  assertEquals(storedResults, []);
});

Deno.test("registriert einen Versuch nur, wenn tatsächlich versucht wurde (nicht bei Rate-Limit)", async () => {
  const { handler, recordedAttempts } = setup({ rateLimited: false });
  await handler(request({ ean: EAN }));
  assertEquals(recordedAttempts.length, 1);
});

Deno.test("ein DB-Fehler beim Update liefert 500, ohne einen falschen Erfolg vorzutäuschen", async () => {
  const { handler } = setup({
    updateResult: { error: { message: "connection lost" }, count: null },
  });
  const response = await handler(request({ ean: EAN }));

  assertEquals(response.status, 500);
  assertEquals(await response.json(), {
    error: "update_failed",
    message: "connection lost",
  });
});
