import { createHash, createHmac } from 'node:crypto';
import sharp from 'sharp';
import { createStorageBudget, type StorageAsset, type StorageBudget } from './storage-policy';
import type { CrawlerBrochure } from './types';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_STORED_IMAGE_WIDTH = 2048;
const JPEG_QUALITY = 82;
const CACHE_CONTROL = 'public, max-age=604800, immutable';
const DUMP_RUN_PREFIX = 'brochures/dumps/';

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
  storageBudgetBytes?: number;
  storageBudget?: StorageBudget;
};

export function loadR2Config(options?: {
  disabled?: boolean;
  storageBudgetBytes?: number;
  storageBudget?: StorageBudget;
}): R2Config | null {
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
    ...(options?.storageBudgetBytes === undefined
      ? {}
      : { storageBudgetBytes: options.storageBudgetBytes }),
    ...(options?.storageBudget ? { storageBudget: options.storageBudget } : {}),
  };
}

export function sanitizeKeyPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

/**
 * Erzeugt einen globalen, URL-basierten Asset-Key.
 *
 * Die Prospekt-ID gehört absichtlich nicht in den Key: Dasselbe CDN-Bild kann
 * in mehreren PLZ-Dumps und Prospekt-IDs auftauchen und soll nur einmal in R2
 * liegen. Der bestehende dumps/-Prefix bleibt erhalten, damit die vorhandene
 * Lifecycle-Regel weiterhin auch neue Assets erfasst.
 */
export function imageKeyFor(originalUrl: string): string {
  const hash = createHash('sha256').update(originalUrl).digest('hex');
  return `${DUMP_RUN_PREFIX}assets/${hash}.jpg`;
}

export function legacyImageKeyFor(
  originalUrl: string,
  brochureId: string,
  context: string,
): string {
  const hash = createHash('sha256').update(originalUrl).digest('hex').slice(0, 16);
  return `${DUMP_RUN_PREFIX}${sanitizeKeyPart(brochureId)}/${context}-${hash}.jpg`;
}

type R2RequestOptions = {
  method?: 'GET' | 'HEAD' | 'PUT';
  headers?: Record<string, string>;
  query?: Record<string, string | undefined>;
};

function encodeQueryComponent(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalQuery(query: Record<string, string | undefined>): string {
  return Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${encodeQueryComponent(name)}=${encodeQueryComponent(value ?? '')}`)
    .join('&');
}

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
  const canonicalUri = key ? `/${config.bucket}/${key}` : `/${config.bucket}`;
  const queryString = canonicalQuery(options.query ?? {});
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
    queryString,
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
    url: `https://${host}${canonicalUri}${queryString ? `?${queryString}` : ''}`,
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

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function xmlValue(fragment: string, tag: string): string | undefined {
  const match = fragment.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match?.[1] === undefined ? undefined : decodeXml(match[1]);
}

function parseR2ObjectList(xml: string): {
  objects: StorageAsset[];
  nextContinuationToken?: string;
} {
  const objects: StorageAsset[] = [];
  for (const fragment of xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? []) {
    const key = xmlValue(fragment, 'Key');
    const sizeValue = xmlValue(fragment, 'Size');
    const bytes = sizeValue === undefined ? Number.NaN : Number(sizeValue);
    if (!key || !Number.isSafeInteger(bytes) || bytes < 0) {
      throw new Error('R2-Bestandsliste enthält ein ungültiges Asset.');
    }
    objects.push({ key, bytes });
  }

  const isTruncated = xmlValue(xml, 'IsTruncated')?.toLowerCase() === 'true';
  const nextContinuationToken = xmlValue(xml, 'NextContinuationToken');
  if (isTruncated && !nextContinuationToken) {
    throw new Error('R2-Bestandsliste ist abgeschnitten, liefert aber kein Fortsetzungstoken.');
  }
  return {
    objects,
    ...(nextContinuationToken ? { nextContinuationToken } : {}),
  };
}

/** Listet den vollständigen R2-Bestand, einschließlich aller Folgeseiten. */
export async function listR2Objects(config: R2Config, prefix = ''): Promise<StorageAsset[]> {
  const objects: StorageAsset[] = [];
  const seenTokens = new Set<string>();
  let continuationToken: string | undefined;

  while (true) {
    if (continuationToken) {
      if (seenTokens.has(continuationToken)) {
        throw new Error('R2-Bestandsliste verwendet ein wiederholtes Fortsetzungstoken.');
      }
      seenTokens.add(continuationToken);
    }

    const signed = signR2Request(config, '', {
      method: 'GET',
      query: {
        'list-type': '2',
        ...(prefix ? { prefix } : {}),
        'continuation-token': continuationToken,
      },
    });
    const response = await fetch(signed.url, {
      method: 'GET',
      headers: signed.headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(
        `R2-Bestandsliste ${response.status}: ${(await response.text()).slice(0, 200)}`,
      );
    }

    const page = parseR2ObjectList(await response.text());
    objects.push(...page.objects);
    continuationToken = page.nextContinuationToken;
    if (!continuationToken) return objects;
  }
}

const r2BudgetPromises = new WeakMap<R2Config, Promise<StorageBudget | undefined>>();

/** Baut den Budgetzustand einmalig aus dem vollständigen R2-Bestand auf. */
export async function ensureR2StorageBudget(config: R2Config): Promise<StorageBudget | undefined> {
  if (config.storageBudget) {
    if (
      config.storageBudgetBytes !== undefined &&
      config.storageBudget.budgetBytes !== config.storageBudgetBytes
    ) {
      throw new Error('Die R2-Budgetkonfiguration enthält widersprüchliche Bytebudgets.');
    }
    return config.storageBudget;
  }
  if (config.storageBudgetBytes === undefined) return undefined;

  const pending = r2BudgetPromises.get(config);
  if (pending) return pending;

  const promise = (async () => {
    const existingAssets = await listR2Objects(config);
    const budget = createStorageBudget({
      budgetBytes: config.storageBudgetBytes,
      existingAssets,
    });
    config.storageBudget = budget;
    return budget;
  })();
  r2BudgetPromises.set(config, promise);
  try {
    return await promise;
  } catch (error) {
    r2BudgetPromises.delete(config);
    throw error;
  }
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
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(originalUrl, { signal: AbortSignal.timeout(30_000) });
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > MAX_IMAGE_BYTES) {
          throw new Error(
            `Bild ${originalUrl} überschreitet ${(MAX_IMAGE_BYTES / 1024 / 1024).toFixed(0)} MB.`,
          );
        }
        return buffer;
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 3) {
        throw new Error(`Bild-Download ${response.status} für ${originalUrl}`);
      }
    } catch (error) {
      if (attempt === 3) throw error;
    }
    await retryDelay(attempt);
  }
  throw new Error(`Bild-Download für ${originalUrl} ohne Ergebnis beendet.`);
}

/**
 * Reduziert große CDN-Bilder vor dem Upload. Prospektseiten bleiben mit 2048px
 * Breite lesbar, benötigen aber deutlich weniger R2-Speicher und Bandbreite.
 * Bei einem nicht decodierbaren Bild bleibt der bisherige Upload-Pfad erhalten.
 */
export async function optimizeImage(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    const optimized = await sharp(Buffer.from(buffer))
      .rotate()
      .resize({ width: MAX_STORED_IMAGE_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, progressive: true })
      .toBuffer();

    return optimized.buffer.slice(
      optimized.byteOffset,
      optimized.byteOffset + optimized.byteLength,
    ) as ArrayBuffer;
  } catch {
    return buffer;
  }
}

export async function downloadOptimizedImage(originalUrl: string): Promise<ArrayBuffer> {
  return optimizeImage(await fetchImage(originalUrl));
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
  const storageBudget = await ensureR2StorageBudget(config);
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
      tasks.push({
        originalUrl: page.imageUrl,
        context: `page-${String(page.number ?? index + 1).padStart(3, '0')}`,
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
    const results = await Promise.allSettled(
      chunk.map(async (task) => {
        const cached = uploadedUrlCache.get(task.originalUrl);
        if (cached) {
          task.apply(await cached);
          return;
        }

        const mirrorPromise = (async () => {
          const key = imageKeyFor(task.originalUrl);
          const r2Url = `${config.publicUrl}/${key}`;

          if (await r2ObjectExists(config, key)) {
            return r2Url;
          }
          storageBudget?.markMissing(key);

          // Während der Umstellung alte, noch gültige Objekte weiterverwenden.
          // So erzeugt der erste Lauf keine zweite Kopie jedes bereits geladenen Bildes.
          const legacyKey = legacyImageKeyFor(task.originalUrl, brochure.id, task.context);
          if (await r2ObjectExists(config, legacyKey)) {
            return `${config.publicUrl}/${legacyKey}`;
          }
          storageBudget?.markMissing(legacyKey);

          const storedImage = await downloadOptimizedImage(task.originalUrl);
          const reservation = storageBudget?.reserve(key, storedImage.byteLength);
          await uploadToR2(config, key, storedImage);
          reservation?.commit(storedImage.byteLength);

          return r2Url;
        })();
        uploadedUrlCache.set(task.originalUrl, mirrorPromise);

        try {
          const r2Url = await mirrorPromise;
          uploadedUrlCache.set(task.originalUrl, r2Url);
          task.apply(r2Url);
        } catch (error) {
          uploadedUrlCache.delete(task.originalUrl);
          throw error;
        }
      }),
    );
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failed) throw failed.reason;
  }

  return updatedBrochure;
}
