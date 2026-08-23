export function parseDateHeader(value: string | null): number | null {
  if (value === null) return null;

  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

export type ServerClock = {
  fetch: typeof fetch;
  serverNowMs(): number | null;
};

/** Beobachtet den `Date`-Header ohne zusaetzlichen Netzwerkaufruf. */
export function createServerClock(baseFetch: typeof fetch = fetch): ServerClock {
  let lastServerNowMs: number | null = null;

  const wrappedFetch: typeof fetch = async (input, init) => {
    const response = await baseFetch(input, init);
    const parsed = parseDateHeader(response.headers.get('date'));
    if (parsed !== null) {
      lastServerNowMs = parsed;
    }
    return response;
  };

  return {
    fetch: wrappedFetch,
    serverNowMs: () => lastServerNowMs,
  };
}

export function clockCeiling(clock: ServerClock, fallbackNowMs: number): number {
  return clock.serverNowMs() ?? fallbackNowMs;
}
