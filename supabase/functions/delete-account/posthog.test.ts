import { deepStrictEqual as assertEquals } from 'node:assert';

import { createPostHogPersonDeleter } from './posthog.ts';

const CONFIG = {
  apiKey: 'phx-secret',
  projectId: '123',
  host: 'https://eu.posthog.com',
};

Deno.test('deletes every PostHog person matching the authenticated distinct ID', async () => {
  const requests: Request[] = [];
  const deletePerson = createPostHogPersonDeleter(CONFIG, (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    if (request.method === 'GET') {
      return Promise.resolve(
        new Response(JSON.stringify({ results: [{ id: 'person-1' }, { id: 'person-2' }] })),
      );
    }
    return Promise.resolve(new Response(null, { status: 202 }));
  });

  assertEquals(await deletePerson?.('user-1'), null);
  assertEquals(requests.length, 3);
  assertEquals(
    requests[0].url,
    'https://eu.posthog.com/api/projects/123?distinct_id=user-1&limit=100',
  );
  assertEquals(requests[1].method, 'DELETE');
  assertEquals(
    requests[1].url,
    'https://eu.posthog.com/api/projects/123/person-1?delete_events=true&delete_recordings=true',
  );
  assertEquals(
    requests[2].url,
    'https://eu.posthog.com/api/projects/123/person-2?delete_events=true&delete_recordings=true',
  );
  assertEquals(requests[0].headers.get('Authorization'), 'Bearer phx-secret');
});

Deno.test('does not issue deletes when PostHog has no matching person', async () => {
  let requestCount = 0;
  const deletePerson = createPostHogPersonDeleter(CONFIG, () => {
    requestCount += 1;
    return Promise.resolve(new Response(JSON.stringify({ results: [] })));
  });

  assertEquals(await deletePerson?.('user-1'), null);
  assertEquals(requestCount, 1);
});

Deno.test('returns a stable error and does not expose the response body', async () => {
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    () => Promise.resolve(new Response('contains a secret response body', { status: 503 })),
  );

  assertEquals(await deletePerson?.('user-1'), {
    code: 'posthog_person_lookup_503',
    message: 'PostHog request failed',
  });
});

Deno.test('rejects non-HTTPS PostHog hosts', () => {
  let error: unknown;
  try {
    createPostHogPersonDeleter({ ...CONFIG, host: 'http://localhost' });
  } catch (candidate) {
    error = candidate;
  }

  assertEquals((error as Error).message, 'posthog_host_must_use_https');
});
