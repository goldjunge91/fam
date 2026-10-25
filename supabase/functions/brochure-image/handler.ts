export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type BrochureImageAsset =
  | { kind: 'cover' }
  | { kind: 'page'; pageNumber: number }
  | { kind: 'hotspot'; pageNumber: number; hotspotId: string }
  | { kind: 'store-logo'; storeId: string };

export type BrochureImageRequest = {
  brochureId?: string;
  asset: BrochureImageAsset;
};

export type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

export type ResolvedAsset =
  | { ok: true; sourceUrl: string; cacheKey: string; expiresAt?: string }
  | { ok: false; status: number; error: string };

type CachedImage = { body: ArrayBuffer; contentType: string };

type CachePutResult = 'stored' | 'already-existed';

export type Dependencies = {
  authenticate: (request: Request) => Promise<AuthResult>;
  resolveAsset: (
    request: Request,
    imageRequest: BrochureImageRequest,
    userId: string,
  ) => Promise<ResolvedAsset>;
  getCached: (key: string) => Promise<CachedImage | null>;
  fetchSource: (url: string) => Promise<Response>;
  putCached: (key: string, body: ArrayBuffer, contentType: string) => Promise<CachePutResult>;
  now?: () => number;
};

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};
const ALLOWED_IMAGE_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...CORS_HEADERS },
  });
}

function parsePositiveInteger(value: string | null): number | null {
  if (!value || !/^[1-9][0-9]{0,3}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseRequest(request: Request): BrochureImageRequest | null {
  const params = new URL(request.url).searchParams;
  const brochureId = params.get('brochure_id') ?? undefined;
  const kind = params.get('asset');
  if (kind === 'cover' && brochureId) return { brochureId, asset: { kind } };
  if (kind === 'page' && brochureId) {
    const pageNumber = parsePositiveInteger(params.get('page_number'));
    return pageNumber ? { brochureId, asset: { kind, pageNumber } } : null;
  }
  if (kind === 'hotspot' && brochureId) {
    const pageNumber = parsePositiveInteger(params.get('page_number'));
    const hotspotId = params.get('hotspot_id');
    return pageNumber && hotspotId && hotspotId.length <= 200
      ? { brochureId, asset: { kind, pageNumber, hotspotId } }
      : null;
  }
  if (kind === 'store-logo') {
    const storeId = params.get('store_id');
    return storeId ? { asset: { kind, storeId } } : null;
  }
  return null;
}

function imageResponse(image: CachedImage, cacheControl: string): Response {
  return new Response(image.body, {
    status: 200,
    headers: {
      'Content-Type': image.contentType,
      'Cache-Control': cacheControl,
      ...CORS_HEADERS,
    },
  });
}

function cacheControl(expiresAt: string | undefined, now: number): string {
  if (!expiresAt) return 'private, max-age=3600';
  const remainingSeconds = Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000));
  return `private, max-age=${remainingSeconds}`;
}

async function readSourceImage(
  response: Response,
): Promise<{ body: ArrayBuffer; contentType: string } | Response> {
  if (!response.ok) {
    return json({ error: 'source_unavailable' }, response.status >= 500 ? 502 : 404);
  }
  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  const contentLengthHeader = response.headers.get('content-length');
  const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
  if (
    !contentType ||
    !ALLOWED_IMAGE_TYPES.has(contentType) ||
    (contentLength !== null &&
      (!Number.isSafeInteger(contentLength) || contentLength < 0 ||
        contentLength > MAX_IMAGE_BYTES))
  ) {
    return json({ error: 'source_rejected' }, 502);
  }
  const reader = response.body?.getReader();
  if (!reader) return json({ error: 'source_rejected' }, 502);
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_IMAGE_BYTES) {
      await reader.cancel().catch(() => undefined);
      return json({ error: 'source_rejected' }, 502);
    }
    chunks.push(value);
  }
  if (byteLength === 0) return json({ error: 'source_rejected' }, 502);
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: bytes.buffer, contentType };
}

export function createBrochureImageHandler(dependencies: Dependencies) {
  const now = dependencies.now ?? Date.now;
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

    const auth = await dependencies.authenticate(request);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    const imageRequest = parseRequest(request);
    if (!imageRequest) return json({ error: 'invalid_asset' }, 400);
    const resolved = await dependencies.resolveAsset(request, imageRequest, auth.userId);
    if (!resolved.ok) return json({ error: resolved.error }, resolved.status);
    if (resolved.expiresAt && Date.parse(resolved.expiresAt) <= now()) {
      return json({ error: 'brochure_expired' }, 410);
    }

    const control = cacheControl(resolved.expiresAt, now());
    const cached = await dependencies.getCached(resolved.cacheKey);
    if (cached) return imageResponse(cached, control);

    const source = await dependencies.fetchSource(resolved.sourceUrl);
    const downloaded = await readSourceImage(source);
    if (downloaded instanceof Response) return downloaded;

    const putResult = await dependencies.putCached(
      resolved.cacheKey,
      downloaded.body,
      downloaded.contentType,
    );
    if (putResult === 'already-existed') {
      const raced = await dependencies.getCached(resolved.cacheKey);
      if (!raced) return json({ error: 'cache_unavailable' }, 503);
      return imageResponse(raced, control);
    }
    return imageResponse(downloaded, control);
  };
}
