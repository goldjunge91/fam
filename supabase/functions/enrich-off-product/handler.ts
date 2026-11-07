import { json } from '../_shared/http.ts';

/**
 * Vertrauenswürdige serverseitige Anreicherung globaler OFF-Produktdaten
 * (#223 Paket 10, Abschnitt 4 in docs/issue#223_V2.md — "Vertrauenswürdige
 * Aktualisierung globaler OFF-Produkte").
 *
 * Die bestehende RLS-Regel (siehe supabase/tests/05_products.test.sql,
 * "OFF-Metadaten nur vom Backend pflegen") verbietet Clients JEDE direkte
 * Änderung an `off_category_tags`/`off_last_modified_at` — auch dem
 * Anleger des Platzhalters. Diese Function ist der einzige Weg, wie diese
 * Felder je aktualisiert werden: sie nimmt vom Client ausschließlich die
 * EAN entgegen, lädt die Taxonomie-Daten SELBST von Open Food Facts (siehe
 * Glossar "Externe Produktdatenbank (OFF / Open Food Facts)" in AGENTS.md)
 * und verwirft alles, was der Client sonst an Produktdaten mitschickt.
 */

/** Ergebnis des eigenen OFF-Lookups — nie aus Client-Eingaben abgeleitet. */
export type OffFetchResult =
  | { ok: true; categoryTags: string[]; offLastModifiedAt: string }
  | { ok: false };

export type UpdateResult = {
  error: { message: string; code?: string } | null;
  /**
   * `null` bei einem echten DB-Fehler; `0`, wenn die atomare
   * "nur wenn neuer"-Bedingung nicht griff (kein passendes Produkt oder
   * vorhandener Stand nicht älter) — beides kein Fehler, nur kein Update.
   */
  count: number | null;
};

type Dependencies = {
  /** Geteilter, prozessweiter Zustand (nicht pro EAN) — schützt das eigene
   * Aufrufbudget gegenüber Open Food Facts, nicht einzelne Nutzer. */
  isRateLimited: () => boolean;
  recordAttempt: () => void;
  fetchOffProduct: (ean: string) => Promise<OffFetchResult>;
  /**
   * Atomares `UPDATE ... WHERE barcode = ean AND source = 'off' AND
   * (off_last_modified_at IS NULL OR off_last_modified_at < offLastModifiedAt)`.
   * Race-frei per Konstruktion: zwei gleichzeitige Aufrufe für dieselbe EAN
   * können sich nicht gegenseitig mit einem älteren Stand überschreiben,
   * ohne dass ein zusätzlicher Read-then-Write nötig wäre.
   */
  updateIfNewer: (
    ean: string,
    categoryTags: string[],
    offLastModifiedAt: string,
  ) => Promise<UpdateResult>;
};

const EAN_PATTERN = /^\d{6,14}$/;

/**
 * Baut den HTTP-Handler getrennt vom Deno-Einstiegspunkt (dasselbe Muster
 * wie `revenuecat-webhook/handler.ts`) — Rate-Limiting, OFF-Lookup und
 * DB-Zugriff sind austauschbare Abhängigkeiten, der Handler selbst läuft
 * ohne Netzwerk oder echte Datenbank testbar.
 */
export function createEnrichOffProductHandler({
  isRateLimited,
  recordAttempt,
  fetchOffProduct,
  updateIfNewer,
}: Dependencies) {
  return async (
    req: Request,
    requestId: string = crypto.randomUUID(),
  ): Promise<Response> => {
    if (req.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405);
    }

    let ean: string;
    try {
      const body: unknown = await req.json();
      const candidate = body && typeof body === 'object'
        ? (body as Record<string, unknown>).ean
        : undefined;
      if (typeof candidate !== 'string' || !EAN_PATTERN.test(candidate)) {
        throw new Error('invalid ean');
      }
      ean = candidate;
    } catch {
      // Absichtlich EINZIGES Feld, das aus dem Request-Body gelesen wird —
      // alles andere (z.B. vom Client behauptete category_tags) existiert
      // fuer diese Function schlicht nicht.
      return json({ error: 'invalid_ean' }, 400);
    }

    if (isRateLimited()) {
      return json({ error: 'rate_limited' }, 429);
    }
    recordAttempt();

    // Sowohl der OFF-Lookup (Netzwerk zu Open Food Facts) als auch der DB-
    // Zugriff (Netzwerk zu Supabase) koennen bei einer Infrastruktur-Stoerung
    // werfen statt ihr dokumentiertes { ok: false }/{ error, count } zu
    // liefern (z.B. Timeout, Connection Reset) — ohne dieses try/catch wuerde
    // ein einzelner Netzwerkfehler als unbehandelte Exception aus dem Handler
    // fallen, statt als strukturierte 500-Antwort wie jeder andere Fehlerpfad
    // hier.
    try {
      const offResult = await fetchOffProduct(ean);
      if (!offResult.ok) {
        return json({ error: 'off_lookup_failed' }, 502);
      }

      const result = await updateIfNewer(
        ean,
        offResult.categoryTags,
        offResult.offLastModifiedAt,
      );

      if (result.error) {
        console.error(JSON.stringify({
          event: 'enrich_off_product_failed',
          requestId,
          error: 'update_failed',
          databaseErrorCode: result.error.code ?? null,
        }));
        return json({ error: 'update_failed' }, 500);
      }

      if (!result.count) {
        return json({ updated: false, reason: 'not_newer_or_missing' });
      }

      return json({ updated: true });
    } catch (error) {
      console.error(JSON.stringify({
        event: 'enrich_off_product_failed',
        requestId,
        error: 'internal_error',
        errorType: error instanceof Error ? error.name : typeof error,
      }));
      return json({ error: 'internal_error' }, 500);
    }
  };
}
