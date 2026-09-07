import { assertEquals } from "jsr:@std/assert@1";

import { fetchOffProduct, parseOffResponse } from "./off-client.ts";

Deno.test("parst eine erfolgreiche v3-Antwort mit Tags und Zeitstempel", () => {
  const result = parseOffResponse(200, {
    status: "success",
    product: {
      code: "4008400401027",
      categories_tags: ["en:breakfasts", "en:spreads"],
      last_modified_t: 1700000000,
    },
  });

  assertEquals(result, {
    ok: true,
    categoryTags: ["en:breakfasts", "en:spreads"],
    offLastModifiedAt: "2023-11-14T22:13:20.000Z",
  });
});

Deno.test("filtert Nicht-String-Einträge aus categories_tags", () => {
  const result = parseOffResponse(200, {
    status: "success",
    product: {
      categories_tags: ["en:porks", null, 42],
      last_modified_t: 1700000000,
    },
  });

  assertEquals(result.ok, true);
  if (result.ok) assertEquals(result.categoryTags, ["en:porks"]);
});

Deno.test("liefert leeres Array, wenn categories_tags fehlt", () => {
  const result = parseOffResponse(200, {
    status: "success",
    product: { last_modified_t: 1700000000 },
  });
  assertEquals(result.ok, true);
  if (result.ok) assertEquals(result.categoryTags, []);
});

Deno.test('nicht ok bei HTTP-Fehlerstatus (z.B. 404 "product_not_found")', () => {
  const result = parseOffResponse(404, {
    status: "failure",
    result: { id: "product_not_found" },
  });
  assertEquals(result, { ok: false, reason: "not_found" });
});

Deno.test('nicht ok, wenn status nicht "success" ist, selbst bei HTTP 200', () => {
  const result = parseOffResponse(200, {
    status: "failure",
    product: { categories_tags: [] },
  });
  assertEquals(result, { ok: false, reason: "upstream_error" });
});

Deno.test("nicht ok, wenn product fehlt", () => {
  const result = parseOffResponse(200, { status: "success" });
  assertEquals(result, { ok: false, reason: "upstream_error" });
});

Deno.test("nicht ok ohne gültigen last_modified_t — Vorsicht vor unbelegten Daten statt zu raten", () => {
  assertEquals(
    parseOffResponse(200, {
      status: "success",
      product: { categories_tags: ["en:porks"] },
    }),
    { ok: false, reason: "upstream_error" },
  );
  assertEquals(
    parseOffResponse(200, {
      status: "success",
      product: { categories_tags: ["en:porks"], last_modified_t: "kaputt" },
    }),
    { ok: false, reason: "upstream_error" },
  );
  assertEquals(
    parseOffResponse(200, {
      status: "success",
      product: { categories_tags: ["en:porks"], last_modified_t: -5 },
    }),
    { ok: false, reason: "upstream_error" },
  );
});

Deno.test("nicht ok bei kaputtem/unerwartetem Body (kein Objekt)", () => {
  assertEquals(parseOffResponse(200, null), {
    ok: false,
    reason: "upstream_error",
  });
  assertEquals(parseOffResponse(200, "kaputt"), {
    ok: false,
    reason: "upstream_error",
  });
  assertEquals(parseOffResponse(200, undefined), {
    ok: false,
    reason: "upstream_error",
  });
});

Deno.test("bricht einen haengenden OFF-Request per AbortSignal ab", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch =
    ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      })) as typeof fetch;

  try {
    assertEquals(await fetchOffProduct("4008400401027", 1), {
      ok: false,
      reason: "upstream_error",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
