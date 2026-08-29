import { createHash, createHmac } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import type { BrochureDump } from './brochures/transform';

// Einmalige In-Place-Migration: spiegelt bereits gecrawlte Prospekt-Bilder von
// Bring-CDN nach R2 und aktualisiert die bestehenden Supabase-Dumps. Kein
// Bring-API-Aufruf, keine neuen Zeilen, jedes Bild exakt einmal hochgeladen.
//
// Ohne Flags: nur Analyse (dry-run). Upload/Update nur mit explizitem Flag.

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_STORED_IMAGE_WIDTH = 2048;
const JPEG_QUALITY = 82;
const REQUEST_DELAY_MS = 250;
const BATCH_SIZE = 50;
const CACHE_CONTROL = 'public, max-age=604800, immutable';
const DUMP_RUN_PREFIX = 'brochures/dumps/';

type PayloadStores = { logoUrl?: string | null };
type PayloadBrochure = BrochureDump & { storeId: string; pages: BrochureDump['pages'] };
type PayloadJson = {
  stores?: PayloadStores[];
  brochures?: PayloadBrochure[];
};

type SupabaseDumpRow = {
  id: string;
  zip_code: string;
  payload_json: unknown;
  created_at: string;
};

type ImageTask = {
  brochureId: string;
  originalUrl: string;
  key: string;
};

type Checkpoint = Record<string, string>; // originalUrl -> r2Url

type MigrationOptions = {
  supabaseUrl: string;
  supabaseSecretKey: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2Bucket: string;
  r2PublicUrl: string;
  checkpointPath: string;
  execute: boolean;
};

type PlanEntry = {
  dumpId: string;
  zipCode: string;
  replacedCount: number;
  pendingCount: number;
  failedCount: number;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} fehlt.`);
  return value;
}

function requireSupabaseUrl(): string {
  return process.env.SUPABASE_URL?.trim() || requireEnv('EXPO_PUBLIC_SUPABASE_URL');
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

function renderProgressBar(current: number, total: number, startTime: number, extra: string): void {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const barLength = 16;
  const filled = Math.round((percent / 100) * barLength);
  const empty = barLength - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
  const speed = (current / elapsedSec).toFixed(1);
  const remainingSec =
    current > 0 && total > current ? (total - current) / (current / elapsedSec) : 0;
  const etaStr = remainingSec > 0 ? formatDuration(remainingSec) : '0s';

  process.stdout.write(
    `\r⏳ [${bar}] ${percent}% | ${current}/${total} Bilder | ${speed} Bilder/s | ⏱️ ETA: ${etaStr} | ${extra}    `,
  );
}

function parseArgs(): Pick<MigrationOptions, 'execute' | 'checkpointPath'> {
  const execute = process.argv.includes('--execute');
  const checkpointArg = process.argv.find((value) => value.startsWith('--checkpoint='));
  return {
    execute,
    checkpointPath:
      checkpointArg?.slice('--checkpoint='.length) ?? '/tmp/brochures-r2-checkpoint.json',
  };
}

function loadOptions(): MigrationOptions {
  return {
    supabaseUrl: requireSupabaseUrl(),
    supabaseSecretKey: requireEnv('SUPABASE_SECRET_KEY'),
    r2AccountId: requireEnv('R2_ACCOUNT_ID'),
    r2AccessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
    r2SecretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    r2Bucket: requireEnv('R2_BUCKET'),
    r2PublicUrl: requireEnv('R2_PUBLIC_URL').replace(/\/+$/, ''),
    ...parseArgs(),
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Supabase und Cloudflare/R2 antworten gelegentlich mit 5xx. Ein kurzes
// exponentielles Backoff reicht fuer eine Migration — der Checkpoint macht
// den Rest, falls ein Fehler nach vier Versuchen immer noch besteht.
async function withRetry<T>(label: string, operation: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      const delay = 2 ** attempt * 1000;
      console.warn(
        `${label} fehlgeschlagen (Versuch ${attempt + 1}/${attempts}), neuer Versuch in ${delay} ms.`,
      );
      await wait(delay);
    }
  }
  throw lastError;
}

function sanitizeKeyPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function imageKeyFor(originalUrl: string): string {
  const hash = createHash('sha256').update(originalUrl).digest('hex');
  return `${DUMP_RUN_PREFIX}assets/${hash}.jpg`;
}

// Minimale AWS-SigV4-Signatur fuer R2 (service "s3", region "auto").
function signR2Request(
  options: MigrationOptions,
  key: string,
): { url: string; headers: Record<string, string> } {
  const method = 'PUT';
  const host = `${options.r2AccountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${options.r2Bucket}/${key}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'x-amz-date': amzDate,
    'cache-control': CACHE_CONTROL,
    'content-type': 'image/jpeg',
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
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const kDate = createHmac('sha256', `AWS4${options.r2SecretAccessKey}`).update(dateStamp).digest();
  const kRegion = createHmac('sha256', kDate).update('auto').digest();
  const kService = createHmac('sha256', kRegion).update('s3').digest();
  const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  return {
    url: `https://${host}${canonicalUri}`,
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${options.r2AccessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

async function uploadToR2(
  options: MigrationOptions,
  key: string,
  body: ArrayBuffer,
): Promise<void> {
  const signed = signR2Request(options, key);
  const response = await fetch(signed.url, {
    method: 'PUT',
    headers: signed.headers,
    body,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`R2 Upload ${response.status} fuer ${key}: ${errorBody.slice(0, 200)}`);
  }
}

async function fetchImage(originalUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(originalUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Bild-Download ${response.status} fuer ${originalUrl}`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `Bild ${originalUrl} ueberschreitet ${(MAX_IMAGE_BYTES / 1024 / 1024).toFixed(0)} MB.`,
    );
  }
  return buffer;
}

async function optimizeImage(buffer: ArrayBuffer): Promise<ArrayBuffer> {
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

async function verifyPublicUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function loadCheckpoint(path: string): Promise<Checkpoint> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Checkpoint;
  } catch {
    return {};
  }
}

async function saveCheckpoint(path: string, checkpoint: Checkpoint): Promise<void> {
  await writeFile(path, JSON.stringify(checkpoint, null, 2));
}

type UrlLocation = {
  brochureId: string;
  pageContext: string;
  payloadBrochure: PayloadBrochure;
  field: 'coverImage' | 'imageUrl';
  page?: BrochureDump['pages'][number];
};

async function main(): Promise<void> {
  const options = loadOptions();
  const supabase = createClient(options.supabaseUrl, options.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('Lese bestehende Dumps aus Supabase...');
  const rows: SupabaseDumpRow[] = [];
  const readStart = Date.now();
  let from = 0;
  for (;;) {
    const { data } = await withRetry('Supabase-Read', () =>
      supabase
        .from('brochure_dumps')
        .select('id, zip_code, payload_json, created_at')
        .order('zip_code', { ascending: true })
        .range(from, from + BATCH_SIZE - 1),
    );
    if (!data || data.length === 0) break;
    rows.push(...(data as SupabaseDumpRow[]));
    from += data.length;
    renderProgressBar(from, rows.length + BATCH_SIZE, readStart, '☁️ Zeilen geladen');
    if (data.length < BATCH_SIZE) break;
  }
  process.stdout.write('\n');
  console.log(`${rows.length} Dump-Zeilen gefunden.`);

  // Deduplizierung: ein Bild wird nur einmal pro originaler URL hochgeladen.
  const urlMap = new Map<string, UrlLocation>();
  for (const row of rows) {
    const payload = row.payload_json as PayloadJson;
    const brochures = Array.isArray(payload?.brochures) ? payload.brochures : [];
    for (const brochure of brochures) {
      const brochureId = sanitizeKeyPart(brochure.id);
      const existing = urlMap.get(brochure.coverImage);
      if (!existing) {
        urlMap.set(brochure.coverImage, {
          brochureId,
          pageContext: 'cover',
          payloadBrochure: brochure,
          field: 'coverImage',
        });
      }
      for (const page of brochure.pages ?? []) {
        const pageExisting = urlMap.get(page.imageUrl);
        if (!pageExisting) {
          urlMap.set(page.imageUrl, {
            brochureId,
            pageContext: `page-${String(page.number).padStart(3, '0')}`,
            payloadBrochure: brochure,
            field: 'imageUrl',
            page,
          });
        }
      }
    }
  }
  console.log(`${urlMap.size} eindeutige Bild-URLs gefunden (inkl. Cover).`);

  const checkpoint = await loadCheckpoint(options.checkpointPath);
  const pending: ImageTask[] = [];
  const alreadyMigrated = new Map<string, string>();
  const failedUrls: string[] = [];

  for (const [originalUrl, location] of urlMap) {
    if (checkpoint[originalUrl]) {
      alreadyMigrated.set(originalUrl, checkpoint[originalUrl]);
      continue;
    }
    pending.push({
      brochureId: location.brochureId,
      originalUrl,
      key: imageKeyFor(originalUrl),
    });
  }

  console.log(
    `${alreadyMigrated.size} Bilder laut Checkpoint bereits migriert, ${pending.length} noch offen.`,
  );

  if (!options.execute) {
    console.log('\nDry-Run: keine Uploads, keine Supabase-Updates.');
    console.log('Fuer Ausfuehrung: --execute (Checkpoint-Resume aktiv).');
    return;
  }

  const migratedUrls = new Map<string, string>();
  const progressStart = Date.now();
  let completed = 0;
  for (const task of pending) {
    try {
      await withRetry(`Bild ${task.originalUrl}`, async () => {
        const image = await fetchImage(task.originalUrl);
        await uploadToR2(options, task.key, await optimizeImage(image));
      });
      const r2Url = `${options.r2PublicUrl}/${task.key}`;
      const verified = await verifyPublicUrl(r2Url);
      if (!verified) throw new Error(`Public-URL nicht erreichbar: ${r2Url}`);
      migratedUrls.set(task.originalUrl, r2Url);
      checkpoint[task.originalUrl] = r2Url;
      completed += 1;
      renderProgressBar(
        completed + alreadyMigrated.size,
        urlMap.size,
        progressStart,
        `☁️ ${migratedUrls.size} migriert`,
      );
      if (completed % 25 === 0) {
        await saveCheckpoint(options.checkpointPath, checkpoint);
      }
    } catch (error) {
      failedUrls.push(task.originalUrl);
      console.error(
        `Fehler bei ${task.originalUrl}:`,
        error instanceof Error ? error.message : error,
      );
    }
    await wait(REQUEST_DELAY_MS);
  }
  await saveCheckpoint(options.checkpointPath, checkpoint);
  for (const [originalUrl, r2Url] of alreadyMigrated) migratedUrls.set(originalUrl, r2Url);

  if (failedUrls.length > 0) {
    console.error(
      `\n${failedUrls.length} Bilder fehlgeschlagen. Supabase-Update wird abgebrochen.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Alle Bilder migriert. Aktualisiere Supabase-Zeilen...`);
  let updatedRows = 0;
  const plan: PlanEntry[] = [];
  for (const row of rows) {
    const payload = row.payload_json as PayloadJson;
    const brochures = Array.isArray(payload?.brochures) ? payload.brochures : [];
    let replaced = 0;
    for (const brochure of brochures) {
      const replacement = migratedUrls.get(brochure.coverImage);
      if (replacement) {
        brochure.coverImage = replacement;
        replaced += 1;
      }
      for (const page of brochure.pages ?? []) {
        const pageReplacement = migratedUrls.get(page.imageUrl);
        if (pageReplacement) {
          page.imageUrl = pageReplacement;
          replaced += 1;
        }
      }
    }
    // Store-Logos verbleiben bewusst auf der Original-URL: sie stammen von
    // Wikimedia/eigenen CDN-Hosts und sind nicht Teil der Wochen-Lifecycle.
    plan.push({
      dumpId: row.id,
      zipCode: row.zip_code,
      replacedCount: replaced,
      pendingCount: 0,
      failedCount: 0,
    });
    if (replaced > 0) {
      const { error } = await withRetry(`Supabase-Update ${row.id}`, () =>
        supabase.from('brochure_dumps').update({ payload_json: payload }).eq('id', row.id),
      );
      if (error)
        throw new Error(`Supabase-Update fuer Dump ${row.id} fehlgeschlagen: ${error.message}`);
      updatedRows += 1;
    }
  }

  console.log(
    `Fertig: ${updatedRows} Zeilen aktualisiert, ${migratedUrls.size} eindeutige Bilder.`,
  );
  console.table(plan.slice(0, 10));
  await saveCheckpoint(options.checkpointPath, checkpoint);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
