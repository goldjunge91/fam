// Nur die EAN kommt vom Client; vertrauenswuerdige OFF-Metadaten werden serverseitig geladen.

export type OffFetchResult =
  | { ok: true; categoryTags: string[]; offLastModifiedAt: string }
  | { ok: false };

export type UpdateResult = {
  error: { message: string } | null;
  /** `null` bei DB-Fehler, `0` bei keinem notwendigen Update. */
  count: number | null;
};

type Dependencies = {
  /** Prozessweites OFF-Anfragebudget. */
  isRateLimited: () => boolean;
  recordAttempt: () => void;
  fetchOffProduct: (ean: string) => Promise<OffFetchResult>;
  /** Atomar bedingtes Update verhindert das Ueberschreiben mit aelteren OFF-Daten. */
  updateIfNewer: (
    ean: string,
    categoryTags: string[],
    offLastModifiedAt: string,
  ) => Promise<UpdateResult>;
};

const EAN_PATTERN = /^\d{6,14}$/;

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/** Erstellt den Handler mit austauschbaren OFF- und Datenbankabhaengigkeiten. */
export function createEnrichOffProductHandler({
  isRateLimited,
  recordAttempt,
  fetchOffProduct,
  updateIfNewer,
}: Dependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405);
    }

    let ean: string;
    try {
      const body: unknown = await req.json();
      const candidate =
        body && typeof body === 'object' ? (body as Record<string, unknown>).ean : undefined;
      if (typeof candidate !== 'string' || !EAN_PATTERN.test(candidate)) {
        throw new Error('invalid ean');
      }
      ean = candidate;
    } catch {
      // Clientseitig behauptete Produktdaten werden bewusst ignoriert.
      return json({ error: 'invalid_ean' }, 400);
    }

    if (isRateLimited()) {
      return json({ updated: false, reason: 'rate_limited' });
    }
    recordAttempt();

    const offResult = await fetchOffProduct(ean);
    if (!offResult.ok) {
      return json({ updated: false, reason: 'off_lookup_failed' });
    }

    const result = await updateIfNewer(ean, offResult.categoryTags, offResult.offLastModifiedAt);

    if (result.error) {
      return json({ error: 'update_failed', message: result.error.message }, 500);
    }

    if (!result.count) {
      return json({ updated: false, reason: 'not_newer_or_missing' });
    }

    return json({ updated: true });
  };
}
