/**
 * Privater Abrufpfad für Prospektbilder.
 *
 * Der r2.dev-Endpunkt ist ausgeschaltet, damit die Bucket-Objekte nicht öffentlich
 * erreichbar sind. Diese Function nimmt das Supabase-JWT des Nutzers entgegen,
 * prüft es serverseitig und liefert danach eine kurzlebige SigV4-Presigned-GET-URL
 * für das angefragte R2-Objekt zurück. Der Bild-Traffic läuft dadurch direkt
 * zwischen R2 und dem Client — die Function selbst bleibt im Redirect-Pfad.
 *
 * Nur R2-Keys innerhalb des zugelassenen Prospekt-Präfixes werden signiert;
 * der Crawler speichert fortan genau diese Keys in `cover_image`/`image_url`.
 */

export const ALLOWED_PREFIX = "brochures/dumps/";

export type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

export type SignedUrlResult =
  | { ok: true; url: string; expiresAt: string }
  | { ok: false; status: number; error: string };

export type Dependencies = {
  authenticate: (request: Request) => Promise<AuthResult>;
  getSignedUrl: (key: string) => Promise<SignedUrlResult>;
};

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...CORS_HEADERS },
  });
}

function allowedKey(rawKey: string | null): string | null {
  if (!rawKey) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawKey);
  } catch {
    return null;
  }
  const normalized = decoded.replace(/\\/g, "/");
  if (!normalized.startsWith(ALLOWED_PREFIX) || normalized.includes("..")) {
    return null;
  }
  if (!/^[a-zA-Z0-9._/-]+$/.test(normalized)) return null;
  return normalized;
}

export function createBrochureImageHandler(
  { authenticate, getSignedUrl }: Dependencies,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "GET") {
      return json({ error: "method_not_allowed" }, 405);
    }

    const auth = await authenticate(request);
    if (!auth.ok) {
      return json({ error: auth.error }, auth.status);
    }

    const key = allowedKey(new URL(request.url).searchParams.get("key"));
    if (!key) {
      return json({ error: "invalid_key" }, 400);
    }

    const signed = await getSignedUrl(key);
    if (!signed.ok) {
      return json({ error: signed.error }, signed.status);
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: signed.url,
        "Cache-Control": "no-store",
        ...CORS_HEADERS,
      },
    });
  };
}
