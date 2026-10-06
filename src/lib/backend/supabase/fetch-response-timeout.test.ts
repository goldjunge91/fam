import { createFetchWithResponseTimeout } from '@/lib/backend/supabase/fetch-response-timeout';

describe('createFetchWithResponseTimeout', () => {
  it('aborts when reading a response body does not finish', async () => {
    const response = {
      json: () => new Promise<never>(() => {}),
    } as unknown as Response;
    let requestSignal: AbortSignal | null | undefined;
    const baseFetch: typeof fetch = async (_input, init) => {
      requestSignal = init?.signal;
      return response;
    };

    const timedFetch = createFetchWithResponseTimeout(baseFetch, 5);
    const pendingResponse = await timedFetch('https://example.test');

    await expect(pendingResponse.json()).rejects.toThrow('Fetch response timed out after 5 ms.');
    expect(requestSignal?.aborted).toBe(true);
  });

  it('keeps successful fetches and response bodies intact', async () => {
    const baseFetch: typeof fetch = async () => new Response('{"ok":true}');
    const timedFetch = createFetchWithResponseTimeout(baseFetch, 1000);

    const response = await timedFetch('https://example.test');

    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
