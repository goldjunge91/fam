import { deepStrictEqual as assertEquals } from 'node:assert';

import {
  createPostHogPersonDeleter,
  type PostHogDeletionCheckpoint,
  type PostHogDeletionCheckpointStore,
} from './posthog.ts';

const CONFIG = {
  apiKey: 'redacted-test-api-key',
  projectId: 'redacted-project-id',
  host: 'https://eu.posthog.com',
};
const DISTINCT_ID = 'redacted-distinct-id';

const ACCEPTED_RESPONSE = {
  persons_found: 1,
  persons_deleted: 0,
  persons_queued_for_deletion: 1,
  events_queued_for_deletion: true,
  recordings_queued_for_deletion: true,
  deletion_errors: [],
};

Deno.test('verifies the matching person and associated data', async () => {
  const clock = { value: Date.parse('2026-01-01T00:00:00.000Z') };
  let request: Request | undefined;
  let listCount = 0;
  const checkpoint = createCheckpointStore();
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const currentRequest = new Request(input, init);
      request = currentRequest;
      if (
        currentRequest.method === 'GET' && currentRequest.url.includes('/persons/deletion_status')
      ) {
        return Promise.resolve(statusResponse(PERSON_ID, 'completed'));
      }
      if (currentRequest.method === 'GET') {
        listCount += 1;
        return Promise.resolve(listResponse(listCount === 1 ? [PERSON_ID] : []));
      }
      return Promise.resolve(jsonResponse(ACCEPTED_RESPONSE, 202));
    },
    checkpoint.store,
    verificationOptions(clock),
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), { status: 'verified' });
  assertEquals(request?.method, 'GET');
  assertEquals(request?.headers.get('Authorization'), 'Bearer redacted-test-api-key');
});

Deno.test('returns not_found when PostHog finds no matching person', async () => {
  let requestCount = 0;
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    () => {
      requestCount += 1;
      return Promise.resolve(listResponse([]));
    },
    createCheckpointStore().store,
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), { status: 'not_found' });
  assertEquals(requestCount, 1);
});

Deno.test('rejects an invalid deletion response without exposing its body', async () => {
  for (
    const payload of [
      {},
      { ...ACCEPTED_RESPONSE, deletion_errors: { message: 'redacted-provider-error' } },
      { ...ACCEPTED_RESPONSE, deletion_errors: [{ message: 'redacted-provider-error' }] },
    ]
  ) {
    const deletePerson = createPostHogPersonDeleter(
      CONFIG,
      (input, init) => {
        const request = new Request(input, init);
        return Promise.resolve(
          request.method === 'GET'
            ? listResponse([PERSON_ID])
            : new Response(JSON.stringify(payload), {
              status: 202,
              headers: { 'Content-Type': 'application/json' },
            }),
        );
      },
      createCheckpointStore().store,
    );

    assertEquals(await deletePerson?.(DISTINCT_ID), {
      code: 'posthog_person_delete_payload',
      message: 'PostHog response was invalid',
    });
  }
});

Deno.test('rejects invalid deletion JSON without issuing a successful result', async () => {
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const request = new Request(input, init);
      return Promise.resolve(
        request.method === 'GET'
          ? listResponse([PERSON_ID])
          : new Response('redacted-invalid-json', { status: 202 }),
      );
    },
    createCheckpointStore().store,
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), {
    code: 'posthog_person_delete_payload',
    message: 'PostHog response was invalid',
  });
});

Deno.test('does not classify provider-shaped response bodies as internal errors', async () => {
  const providerShapedBody = {
    code: 'external-body-code',
    message: 'external-body-message',
  };
  const cases = [
    {
      expected: {
        code: 'posthog_person_list_payload',
        message: 'PostHog response was invalid',
      },
      operation: 'person-list',
    },
    {
      expected: {
        code: 'posthog_person_delete_payload',
        message: 'PostHog response was invalid',
      },
      operation: 'bulk-delete',
    },
  ] as const;

  for (const testCase of cases) {
    const deletePerson = createPostHogPersonDeleter(
      CONFIG,
      (input, init) => {
        const request = new Request(input, init);
        if (request.method === 'GET') {
          return Promise.resolve(
            testCase.operation === 'person-list'
              ? jsonResponse(providerShapedBody)
              : listResponse([PERSON_ID]),
          );
        }
        return Promise.resolve(jsonResponse(providerShapedBody, 202));
      },
      createCheckpointStore().store,
    );

    assertEquals(await deletePerson?.(DISTINCT_ID), testCase.expected);
  }
});

Deno.test('rejects an undocumented successful deletion status', async () => {
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const request = new Request(input, init);
      return Promise.resolve(
        request.method === 'GET'
          ? listResponse([PERSON_ID])
          : new Response(JSON.stringify(ACCEPTED_RESPONSE), { status: 200 }),
      );
    },
    createCheckpointStore().store,
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), {
    code: 'posthog_person_delete_200',
    message: 'PostHog request failed',
  });
});

Deno.test('returns a stable error when the deletion cannot reach PostHog', async () => {
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const request = new Request(input, init);
      return request.method === 'GET'
        ? Promise.resolve(listResponse([PERSON_ID]))
        : Promise.reject(new Error('redacted-delete-network-details'));
    },
    createCheckpointStore().store,
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), {
    code: 'posthog_person_delete_network',
    message: 'PostHog request failed',
  });
});

Deno.test('returns a stable error and does not expose the response body', async () => {
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const request = new Request(input, init);
      return Promise.resolve(
        request.method === 'GET'
          ? listResponse([PERSON_ID])
          : new Response('redacted-response-body', { status: 503 }),
      );
    },
    createCheckpointStore().store,
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), {
    code: 'posthog_person_delete_503',
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

const PERSON_ID = 'redacted-person-id';
const VERIFIED_AT = '2026-01-01T00:02:00.000Z';

function createCheckpointStore(
  initial: PostHogDeletionCheckpoint | null = null,
): {
  store: PostHogDeletionCheckpointStore;
  get: () => PostHogDeletionCheckpoint | null;
  upserts: PostHogDeletionCheckpoint[];
} {
  let checkpoint = initial;
  const upserts: PostHogDeletionCheckpoint[] = [];
  return {
    store: {
      read: () => Promise.resolve(checkpoint),
      upsert: (_userId, next) => {
        checkpoint = next;
        upserts.push(next);
        return Promise.resolve(null);
      },
    },
    get: () => checkpoint,
    upserts,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function listResponse(ids: string[], next: string | null = null): Response {
  return jsonResponse({
    count: ids.length,
    results: ids.map((id) => ({ id })),
    next,
  });
}

function statusListResponse(results: unknown[]): Response {
  return jsonResponse({
    count: results.length,
    results,
    next: null,
  });
}

function statusResponse(
  personId: string,
  status: 'pending' | 'completed',
  deleteVerifiedAt: string | null = status === 'completed' ? VERIFIED_AT : null,
  createdAt = '2026-01-01T00:00:00.000Z',
): Response {
  return statusListResponse([{
    person_uuid: personId,
    created_at: createdAt,
    status,
    delete_verified_at: deleteVerifiedAt,
  }]);
}

const STRICT_ACCEPTED_RESPONSE = {
  persons_found: 1,
  persons_deleted: 0,
  persons_queued_for_deletion: 1,
  events_queued_for_deletion: true,
  recordings_queued_for_deletion: true,
  deletion_errors: [],
};

function verificationOptions(clock: { value: number }, overrides = {}) {
  return {
    now: () => new Date(clock.value),
    sleep: () => {
      clock.value += 100;
      return Promise.resolve();
    },
    requestTimeoutMs: 10,
    verificationTimeoutMs: 50,
    pollIntervalMs: 1,
    ...overrides,
  };
}

Deno.test('verifies person and event deletion only after status and final list checks', async () => {
  const clock = { value: Date.parse('2026-01-01T00:00:00.000Z') };
  const checkpoint = createCheckpointStore();
  const requests: Request[] = [];
  let listCount = 0;
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      if (request.method === 'GET' && request.url.includes('/persons/deletion_status')) {
        return Promise.resolve(statusResponse(PERSON_ID, 'completed'));
      }
      if (request.method === 'GET') {
        listCount += 1;
        return Promise.resolve(listResponse(listCount === 1 ? [PERSON_ID] : []));
      }
      return Promise.resolve(jsonResponse(STRICT_ACCEPTED_RESPONSE, 202));
    },
    checkpoint.store,
    verificationOptions(clock),
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), { status: 'verified' });
  assertEquals(requests.map((request) => `${request.method} ${new URL(request.url).pathname}`), [
    'GET /api/projects/redacted-project-id/persons',
    'POST /api/projects/redacted-project-id/persons/bulk_delete',
    'GET /api/projects/redacted-project-id/persons/deletion_status',
    'GET /api/projects/redacted-project-id/persons',
  ]);
  assertEquals(new URL(requests[0].url).search, '?distinct_id=redacted-distinct-id&limit=1000');
  assertEquals(await requests[1].json(), {
    ids: [PERSON_ID],
    delete_events: true,
    delete_recordings: true,
    keep_person: false,
  });
  assertEquals(new URL(requests[2].url).search, `?person_uuid=${PERSON_ID}&status=all`);
  assertEquals(checkpoint.get()?.deleteVerifiedAt, '2026-01-01T00:00:00.000Z');
});

Deno.test('returns not_found only when the strict person lookup is empty', async () => {
  const checkpoint = createCheckpointStore();
  let requestCount = 0;
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    () => {
      requestCount += 1;
      return Promise.resolve(listResponse([]));
    },
    checkpoint.store,
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), { status: 'not_found' });
  assertEquals(requestCount, 1);
  assertEquals(checkpoint.upserts, []);
});

Deno.test('rejects malformed or incomplete person-list payloads', async () => {
  for (
    const payload of [
      { results: null, next: null },
      { count: 1, results: [{ id: '' }], next: null },
      { results: [{ id: PERSON_ID }], next: 'https://eu.posthog.com/next' },
    ]
  ) {
    const deletePerson = createPostHogPersonDeleter(
      CONFIG,
      () => Promise.resolve(jsonResponse(payload)),
      createCheckpointStore().store,
    );

    const result = await deletePerson?.(DISTINCT_ID);
    assertEquals(result, {
      code: payload.next ? 'posthog_person_list_incomplete' : 'posthog_person_list_payload',
      message: payload.next ? 'PostHog person list was incomplete' : 'PostHog response was invalid',
    });
  }
});

Deno.test('accepts the current cursor person-list envelope without a count', async () => {
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    () => Promise.resolve(jsonResponse({ results: [], next: null, previous: null })),
    createCheckpointStore().store,
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), { status: 'not_found' });
});

Deno.test('rejects duplicate person IDs in the person-list payload', async () => {
  let listCount = 0;
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const request = new Request(input, init);
      if (request.method === 'GET' && request.url.includes('/persons/deletion_status')) {
        return Promise.resolve(statusResponse(PERSON_ID, 'completed'));
      }
      if (request.method === 'GET') {
        listCount += 1;
        return Promise.resolve(
          listCount === 1
            ? jsonResponse({
              count: 2,
              results: [{ id: PERSON_ID }, { id: PERSON_ID }],
              next: null,
            })
            : listResponse([]),
        );
      }
      return Promise.resolve(jsonResponse(STRICT_ACCEPTED_RESPONSE, 202));
    },
    createCheckpointStore().store,
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), {
    code: 'posthog_person_list_payload',
    message: 'PostHog response was invalid',
  });
});

Deno.test('rejects deletion status payloads without count or created_at', async () => {
  for (
    const payload of [
      {
        count: 1,
        results: [{ person_uuid: PERSON_ID, status: 'completed', delete_verified_at: VERIFIED_AT }],
        next: null,
      },
      {
        results: [{
          person_uuid: PERSON_ID,
          created_at: '2026-01-01T00:00:00.000Z',
          status: 'completed',
          delete_verified_at: VERIFIED_AT,
        }],
        next: null,
      },
    ]
  ) {
    let listCount = 0;
    const deletePerson = createPostHogPersonDeleter(
      CONFIG,
      (input, init) => {
        const request = new Request(input, init);
        if (request.method === 'GET' && request.url.includes('/persons/deletion_status')) {
          return Promise.resolve(jsonResponse(payload));
        }
        if (request.method === 'GET') {
          listCount += 1;
          return Promise.resolve(listResponse(listCount === 1 ? [PERSON_ID] : []));
        }
        return Promise.resolve(jsonResponse(STRICT_ACCEPTED_RESPONSE, 202));
      },
      createCheckpointStore().store,
    );

    assertEquals(await deletePerson?.(DISTINCT_ID), {
      code: 'posthog_deletion_status_payload',
      message: 'PostHog deletion status was invalid',
    });
  }
});

Deno.test('accepts the cursor person-list envelope during final verification', async () => {
  const clock = { value: Date.parse('2026-01-01T00:00:00.000Z') };
  const checkpoint = createCheckpointStore();
  let listCount = 0;
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const request = new Request(input, init);
      if (request.method === 'GET' && request.url.includes('/persons/deletion_status')) {
        return Promise.resolve(statusResponse(PERSON_ID, 'completed'));
      }
      if (request.method === 'GET') {
        listCount += 1;
        return Promise.resolve(
          listCount === 1 ? listResponse([PERSON_ID]) : jsonResponse({ results: [], next: null }),
        );
      }
      return Promise.resolve(jsonResponse(STRICT_ACCEPTED_RESPONSE, 202));
    },
    checkpoint.store,
    verificationOptions(clock),
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), { status: 'verified' });
  assertEquals(checkpoint.get()?.deleteVerifiedAt, '2026-01-01T00:00:00.000Z');
});

Deno.test('rejects missing or empty person-list pagination markers before deletion', async () => {
  for (const payload of [{ results: [] }, { results: [], next: '' }]) {
    const methods: string[] = [];
    const deletePerson = createPostHogPersonDeleter(
      CONFIG,
      (input, init) => {
        const request = new Request(input, init);
        methods.push(request.method);
        return Promise.resolve(jsonResponse(payload));
      },
      createCheckpointStore().store,
    );

    assertEquals(await deletePerson?.(DISTINCT_ID), {
      code: 'posthog_person_list_incomplete',
      message: 'PostHog person list was incomplete',
    });
    assertEquals(methods, ['GET']);
  }
});

Deno.test('rejects missing or empty final pagination markers after status completion', async () => {
  for (const payload of [{ results: [] }, { results: [], next: '' }]) {
    const clock = { value: Date.parse('2026-01-01T00:00:00.000Z') };
    const checkpoint = createCheckpointStore();
    let listCount = 0;
    const deletePerson = createPostHogPersonDeleter(
      CONFIG,
      (input, init) => {
        const request = new Request(input, init);
        if (request.method === 'GET' && request.url.includes('/persons/deletion_status')) {
          return Promise.resolve(statusResponse(PERSON_ID, 'completed'));
        }
        if (request.method === 'GET') {
          listCount += 1;
          return Promise.resolve(
            listCount === 1 ? listResponse([PERSON_ID]) : jsonResponse(payload),
          );
        }
        return Promise.resolve(jsonResponse(STRICT_ACCEPTED_RESPONSE, 202));
      },
      checkpoint.store,
      verificationOptions(clock),
    );

    assertEquals(await deletePerson?.(DISTINCT_ID), {
      code: 'posthog_person_list_incomplete',
      message: 'PostHog person list was incomplete',
    });
    assertEquals(checkpoint.get()?.deleteVerifiedAt, null);
  }
});

Deno.test('rejects contradictory pagination counts', async () => {
  const incompleteList = createPostHogPersonDeleter(
    CONFIG,
    () => Promise.resolve(jsonResponse({ results: [{ id: PERSON_ID }], count: 2, next: null })),
    createCheckpointStore().store,
  );
  assertEquals(await incompleteList?.(DISTINCT_ID), {
    code: 'posthog_person_list_incomplete',
    message: 'PostHog person list was incomplete',
  });

  const incompleteStatus = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const request = new Request(input, init);
      if (request.method === 'GET' && request.url.includes('/persons/deletion_status')) {
        return Promise.resolve(jsonResponse({
          results: [{
            person_uuid: PERSON_ID,
            status: 'completed',
            delete_verified_at: VERIFIED_AT,
          }],
          count: 2,
          next: null,
        }));
      }
      if (request.method === 'GET') return Promise.resolve(listResponse([PERSON_ID]));
      return Promise.resolve(jsonResponse(STRICT_ACCEPTED_RESPONSE, 202));
    },
    createCheckpointStore().store,
  );
  assertEquals(await incompleteStatus?.(DISTINCT_ID), {
    code: 'posthog_deletion_status_payload',
    message: 'PostHog deletion status was invalid',
  });
});

Deno.test('rejects bulk deletion responses that cover only part of the requested IDs', async () => {
  const personIds = [PERSON_ID, 'redacted-person-id-2'];
  let listCount = 0;
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const request = new Request(input, init);
      if (request.method === 'GET' && request.url.includes('/persons/deletion_status')) {
        const personId = new URL(request.url).searchParams.get('person_uuid');
        if (personId === null) throw new Error('missing test person id');
        return Promise.resolve(statusResponse(personId, 'completed'));
      }
      if (request.method === 'GET') {
        listCount += 1;
        return Promise.resolve(listResponse(listCount === 1 ? personIds : []));
      }
      return Promise.resolve(jsonResponse({ ...STRICT_ACCEPTED_RESPONSE }, 202));
    },
    createCheckpointStore().store,
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), {
    code: 'posthog_person_delete_payload',
    message: 'PostHog response was invalid',
  });
});

Deno.test('rejects non-202, deletion-error, and invalid bulk responses', async () => {
  const cases: Array<{ response: Response; expected: string }> = [
    {
      response: jsonResponse(STRICT_ACCEPTED_RESPONSE, 200),
      expected: 'posthog_person_delete_200',
    },
    {
      response: jsonResponse({
        ...STRICT_ACCEPTED_RESPONSE,
        deletion_errors: [{ code: 'redacted' }],
      }, 202),
      expected: 'posthog_person_delete_payload',
    },
    {
      response: jsonResponse(
        { ...STRICT_ACCEPTED_RESPONSE, recordings_queued_for_deletion: false },
        202,
      ),
      expected: 'posthog_person_delete_payload',
    },
  ];

  for (const { response, expected } of cases) {
    const deletePerson = createPostHogPersonDeleter(
      CONFIG,
      (input, init) => {
        const request = new Request(input, init);
        return Promise.resolve(request.method === 'GET' ? listResponse([PERSON_ID]) : response);
      },
      createCheckpointStore().store,
    );
    const result = await deletePerson?.(DISTINCT_ID);
    assertEquals(result, {
      code: expected,
      message: expected === 'posthog_person_delete_payload'
        ? 'PostHog response was invalid'
        : 'PostHog request failed',
    });
  }
});

Deno.test('fails closed for network failures and request timeouts', async () => {
  const networkDelete = createPostHogPersonDeleter(
    CONFIG,
    () => Promise.reject(new Error('redacted-network-details')),
    createCheckpointStore().store,
  );
  assertEquals(await networkDelete?.(DISTINCT_ID), {
    code: 'posthog_person_list_network',
    message: 'PostHog request failed',
  });

  const timeoutDelete = createPostHogPersonDeleter(
    CONFIG,
    (_input, init) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }),
    createCheckpointStore().store,
    { requestTimeoutMs: 1 },
  );
  assertEquals(await timeoutDelete?.(DISTINCT_ID), {
    code: 'posthog_person_list_timeout',
    message: 'PostHog request timed out',
  });
});

Deno.test('returns accepted while status remains pending within the bounded window', async () => {
  const clock = { value: Date.parse('2026-01-01T00:00:00.000Z') };
  let statusRequests = 0;
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const request = new Request(input, init);
      if (request.method === 'GET' && request.url.includes('/persons/deletion_status')) {
        statusRequests += 1;
        return Promise.resolve(statusResponse(PERSON_ID, 'pending'));
      }
      if (request.method === 'GET') return Promise.resolve(listResponse([PERSON_ID]));
      return Promise.resolve(jsonResponse(STRICT_ACCEPTED_RESPONSE, 202));
    },
    createCheckpointStore().store,
    verificationOptions(clock),
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), { status: 'accepted' });
  assertEquals(statusRequests, 1);
});

Deno.test('bounds aggregate status verification across multiple slow IDs', async () => {
  const clock = { value: 0 };
  const personIds = [PERSON_ID, 'redacted-person-id-2', 'redacted-person-id-3'];
  let statusRequests = 0;
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const request = new Request(input, init);
      if (request.method === 'GET' && request.url.includes('/persons/deletion_status')) {
        const personId = new URL(request.url).searchParams.get('person_uuid');
        if (personId === null) throw new Error('missing test person id');
        statusRequests += 1;
        clock.value += 6;
        return Promise.resolve(
          statusResponse(personId, 'completed', VERIFIED_AT, '1970-01-01T00:00:00.000Z'),
        );
      }
      if (request.method === 'GET') return Promise.resolve(listResponse(personIds));
      return Promise.resolve(jsonResponse({
        ...STRICT_ACCEPTED_RESPONSE,
        persons_found: personIds.length,
        persons_queued_for_deletion: personIds.length,
      }, 202));
    },
    createCheckpointStore().store,
    verificationOptions(clock, {
      requestTimeoutMs: 100,
      verificationTimeoutMs: 10,
    }),
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), { status: 'accepted' });
  assertEquals(statusRequests, 2);
});

Deno.test('rejects unknown, missing, and incomplete deletion statuses', async () => {
  for (
    const statusPayload of [
      {
        results: [{ person_uuid: PERSON_ID, status: 'unknown', delete_verified_at: null }],
        next: null,
      },
      {
        results: [{ person_uuid: PERSON_ID, status: 'completed', delete_verified_at: null }],
        next: null,
      },
      { results: [], next: null },
      {
        results: [{ person_uuid: PERSON_ID, status: 'completed', delete_verified_at: VERIFIED_AT }],
        next: 'more',
      },
    ]
  ) {
    const deletePerson = createPostHogPersonDeleter(
      CONFIG,
      (input, init) => {
        const request = new Request(input, init);
        if (request.method === 'GET' && request.url.includes('/persons/deletion_status')) {
          return Promise.resolve(jsonResponse(statusPayload));
        }
        if (request.method === 'GET') return Promise.resolve(listResponse([PERSON_ID]));
        return Promise.resolve(jsonResponse(STRICT_ACCEPTED_RESPONSE, 202));
      },
      createCheckpointStore().store,
    );
    const result = await deletePerson?.(DISTINCT_ID);
    assertEquals(result, {
      code: 'next' in statusPayload && statusPayload.next === 'more'
        ? 'posthog_deletion_status_incomplete'
        : 'posthog_deletion_status_payload',
      message: 'next' in statusPayload && statusPayload.next === 'more'
        ? 'PostHog deletion status was incomplete'
        : 'PostHog deletion status was invalid',
    });
  }
});

Deno.test('verifies every stored person ID and keeps their union across retries', async () => {
  const clock = { value: Date.parse('2026-01-01T00:00:00.000Z') };
  const checkpoint = createCheckpointStore({
    personIds: ['redacted-person-id-2'],
    deleteRequestedAt: '2025-12-31T23:59:00.000Z',
    deleteAcceptedAt: '2025-12-31T23:59:30.000Z',
    deleteVerifiedAt: null,
  });
  const requests: Request[] = [];
  let listCount = 0;
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      if (request.method === 'GET' && request.url.includes('/persons/deletion_status')) {
        const personId = new URL(request.url).searchParams.get('person_uuid');
        return Promise.resolve(
          statusResponse(
            personId === 'redacted-person-id-2' ? personId : PERSON_ID,
            'completed',
          ),
        );
      }
      if (request.method === 'GET') {
        listCount += 1;
        return Promise.resolve(listResponse(listCount === 1 ? [PERSON_ID] : []));
      }
      return Promise.resolve(jsonResponse({
        ...STRICT_ACCEPTED_RESPONSE,
        persons_found: 2,
        persons_queued_for_deletion: 2,
      }, 202));
    },
    checkpoint.store,
    verificationOptions(clock),
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), { status: 'verified' });
  assertEquals(await requests.find((request) => request.method === 'POST')?.json(), {
    ids: ['redacted-person-id-2', PERSON_ID],
    delete_events: true,
    delete_recordings: true,
    keep_person: false,
  });
  assertEquals(checkpoint.get()?.personIds, ['redacted-person-id-2', PERSON_ID]);
});

Deno.test('retries an accepted checkpoint idempotently after the person leaves the list', async () => {
  const checkpoint = createCheckpointStore({
    personIds: [PERSON_ID],
    deleteRequestedAt: '2026-01-01T00:00:00.000Z',
    deleteAcceptedAt: '2026-01-01T00:01:00.000Z',
    deleteVerifiedAt: null,
  });
  let listCount = 0;
  const methods: string[] = [];
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const request = new Request(input, init);
      methods.push(`${request.method} ${new URL(request.url).pathname}`);
      if (request.method === 'GET' && request.url.includes('/persons/deletion_status')) {
        return Promise.resolve(statusResponse(PERSON_ID, 'completed'));
      }
      if (request.method === 'GET') {
        listCount += 1;
        return Promise.resolve(listResponse([]));
      }
      return Promise.resolve(jsonResponse(STRICT_ACCEPTED_RESPONSE, 202));
    },
    checkpoint.store,
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), { status: 'verified' });
  assertEquals(methods, [
    'GET /api/projects/redacted-project-id/persons',
    'GET /api/projects/redacted-project-id/persons/deletion_status',
    'GET /api/projects/redacted-project-id/persons',
  ]);
  assertEquals(listCount, 2);
});

Deno.test('does not verify while the final person list still contains a person', async () => {
  const clock = { value: Date.parse('2026-01-01T00:00:00.000Z') };
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const request = new Request(input, init);
      if (request.method === 'GET' && request.url.includes('/persons/deletion_status')) {
        return Promise.resolve(statusResponse(PERSON_ID, 'completed'));
      }
      if (request.method === 'GET') return Promise.resolve(listResponse([PERSON_ID]));
      return Promise.resolve(jsonResponse(STRICT_ACCEPTED_RESPONSE, 202));
    },
    createCheckpointStore().store,
    verificationOptions(clock),
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), {
    code: 'posthog_person_remains',
    message: 'PostHog person deletion was not verified',
  });
});

Deno.test('rejects a checkpoint with contradictory timestamps', async () => {
  let requests = 0;
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    () => {
      requests += 1;
      return Promise.resolve(listResponse([PERSON_ID]));
    },
    {
      read: () =>
        Promise.resolve({
          personIds: [PERSON_ID],
          deleteRequestedAt: '2026-01-01T00:02:00.000Z',
          deleteAcceptedAt: '2026-01-01T00:01:00.000Z',
          deleteVerifiedAt: null,
        }),
      upsert: () => Promise.resolve(null),
    },
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), {
    code: 'posthog_deletion_checkpoint_invalid',
    message: 'PostHog deletion checkpoint was invalid',
  });
  assertEquals(requests, 0);
});

Deno.test('fails closed when checkpoint read or write fails', async () => {
  let requests = 0;
  const readFailure = createPostHogPersonDeleter(
    CONFIG,
    () => {
      requests += 1;
      return Promise.resolve(listResponse([PERSON_ID]));
    },
    {
      read: () => Promise.reject(new Error('redacted-checkpoint-read-details')),
      upsert: () => Promise.resolve(null),
    },
  );
  assertEquals(await readFailure?.(DISTINCT_ID), {
    code: 'posthog_deletion_checkpoint_read',
    message: 'PostHog deletion checkpoint failed',
  });
  assertEquals(requests, 0);

  const writeFailure = createPostHogPersonDeleter(
    CONFIG,
    () => Promise.resolve(listResponse([PERSON_ID])),
    {
      read: () => Promise.resolve(null),
      upsert: () => Promise.reject(new Error('redacted-checkpoint-write-details')),
    },
  );
  assertEquals(await writeFailure?.(DISTINCT_ID), {
    code: 'posthog_deletion_checkpoint_write',
    message: 'PostHog deletion checkpoint failed',
  });
});

Deno.test('selects the current deletion status instead of stale status history', async () => {
  const clock = { value: Date.parse('2026-01-01T00:01:00.000Z') };
  let listCount = 0;
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const request = new Request(input, init);
      if (request.method === 'GET' && request.url.includes('/persons/deletion_status')) {
        return Promise.resolve(statusListResponse([
          {
            person_uuid: PERSON_ID,
            created_at: '2025-12-31T23:00:00.000Z',
            status: 'completed',
            delete_verified_at: '2025-12-31T23:01:00.000Z',
          },
          {
            person_uuid: PERSON_ID,
            created_at: '2026-01-01T00:01:00.000Z',
            status: 'completed',
            delete_verified_at: '2026-01-01T00:02:00.000Z',
          },
        ]));
      }
      if (request.method === 'GET') {
        listCount += 1;
        return Promise.resolve(listResponse(listCount === 1 ? [PERSON_ID] : []));
      }
      return Promise.resolve(jsonResponse(STRICT_ACCEPTED_RESPONSE, 202));
    },
    createCheckpointStore().store,
    verificationOptions(clock),
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), { status: 'verified' });
});

Deno.test('rejects stale or ambiguous deletion status evidence', async () => {
  const cases = [
    {
      records: [{
        person_uuid: PERSON_ID,
        created_at: '2025-12-31T23:00:00.000Z',
        status: 'completed',
        delete_verified_at: '2025-12-31T23:01:00.000Z',
      }],
      code: 'posthog_deletion_status_current_missing',
      message: 'PostHog deletion status did not match the current request',
    },
    {
      records: [{
        person_uuid: PERSON_ID,
        created_at: '2026-01-01T00:02:00.000Z',
        status: 'completed',
        delete_verified_at: '2026-01-01T00:03:00.000Z',
      }],
      code: 'posthog_deletion_status_current_missing',
      message: 'PostHog deletion status did not match the current request',
    },
    {
      records: [{
        person_uuid: PERSON_ID,
        created_at: '2026-01-01T00:01:00.000Z',
        status: 'completed',
        delete_verified_at: '2026-01-01T00:00:59.000Z',
      }],
      code: 'posthog_deletion_status_payload',
      message: 'PostHog deletion status was invalid',
    },
    {
      records: [
        {
          person_uuid: PERSON_ID,
          created_at: '2026-01-01T00:01:00.000Z',
          status: 'completed',
          delete_verified_at: '2026-01-01T00:02:00.000Z',
        },
        {
          person_uuid: PERSON_ID,
          created_at: '2026-01-01T00:01:00.000Z',
          status: 'completed',
          delete_verified_at: '2026-01-01T00:02:00.000Z',
        },
      ],
      code: 'posthog_deletion_status_ambiguous',
      message: 'PostHog deletion status was ambiguous',
    },
  ];

  for (const testCase of cases) {
    const clock = { value: Date.parse('2026-01-01T00:01:00.000Z') };
    const deletePerson = createPostHogPersonDeleter(
      CONFIG,
      (input, init) => {
        const request = new Request(input, init);
        if (request.method === 'GET' && request.url.includes('/persons/deletion_status')) {
          return Promise.resolve(statusListResponse(testCase.records));
        }
        if (request.method === 'GET') return Promise.resolve(listResponse([PERSON_ID]));
        return Promise.resolve(jsonResponse(STRICT_ACCEPTED_RESPONSE, 202));
      },
      createCheckpointStore().store,
      verificationOptions(clock),
    );

    assertEquals(await deletePerson?.(DISTINCT_ID), {
      code: testCase.code,
      message: testCase.message,
    });
  }
});

Deno.test('resumes a deletion whose accepted response was lost without submitting it twice', async () => {
  const clock = { value: Date.parse('2026-01-01T00:00:00.000Z') };
  const checkpoint = createCheckpointStore();
  let personListRequests = 0;
  let bulkRequests = 0;
  let providerAccepted = false;
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const request = new Request(input, init);
      if (request.method === 'POST') {
        bulkRequests += 1;
        if (bulkRequests === 1) {
          providerAccepted = true;
          return Promise.reject(new Error('redacted-response-lost'));
        }
        return Promise.resolve(jsonResponse({
          ...STRICT_ACCEPTED_RESPONSE,
          persons_found: 0,
          persons_queued_for_deletion: 0,
          events_queued_for_deletion: false,
          recordings_queued_for_deletion: false,
        }, 202));
      }
      if (request.url.includes('/persons/deletion_status')) {
        return Promise.resolve(statusListResponse(
          providerAccepted
            ? [{
              person_uuid: PERSON_ID,
              created_at: '2026-01-01T00:00:01.000Z',
              status: 'completed',
              delete_verified_at: '2026-01-01T00:00:30.000Z',
            }]
            : [],
        ));
      }
      personListRequests += 1;
      return Promise.resolve(listResponse(personListRequests === 1 ? [PERSON_ID] : []));
    },
    checkpoint.store,
    verificationOptions(clock),
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), {
    code: 'posthog_person_delete_network',
    message: 'PostHog request failed',
  });
  clock.value = Date.parse('2026-01-01T00:01:00.000Z');
  assertEquals(await deletePerson?.(DISTINCT_ID), { status: 'verified' });
  assertEquals(bulkRequests, 1);
  assertEquals(checkpoint.get()?.deleteVerifiedAt, '2026-01-01T00:01:00.000Z');
});

Deno.test('recovers a zero-match bulk response through current deletion status', async () => {
  const clock = { value: Date.parse('2026-01-01T00:00:00.000Z') };
  let personListRequests = 0;
  let statusRequests = 0;
  const deletePerson = createPostHogPersonDeleter(
    CONFIG,
    (input, init) => {
      const request = new Request(input, init);
      if (request.url.includes('/persons/deletion_status')) {
        statusRequests += 1;
        return Promise.resolve(statusResponse(PERSON_ID, 'completed'));
      }
      if (request.method === 'POST') {
        return Promise.resolve(jsonResponse({
          ...STRICT_ACCEPTED_RESPONSE,
          persons_found: 0,
          persons_queued_for_deletion: 0,
          events_queued_for_deletion: false,
          recordings_queued_for_deletion: false,
        }, 202));
      }
      personListRequests += 1;
      return Promise.resolve(listResponse(personListRequests === 1 ? [PERSON_ID] : []));
    },
    createCheckpointStore().store,
    verificationOptions(clock),
  );

  assertEquals(await deletePerson?.(DISTINCT_ID), { status: 'verified' });
  assertEquals(statusRequests, 2);
});

const TEST_WAIT_EXPIRED = Symbol('test_wait_expired');

function hangingJsonResponse(status = 200): Response {
  const response = new Response(null, { status });
  Object.defineProperty(response, 'json', {
    value: () => new Promise<unknown>(() => {}),
  });
  return response;
}

async function settleWithin<T>(promise: Promise<T>, milliseconds = 50) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<typeof TEST_WAIT_EXPIRED>((resolve) => {
        timeoutId = setTimeout(() => resolve(TEST_WAIT_EXPIRED), milliseconds);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

Deno.test('applies request timeouts while reading every PostHog response body', async () => {
  const cases = [
    {
      operation: 'person_list',
      fetch: () => Promise.resolve(hangingJsonResponse()),
    },
    {
      operation: 'person_delete',
      fetch: (input: URL | RequestInfo, init?: RequestInit) => {
        const request = new Request(input, init);
        return Promise.resolve(
          request.method === 'POST' ? hangingJsonResponse(202) : listResponse([PERSON_ID]),
        );
      },
    },
    {
      operation: 'deletion_status',
      fetch: (input: URL | RequestInfo, init?: RequestInit) => {
        const request = new Request(input, init);
        if (request.url.includes('/persons/deletion_status')) {
          return Promise.resolve(hangingJsonResponse());
        }
        return Promise.resolve(
          request.method === 'POST'
            ? jsonResponse(STRICT_ACCEPTED_RESPONSE, 202)
            : listResponse([PERSON_ID]),
        );
      },
    },
  ] as const;

  for (const testCase of cases) {
    const deletePerson = createPostHogPersonDeleter(
      CONFIG,
      testCase.fetch,
      createCheckpointStore().store,
      { requestTimeoutMs: 1, verificationTimeoutMs: 20 },
    );

    assertEquals(await settleWithin(deletePerson?.(DISTINCT_ID) ?? Promise.resolve(undefined)), {
      code: `posthog_${testCase.operation}_timeout`,
      message: 'PostHog request timed out',
    });
  }
});
