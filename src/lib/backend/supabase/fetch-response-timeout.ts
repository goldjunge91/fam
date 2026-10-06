const RESPONSE_BODY_METHODS = new Set<PropertyKey>([
  'arrayBuffer',
  'blob',
  'formData',
  'json',
  'text',
]);

/** Bounds the full fetch and response-body read, aborting a stalled native request. */
export function createFetchWithResponseTimeout(
  baseFetch: typeof fetch,
  timeoutMs: number,
): typeof fetch {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('Fetch response timeout must be a positive number.');
  }

  return async (input, init) => {
    const controller = new AbortController();
    const callerSignal = init?.signal;
    const relayAbort = () => controller.abort(callerSignal?.reason);

    if (callerSignal?.aborted) {
      relayAbort();
    } else {
      callerSignal?.addEventListener('abort', relayAbort, { once: true });
    }

    let timer: ReturnType<typeof setTimeout>;
    let rejectTimeout: (reason: TypeError) => void = () => {};
    const timeout = new Promise<never>((_, reject) => {
      rejectTimeout = reject;
    });

    const cleanup = () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', relayAbort);
    };

    timer = setTimeout(() => {
      const error = new TypeError(`Fetch response timed out after ${timeoutMs} ms.`);
      cleanup();
      controller.abort(error);
      rejectTimeout(error);
    }, timeoutMs);

    try {
      const response = await Promise.race([
        baseFetch(input, { ...init, signal: controller.signal }),
        timeout,
      ]);

      const method = init?.method?.toUpperCase();
      if (
        method === 'HEAD' ||
        response.status === 204 ||
        response.status === 205 ||
        response.status === 304
      ) {
        cleanup();
        return response;
      }

      return new Proxy(response, {
        get(target, property) {
          const value = Reflect.get(target, property, target);
          if (typeof value !== 'function') return value;
          if (!RESPONSE_BODY_METHODS.has(property)) return value.bind(target);

          return (...args: unknown[]) =>
            Promise.race([
              Promise.resolve().then(() => Reflect.apply(value, target, args)),
              timeout,
            ]).finally(cleanup);
        },
      });
    } catch (error) {
      cleanup();
      throw error;
    }
  };
}
