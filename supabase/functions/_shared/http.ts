export const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
} as const;

type EdgeHandler = (request: Request, requestId: string) => Response | Promise<Response>;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function safeIssues(value: unknown): Array<{ code: string; path: string }> | null {
  if (!Array.isArray(value)) return null;
  const issues = value.flatMap((item) => {
    if (
      typeof item !== 'object' || item === null ||
      !('code' in item) || typeof item.code !== 'string' ||
      !('path' in item) || typeof item.path !== 'string'
    ) {
      return [];
    }
    return [{ code: item.code, path: item.path }];
  });
  return issues.length > 0 ? issues : null;
}

async function addRequestId(response: Response, requestId: string): Promise<Response> {
  const headers = new Headers(response.headers);
  headers.set('X-Request-Id', requestId);
  headers.set('Access-Control-Expose-Headers', 'X-Request-Id');
  headers.delete('Content-Length');

  if (response.status === 204 || response.status === 205 || response.status === 304) {
    return new Response(null, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const isJson = headers.get('Content-Type')?.toLowerCase().includes('application/json') === true;
  if (isJson && response.body !== null) {
    try {
      const body: unknown = await response.clone().json();
      if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
        const record = body as Record<string, unknown>;
        const error = typeof record.error === 'string'
          ? record.error
          : response.status >= 400
          ? 'request_failed'
          : null;
        const issues = safeIssues(record.issues);
        const safeBody = error === null
          ? { ...record, requestId }
          : { error, requestId, ...(issues === null ? {} : { issues }) };
        return new Response(JSON.stringify(safeBody), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    } catch {
      // Replace malformed error bodies below with the stable error envelope.
    }
  }

  if (response.status >= 400) {
    for (const [name, value] of Object.entries(JSON_HEADERS)) headers.set(name, value);
    return new Response(JSON.stringify({ error: 'request_failed', requestId }), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function responseErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.clone().json();
    if (
      typeof body === 'object' && body !== null &&
      'error' in body && typeof body.error === 'string'
    ) {
      return body.error;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** Adds one request ID to the response and structured logs for every invocation. */
export function withRequestId(functionName: string, handler: EdgeHandler) {
  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const startedAt = performance.now();
    let response: Response;

    try {
      response = await handler(request, requestId);
    } catch (error) {
      console.error(JSON.stringify({
        event: 'edge_function_unhandled_error',
        function: functionName,
        requestId,
        errorType: error instanceof Error ? error.name : typeof error,
      }));
      response = json({ error: 'internal_error' }, 500);
    }

    response = await addRequestId(response, requestId);
    const error = await responseErrorCode(response);
    console.info(JSON.stringify({
      event: 'edge_function_request',
      function: functionName,
      requestId,
      method: request.method,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      ...(error === undefined ? {} : { error }),
    }));
    return response;
  };
}
