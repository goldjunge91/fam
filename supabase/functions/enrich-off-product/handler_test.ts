import { assertEquals } from 'jsr:@std/assert@1';

import { createEnrichOffProductHandler, type OffFetchResult, type UpdateResult } from './handler.ts';

const EAN = '4008400401027';

type Call = { ean: string; categoryTags: string[]; offLastModifiedAt: string };

function request(body: unknown) {
  return new Request('http://localhost/enrich-off-product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setup(options: {
  rateLimited?: boolean;
  offResult?: OffFetchResult;
  updateResult?: UpdateResult;
} = {}) {
  const {
    rateLimited = false,
    offResult = { ok: true, categoryTags: ['en:porks'], offLastModifiedAt: '2026-08-01T00:00:00.000Z' },
    updateResult = { error: null, count: 1 },
  } = options;

  const offCalls: string[] = [];
  const updateCalls: Call[] = [];
  const recordedAttempts: number[] = [];

  const handler = createEnrichOffProductHandler({
    isRateLimited: () => rateLimited,
    recordAttempt: () => {
      recordedAttempts.push(1);
    },
    fetchOffProduct: (ean) => {
      offCalls.push(ean);
      return Promise.resolve(offResult);
    },
    updateIfNewer: (ean, categoryTags, offLastModifiedAt) => {
      updateCalls.push({ ean, categoryTags, offLastModifiedAt });
      return Promise.resolve(updateResult);
    },
  });

  return { handler, offCalls, updateCalls, recordedAttempts };
}

Deno.test('rejects a non-POST request', async () => {
  const { handler } = setup();
  const response = await handler(new Request('http://localhost/enrich-off-product', { method: 'GET' }));
  assertEquals(response.status, 405);
});

Deno.test('rejects a missing EAN', async () => {
  const { handler, offCalls } = setup();
  const response = await handler(request({}));
  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: 'invalid_ean' });
  assertEquals(offCalls, []);
});

Deno.test('rejects a malformed EAN (non-numeric / falsche Länge) ohne OFF anzufragen', async () => {
  const { handler, offCalls } = setup();

  for (const bad of ['abc123', '12345', '123456789012345', '']) {
    const response = await handler(request({ ean: bad }));
    assertEquals(response.status, 400, `EAN "${bad}" sollte 400 liefern`);
  }
  assertEquals(offCalls, []);
});

Deno.test('ignoriert vom Client mitgeschickte Tags vollständig — laedt OFF-Daten selbst', async () => {
  const { handler, offCalls, updateCalls } = setup();

  const response = await handler(
    request({ ean: EAN, category_tags: ['en:fake-category'], off_last_modified_at: '2099-01-01T00:00:00.000Z' }),
  );

  assertEquals(response.status, 200);
  assertEquals(offCalls, [EAN]);
  // Die tatsaechlich gespeicherten Tags kommen aus fetchOffProduct(), nie aus dem Request-Body.
  assertEquals(updateCalls, [
    { ean: EAN, categoryTags: ['en:porks'], offLastModifiedAt: '2026-08-01T00:00:00.000Z' },
  ]);
});

Deno.test('übernimmt einen neueren OFF-Stand (DB meldet count: 1)', async () => {
  const { handler } = setup({ updateResult: { error: null, count: 1 } });
  const response = await handler(request({ ean: EAN }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { updated: true });
});

Deno.test('überschreibt keinen gleich alten oder neueren Stand (DB meldet count: 0)', async () => {
  const { handler, updateCalls } = setup({ updateResult: { error: null, count: 0 } });
  const response = await handler(request({ ean: EAN }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { updated: false, reason: 'not_newer_or_missing' });
  // Der Versuch wurde gemacht (atomare WHERE-Klausel entscheidet), nur eben abgelehnt.
  assertEquals(updateCalls.length, 1);
});

Deno.test('ein fehlgeschlagener OFF-Lookup verändert den Produktdatensatz nicht', async () => {
  const { handler, updateCalls } = setup({ offResult: { ok: false } });
  const response = await handler(request({ ean: EAN }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { updated: false, reason: 'off_lookup_failed' });
  assertEquals(updateCalls, []);
});

Deno.test('Rate-Limit blockiert den Aufruf, bevor OFF oder die DB angefasst werden — idempotent', async () => {
  const { handler, offCalls, updateCalls, recordedAttempts } = setup({ rateLimited: true });

  const first = await handler(request({ ean: EAN }));
  const second = await handler(request({ ean: EAN }));

  assertEquals(first.status, 200);
  assertEquals(await first.json(), { updated: false, reason: 'rate_limited' });
  assertEquals(second.status, 200);
  assertEquals(await second.json(), { updated: false, reason: 'rate_limited' });
  assertEquals(offCalls, []);
  assertEquals(updateCalls, []);
  assertEquals(recordedAttempts, []);
});

Deno.test('registriert einen Versuch nur, wenn tatsächlich versucht wurde (nicht bei Rate-Limit)', async () => {
  const { handler, recordedAttempts } = setup({ rateLimited: false });
  await handler(request({ ean: EAN }));
  assertEquals(recordedAttempts.length, 1);
});

Deno.test('ein DB-Fehler beim Update liefert 500, ohne einen falschen Erfolg vorzutäuschen', async () => {
  const { handler } = setup({ updateResult: { error: { message: 'connection lost' }, count: null } });
  const response = await handler(request({ ean: EAN }));

  assertEquals(response.status, 500);
  assertEquals(await response.json(), { error: 'update_failed', message: 'connection lost' });
});
