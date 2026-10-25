import { createClient } from 'jsr:@supabase/supabase-js@2';
import { bringImageUrl } from '../_shared/bring-image-url.ts';
import {
  type AuthResult,
  type BrochureImageRequest,
  createBrochureImageHandler,
  type ResolvedAsset,
} from './handler.ts';
import { cacheKeyPart, getR2Object, putR2Object, type R2CacheConfig } from './r2-cache.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const r2Config: Partial<R2CacheConfig> = {
  accountId: Deno.env.get('R2_ACCOUNT_ID'),
  accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID'),
  secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY'),
  bucket: Deno.env.get('R2_BUCKET'),
};

function configuredR2(): R2CacheConfig | null {
  if (
    !r2Config.accountId || !r2Config.accessKeyId || !r2Config.secretAccessKey || !r2Config.bucket
  ) return null;
  return r2Config as R2CacheConfig;
}

function userClient(request: Request) {
  const authorization = request.headers.get('Authorization');
  return createClient(supabaseUrl, anonKey, {
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

async function authenticate(request: Request): Promise<AuthResult> {
  const authorization = request.headers.get('Authorization');
  if (!authorization) return { ok: false, status: 401, error: 'missing_authorization' };
  const { data, error } = await userClient(request).auth.getUser();
  if (error || !data.user) return { ok: false, status: 401, error: 'unauthorized' };
  return { ok: true, userId: data.user.id };
}

async function revision(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function resolveAsset(
  request: Request,
  imageRequest: BrochureImageRequest,
  _userId: string,
): Promise<ResolvedAsset> {
  const client = userClient(request);
  if (imageRequest.asset.kind === 'store-logo') {
    const { data, error } = await client
      .from('brochure_stores')
      .select('id,logo_url,active')
      .eq('id', imageRequest.asset.storeId)
      .maybeSingle();
    if (error) return { ok: false, status: 503, error: 'catalog_unavailable' };
    if (!data || !data.active) return { ok: false, status: 404, error: 'image_not_found' };
    const { data: activeBrochures, error: activeError } = await client
      .from('canonical_brochures')
      .select('valid_until')
      .eq('store_id', data.id)
      .lte('valid_from', new Date().toISOString())
      .gte('valid_until', new Date().toISOString())
      .order('valid_until', { ascending: false })
      .limit(1);
    if (activeError) return { ok: false, status: 503, error: 'catalog_unavailable' };
    const sourceUrl = bringImageUrl(data.logo_url)?.toString();
    const validUntil = activeBrochures?.[0]?.valid_until;
    if (typeof validUntil !== 'string' || !sourceUrl) {
      return { ok: false, status: 404, error: 'image_not_found' };
    }

    const validUntilTime = Date.parse(validUntil);
    if (!Number.isFinite(validUntilTime)) {
      return { ok: false, status: 503, error: 'catalog_invalid' };
    }
    if (validUntilTime <= Date.now()) return { ok: false, status: 404, error: 'image_not_found' };
    const expiresAt = new Date(validUntilTime).toISOString();
    const sourceRevision = await revision({ id: data.id, logo_url: sourceUrl });
    const imageRevision = await revision(sourceUrl);
    return {
      ok: true,
      sourceUrl,
      expiresAt,
      cacheKey: `brochures/demand/${expiresAt.slice(0, 10)}/logos/${
        cacheKeyPart(data.id)
      }/${sourceRevision}/${imageRevision}.img`,
    };
  }

  if (!imageRequest.brochureId) return { ok: false, status: 400, error: 'invalid_asset' };
  const { data, error } = await client
    .from('canonical_brochures')
    .select('id,source_zip_code,valid_until,cover_image,pages')
    .eq('id', imageRequest.brochureId)
    .maybeSingle();
  if (error) return { ok: false, status: 503, error: 'catalog_unavailable' };
  if (!data || typeof data.valid_until !== 'string') {
    return { ok: false, status: 404, error: 'image_not_found' };
  }
  const validUntil = Date.parse(data.valid_until);
  if (!Number.isFinite(validUntil)) return { ok: false, status: 503, error: 'catalog_invalid' };
  const expiresAt = new Date(validUntil).toISOString();
  if (Date.parse(expiresAt) <= Date.now()) {
    return { ok: false, status: 410, error: 'brochure_expired' };
  }
  const { data: availability, error: availabilityError } = await client
    .from('brochure_availability')
    .select('zip_code')
    .eq('canonical_brochure_id', data.id)
    .eq('zip_code', data.source_zip_code)
    .maybeSingle();
  if (availabilityError) return { ok: false, status: 503, error: 'catalog_unavailable' };
  if (!availability) return { ok: false, status: 404, error: 'image_not_found' };
  if (!Array.isArray(data.pages)) return { ok: false, status: 503, error: 'catalog_invalid' };

  const asset = imageRequest.asset;
  const page = asset.kind === 'cover'
    ? data.pages[0]
    : asset.kind === 'page' || asset.kind === 'hotspot'
    ? data.pages.find((candidate: { number?: unknown }) => candidate.number === asset.pageNumber)
    : undefined;
  let sourceCandidate: unknown = asset.kind === 'cover'
    ? data.cover_image
    : page && (page as { imageUrl?: unknown }).imageUrl;
  if (asset.kind === 'hotspot') {
    const hotspot = page && Array.isArray((page as { hotspots?: unknown[] }).hotspots)
      ? (page as { hotspots: Array<{ id?: unknown; imageUrl?: unknown }> }).hotspots.find(
        (candidate) => candidate.id === asset.hotspotId,
      )
      : undefined;
    sourceCandidate = hotspot?.imageUrl;
  }
  const sourceUrl = bringImageUrl(sourceCandidate)?.toString();
  if (!sourceUrl) return { ok: false, status: 404, error: 'image_not_found' };

  const sourceRevision = await revision({
    id: data.id,
    source_zip_code: data.source_zip_code,
    cover_image: data.cover_image,
    pages: data.pages,
  });
  const imageRevision = await revision(sourceUrl);
  return {
    ok: true,
    sourceUrl,
    expiresAt,
    cacheKey: `brochures/demand/${expiresAt.slice(0, 10)}/zip-${
      cacheKeyPart(data.source_zip_code)
    }/${cacheKeyPart(data.id)}/${sourceRevision}/${imageRevision}.img`,
  };
}

const handler = createBrochureImageHandler({
  authenticate,
  resolveAsset,
  getCached: (key) => {
    const config = configuredR2();
    if (!config) throw new Error('r2_not_configured');
    return getR2Object(config, key);
  },
  fetchSource: (url) => fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) }),
  putCached: (key, body, contentType) => {
    const config = configuredR2();
    if (!config) throw new Error('r2_not_configured');
    return putR2Object(config, key, body, contentType);
  },
});

Deno.serve(async (request) => {
  try {
    return await handler(request);
  } catch (error) {
    console.error(
      'brochure_image_unhandled_error',
      error instanceof Error ? error.name : 'unknown',
    );
    return new Response(JSON.stringify({ error: 'brochure_image_unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
});
