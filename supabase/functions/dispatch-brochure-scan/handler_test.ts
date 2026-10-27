import { createBrochureDispatchHandler } from './handler.ts';

const WEBHOOK_SECRET = 'test-brochure-webhook-secret';
const GITHUB_TOKEN = 'test-github-workflow-token';
const VALID_EVENT = {
  type: 'INSERT',
  schema: 'public',
  table: 'brochure_zip_scans',
  record: {
    zip_code: '22043',
    requested_at: '2026-10-26T12:32:15.122062Z',
    last_successful_at: null,
    last_error: null,
  },
};

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
  }
}

function webhookRequest(body: unknown, secret = WEBHOOK_SECRET) {
  return new Request('https://project.example/functions/v1/dispatch-brochure-scan', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-brochure-dispatch-secret': secret,
    },
    body: JSON.stringify(body),
  });
}

Deno.test('dispatches exactly the postal code from the pending database row', async () => {
  let dispatchedBody: unknown;
  const handler = createBrochureDispatchHandler({
    webhookSecret: WEBHOOK_SECRET,
    githubToken: GITHUB_TOKEN,
    fetcher: (input, init) => {
      assertEquals(
        input,
        'https://api.github.com/repos/goldjunge91/fam/actions/workflows/scrape-brochures.yml/dispatches',
      );
      dispatchedBody = JSON.parse(String(init?.body));
      return Promise.resolve(new Response(null, { status: 200 }));
    },
  });

  const result = await handler(webhookRequest(VALID_EVENT));

  assertEquals(result.status, 202);
  assertEquals(dispatchedBody, {
    ref: 'main',
    inputs: { zip: '22043' },
  });
});

Deno.test('accepts a no-content response from GitHub workflow dispatch', async () => {
  const handler = createBrochureDispatchHandler({
    webhookSecret: WEBHOOK_SECRET,
    githubToken: GITHUB_TOKEN,
    fetcher: () => Promise.resolve(new Response(null, { status: 204 })),
  });

  const result = await handler(webhookRequest(VALID_EVENT));

  assertEquals(result.status, 202);
});

Deno.test('rejects requests without the database webhook secret', async () => {
  let dispatchCount = 0;
  const handler = createBrochureDispatchHandler({
    webhookSecret: WEBHOOK_SECRET,
    githubToken: GITHUB_TOKEN,
    fetcher: () => {
      dispatchCount += 1;
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  });

  const result = await handler(webhookRequest(VALID_EVENT, 'wrong-secret'));

  assertEquals(result.status, 401);
  assertEquals(dispatchCount, 0);
});

Deno.test('ignores webhook events for scans that are already complete', async () => {
  let dispatchCount = 0;
  const handler = createBrochureDispatchHandler({
    webhookSecret: WEBHOOK_SECRET,
    githubToken: GITHUB_TOKEN,
    fetcher: () => {
      dispatchCount += 1;
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  });
  const completedEvent = {
    ...VALID_EVENT,
    record: {
      ...VALID_EVENT.record,
      last_successful_at: '2026-10-26T12:32:16.000000Z',
    },
  };

  const result = await handler(webhookRequest(completedEvent));

  assertEquals(result.status, 204);
  assertEquals(dispatchCount, 0);
});

Deno.test('rejects malformed or non-PLZ dispatch payloads', async () => {
  let dispatchCount = 0;
  const handler = createBrochureDispatchHandler({
    webhookSecret: WEBHOOK_SECRET,
    githubToken: GITHUB_TOKEN,
    fetcher: () => {
      dispatchCount += 1;
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  });
  const malformedEvent = {
    ...VALID_EVENT,
    record: { ...VALID_EVENT.record, zip_code: '22043;drop' },
  };

  const result = await handler(webhookRequest(malformedEvent));

  assertEquals(result.status, 400);
  assertEquals(dispatchCount, 0);
});

Deno.test('returns a retryable error when GitHub rejects the dispatch', async () => {
  const handler = createBrochureDispatchHandler({
    webhookSecret: WEBHOOK_SECRET,
    githubToken: GITHUB_TOKEN,
    fetcher: () => Promise.resolve(new Response(null, { status: 401 })),
  });

  const result = await handler(webhookRequest(VALID_EVENT));

  assertEquals(result.status, 502);
});
