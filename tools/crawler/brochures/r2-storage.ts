import { createHash, createHmac } from 'node:crypto';
import type { CrawlerBrochure } from './types';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const CACHE_CONTROL = 'public, max-age=604800, immutable';
const DUMP_RUN_PREFIX = 'brochures/dumps/';

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
};

export function loadR2Config(options?: { disabled?: boolean }): R2Config | null {
  if (options?.disabled) return null;

  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim() || process.env.R2_BUCKET_NAME?.trim();
  const publicUrl = process.env.R2_PUBLIC_URL?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicUrl: publicUrl.replace(/\/+$/, ''),
  };
}

export function sanitizeKeyPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

/**
 * Erzeugt den deterministischen R2-Key für ein Bild anhand von brochureId, Kontext und Original-URL Hash.
 */
export function imageKeyFor(originalUrl: string, brochureId: string, context: string): string {
  const hash = createHash('sha256').update(originalUrl).digest('hex').slice(0, 16);
  return `${DUMP_RUN_PREFIX}${sanitizeKeyPart(brochureId)}/${context}-${hash}.jpg`;
}

type R2RequestOptions = {
  method?: 'HEAD' | 'PUT';
  headers?: Record<string, string>;
};

/**
 * Erzeugt AWS-SigV4-Signaturen für R2-Anfragen.
 */
export function signR2Request(
  config: R2Config,
  key: string,
  options: R2RequestOptions = {},
): { url: string; headers: Record<string, string> } {
  const method = options.method ?? 'PUT';
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${config.bucket}/${key}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...(method === 'PUT' ? { 'cache-control': CACHE_CONTROL } : {}),
    ...Object.fromEntries(
      Object.entries(options.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
    ),
  };

  const sortedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderNames
    .map((name) => `${name}:${headers[name].trim()}\n`)
    .join('');
  const signedHeaders = sortedHeaderNames.join(';');

  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const kDate = createHmac('sha256', `AWS4${config.secretAccessKey}`).update(dateStamp).digest();
  const kRegion = createHmac('sha256', kDate).update('auto').digest();
  const kService = createHmac('sha256', kRegion).update('s3').digest();
  const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  return {
    url: `https://${host}${canonicalUri}`,
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

async function retryDelay(attempt: number): Promise<void> {
  const backoffMs = 2 ** attempt * 2000 + Math.floor(Math.random() * 1000);
  await new Promise((resolve) => setTimeout(resolve, backoffMs));
}

async function headR2Object(config: R2Config, key: string): Promise<Response | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const signed = signR2Request(config, key, { method: 'HEAD' });
    const response = await fetch(signed.url, {
      method: 'HEAD',
      headers: signed.headers,
      signal: AbortSignal.timeout(30_000),
    });

    if (response.ok) return response;
    if (response.status === 404) return null;

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 2) {
      throw new Error(`R2 HEAD ${response.status} für ${key}`);
    }
    await retryDelay(attempt);
  }
  return null;
}

/** Prüft über die geteilte R2-Instanz, ob ein Objekt bereits existiert. */
export async function r2ObjectExists(config: R2Config, key: string): Promise<boolean> {
  return (await headR2Object(config, key)) !== null;
}

export async function uploadToR2(
  config: R2Config,
  key: string,
  body: ArrayBuffer,
): Promise<'uploaded' | 'already-existed'> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const signed = signR2Request(config, key, {
      headers: { 'if-none-match': '*' },
    });
    const response = await fetch(signed.url, {
      method: 'PUT',
      headers: signed.headers,
      body,
      signal: AbortSignal.timeout(30_000),
    });

    if (response.ok) return 'uploaded';
    if (response.status === 412) return 'already-existed';

    const errorBody = await response.text().catch(() => '');
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 2) {
      throw new Error(`R2 Upload ${response.status} für ${key}: ${errorBody.slice(0, 200)}`);
    }
    await retryDelay(attempt);
  }
  throw new Error(`R2 Upload für ${key} ohne Ergebnis beendet.`);
}

async function fetchImage(originalUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(originalUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Bild-Download ${response.status} für ${originalUrl}`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `Bild ${originalUrl} überschreitet ${(MAX_IMAGE_BYTES / 1024 / 1024).toFixed(0)} MB.`,
    );
  }
  return buffer;
}

/**
 * Spiegelt Cover- und Seitengrafiken eines Prospekts nach Cloudflare R2
 * und ersetzt die URLs durch die neue R2 Public URL.
 */
export async function mirrorBrochureImagesToR2(
  brochure: CrawlerBrochure,
  config: R2Config,
  uploadedUrlCache: Map<string, string | Promise<string>>,
): Promise<CrawlerBrochure> {
  const updatedBrochure: CrawlerBrochure = {
    ...brochure,
    pages: [...(brochure.pages || [])],
  };

  const tasks: Array<{
    originalUrl: string;
    context: string;
    apply: (r2Url: string) => void;
  }> = [];

  // 1. Cover Image
  if (brochure.coverImage && !brochure.coverImage.startsWith(config.publicUrl)) {
    tasks.push({
      originalUrl: brochure.coverImage,
      context: 'cover',
      apply: (r2Url) => {
        updatedBrochure.coverImage = r2Url;
      },
    });
  }

  // 2. Page Images
  updatedBrochure.pages = (brochure.pages || []).map((page, index) => {
    const updatedPage = { ...page };
    if (page.imageUrl && !page.imageUrl.startsWith(config.publicUrl)) {
      const pageNumStr = String(page.number ?? index + 1).padStart(3, '0');
      tasks.push({
        originalUrl: page.imageUrl,
        context: `page-${pageNumStr}`,
        apply: (r2Url) => {
          updatedPage.imageUrl = r2Url;
        },
      });
    }
    return updatedPage;
  });

  // Bilder parallel mit Concurrency herunterladen und nach R2 hochladen
  const CONCURRENCY = 2;
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const chunk = tasks.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (task) => {
        const cached = uploadedUrlCache.get(task.originalUrl);
        if (cached) {
          task.apply(await cached);
          return;
        }

        const mirrorPromise = (async () => {
          const key = imageKeyFor(task.originalUrl, brochure.id, task.context);
          const r2Url = `${config.publicUrl}/${key}`;

          if (await r2ObjectExists(config, key)) {
            return r2Url;
          }

          const imageBuffer = await fetchImage(task.originalUrl);
          await uploadToR2(config, key, imageBuffer);

          return r2Url;
        })();
        uploadedUrlCache.set(task.originalUrl, mirrorPromise);

        try {
          const r2Url = await mirrorPromise;
          uploadedUrlCache.set(task.originalUrl, r2Url);
          task.apply(r2Url);
        } catch (err) {
          uploadedUrlCache.delete(task.originalUrl);
          console.warn(`⚠️ R2-Upload für ${task.originalUrl} fehlgeschlagen, behalte Original-URL:`, err);
        }
      }),
    );
  }

  return updatedBrochure;
}
