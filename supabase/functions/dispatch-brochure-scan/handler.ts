const GITHUB_DISPATCH_URL =
  'https://api.github.com/repos/goldjunge91/fam/actions/workflows/scrape-brochures.yml/dispatches';
const GITHUB_API_VERSION = '2022-11-28';
const ZIP_CODE_PATTERN = /^\d{5}$/;

type DispatchEvent = {
  type: 'INSERT' | 'UPDATE';
  schema: 'public';
  table: 'brochure_zip_scans';
  record: {
    zip_code: string;
    requested_at: string;
    last_successful_at: string | null;
    last_error: string | null;
  };
};

type Dependencies = {
  webhookSecret: string | undefined;
  githubToken: string | undefined;
  fetcher?: typeof fetch;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasValidDispatchEvent(value: unknown): value is DispatchEvent {
  if (!isRecord(value) || !isRecord(value.record)) return false;
  if (value.type !== 'INSERT' && value.type !== 'UPDATE') return false;
  if (value.schema !== 'public' || value.table !== 'brochure_zip_scans') return false;

  const record = value.record;
  if (
    typeof record.zip_code !== 'string' ||
    !ZIP_CODE_PATTERN.test(record.zip_code) ||
    typeof record.requested_at !== 'string' ||
    (record.last_successful_at !== null && typeof record.last_successful_at !== 'string') ||
    (record.last_error !== null && typeof record.last_error !== 'string')
  ) {
    return false;
  }

  return true;
}

function isPendingScan(record: DispatchEvent['record']): boolean {
  if (record.last_error !== null) return false;
  const requestedAt = Date.parse(record.requested_at);
  if (!Number.isFinite(requestedAt)) return false;
  if (record.last_successful_at === null) return true;

  const lastSuccessfulAt = Date.parse(record.last_successful_at);
  return Number.isFinite(lastSuccessfulAt) && requestedAt > lastSuccessfulAt;
}

function safeSecretEquals(received: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const receivedBytes = encoder.encode(received);
  const expectedBytes = encoder.encode(expected);
  let difference = receivedBytes.length ^ expectedBytes.length;
  const length = Math.max(receivedBytes.length, expectedBytes.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (receivedBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }

  return difference === 0;
}

function response(status: number): Response {
  return new Response(null, { status });
}

export function createBrochureDispatchHandler({
  webhookSecret,
  githubToken,
  fetcher = fetch,
}: Dependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return response(405);
    if (!webhookSecret) return response(503);

    const suppliedSecret = request.headers.get('x-brochure-dispatch-secret');
    if (!suppliedSecret || !safeSecretEquals(suppliedSecret, webhookSecret)) {
      return response(401);
    }

    if (!githubToken) return response(503);

    let event: unknown;
    try {
      event = await request.json();
    } catch {
      return response(400);
    }

    if (!hasValidDispatchEvent(event)) return response(400);
    if (!isPendingScan(event.record)) return response(204);

    try {
      const githubResponse = await fetcher(GITHUB_DISPATCH_URL, {
        method: 'POST',
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${githubToken}`,
          'content-type': 'application/json',
          'x-github-api-version': GITHUB_API_VERSION,
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: { zip: event.record.zip_code },
        }),
      });

      if (githubResponse.status !== 200 && githubResponse.status !== 204) {
        console.error('Brochure workflow dispatch failed', {
          status: githubResponse.status,
        });
        return response(502);
      }

      return response(202);
    } catch (error) {
      console.error('Brochure workflow dispatch request failed', {
        message: error instanceof Error ? error.message : 'unknown error',
      });
      return response(502);
    }
  };
}
