/**
 * Serverzeit fuer `resolve()`s `clockCeiling` (#47, #49).
 *
 * Der `Date`-Response-Header ist auf jeder PostgREST/Supabase-REST-Antwort
 * vorhanden — kein zusaetzlicher Round-Trip noetig. Sekundenpraezision reicht,
 * um den tatsaechlichen #49-Fehlerfall zu fangen: eine Geraeteuhr, die um
 * Monate oder Jahre danebenliegt, nicht eine Abweichung im Millisekundenbereich.
 *
 * `createServerClock` liefert eine `fetch`-kompatible Funktion, die an einen
 * echten `fetch` delegiert und den zuletzt beobachteten `Date`-Header merkt.
 * Ein Supabase-Client, der der Sync-Engine uebergeben wird, MUSS mit
 * `createClient(url, key, { global: { fetch: serverClock.fetch } })` gebaut
 * sein, sonst bleibt `serverNowMs()` fuer immer `null`.
 */

/** Parst den HTTP `Date`-Header in epoch ms. `null` bei fehlendem oder kaputtem Header. */
export function parseDateHeader(value: string | null): number | null {
  if (value === null) return null;

  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

export type ServerClock = {
  fetch: typeof fetch;
  serverNowMs(): number | null;
};

/**
 * Baut eine Server-Uhr um einen `fetch`.
 *
 * `baseFetch` ist injizierbar, damit dieses Modul in `*.test.ts` ohne echtes
 * Netzwerk pruefbar bleibt — eine handgeschriebene, Fetch-foermige Funktion
 * ist kein Modul-Mock, sondern Dependency Injection, exakt das Muster von
 * `createTestDatabase` fuer den `SqlDatabase`-Port.
 */
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

/**
 * Obergrenze fuer den lokalen Zeitstempel in `resolve()`.
 *
 * Faellt nur zurueck auf `fallbackNowMs` (die eigene Geraeteuhr), solange noch
 * keine Server-Antwort beobachtet wurde — etwa beim allerersten Aufruf einer
 * Session. Auch dann nur als Obergrenze, nie als Autoritaet: Ist die
 * Geraeteuhr falsch gestellt, ist der Fallback ebenso falsch — das behebt erst
 * die naechste echte Server-Antwort.
 */
export function clockCeiling(clock: ServerClock, fallbackNowMs: number): number {
  return clock.serverNowMs() ?? fallbackNowMs;
}
