import { createHash, createHmac } from 'node:crypto';
import { type BrochureDump, type BrochureLocation, transformBrochure } from './brochures/transform';

// Isolierter Testlauf: spiegelt wenige Prospekt-Bilder einer PLZ nach R2 und
// ersetzt die Bring-CDN-URLs. Schreibt bewusst NICHT in Supabase — die Ausgabe
// ist ein JSON mit R2-URLs zur manuellen Kontrolle.

const MAX_BROCHURES = 5;
const MAX_PAGES_PER_BROCHURE = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const REQUEST_DELAY_MS = 500;
const CACHE_CONTROL = 'public, max-age=604800, immutable';

type TestConfig = {
  bringAuthToken: string;
  bringApiKey: string;
  bringUserUuid: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2Bucket: string;
  r2PublicUrl: string;
  zipCode: string;
  brochureLimit: number;
  pageLimit: number;
};

type R2UploadResult = {
  originalUrl: string;
  r2Key: string;
  r2Url: string;
  verified: boolean;
};

type TestOutput = {
  zipCode: string;
  brochures: Array<{
    id: string;
    store: string;
    coverImage: string;
    pages: number;
    uploads: R2UploadResult[];
  }>;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} fehlt.`);
  return value;
}

function parseArgs(): Pick<TestConfig, 'zipCode' | 'brochureLimit' | 'pageLimit'> {
  const plzArg = process.argv.find((value) => value.startsWith('--plz='));
  const limitArg = process.argv.find((value) => value.startsWith('--limit='));
  const pagesArg = process.argv.find((value) => value.startsWith('--pages='));

  const zipCode = plzArg?.slice('--plz='.length) ?? '22043';
  if (!/^\d{5}$/.test(zipCode)) throw new Error('--plz muss eine 5-stellige PLZ sein.');

  const brochureLimit = Number(limitArg?.slice('--limit='.length) ?? 2);
  const pageLimit = Number(pagesArg?.slice('--pages='.length) ?? 3);
  if (!Number.isInteger(brochureLimit) || brochureLimit < 1 || brochureLimit > MAX_BROCHURES) {
    throw new Error(`--limit muss zwischen 1 und ${MAX_BROCHURES} liegen.`);
  }
  if (!Number.isInteger(pageLimit) || pageLimit < 1 || pageLimit > MAX_PAGES_PER_BROCHURE) {
    throw new Error(`--pages muss zwischen 1 und ${MAX_PAGES_PER_BROCHURE} liegen.`);
  }
  return { zipCode, brochureLimit, pageLimit };
}

function loadConfig(): TestConfig {
  return {
    bringAuthToken: requireEnv('BRING_AUTH_TOKEN').replace(/^Bearer\s+/i, ''),
    bringApiKey: requireEnv('BRING_API_KEY'),
    bringUserUuid: requireEnv('BRING_USER_UUID'),
    r2AccountId: requireEnv('R2_ACCOUNT_ID'),
    r2AccessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
    r2SecretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    r2Bucket: requireEnv('R2_BUCKET'),
    r2PublicUrl: requireEnv('R2_PUBLIC_URL').replace(/\/+$/, ''),
    ...parseArgs(),
  };
}

function bringHeaders(config: TestConfig): HeadersInit {
  return {
    Authorization: `Bearer ${config.bringAuthToken}`,
    'X-BRING-API-KEY': config.bringApiKey,
    'X-BRING-CLIENT': 'iOS',
    'X-BRING-COUNTRY': 'DE',
    'X-BRING-VERSION': '4.110.0',
    'X-BRING-USER-UUID': config.bringUserUuid,
    'Accept-Language': 'de-DE',
    Accept: 'application/json',
  };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchJson(url: string, headers: HeadersInit): Promise<unknown> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(`Bring API ${response.status} fuer ${new URL(url).pathname}`);
  }
  return response.json();
}

async function fetchImage(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(`Bild-Download ${response.status} fuer ${new URL(url).pathname}`);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `Bild ueber ${MAX_IMAGE_BYTES / 1024 / 1024} MB uebersprungen: ${new URL(url).pathname}`,
    );
  }
  return buffer;
}

// Minimale AWS-SigV4-Signatur fuer R2 (service "s3", region "auto").
function signR2Request(
  config: TestConfig,
  method: 'PUT',
  key: string,
  extraHeaders: Record<string, string>,
): { url: string; headers: Record<string, string> } {
  const host = `${config.r2AccountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${config.r2Bucket}/${key}`;
  const now = new Date();
  const amzDate = `${now.toISOString().replace(/[:-]|\.\d{3}/g, '')}`;
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'x-amz-date': amzDate,
    ...extraHeaders,
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

  const kDate = createHmac('sha256', `AWS4${config.r2SecretAccessKey}`).update(dateStamp).digest();
  const kRegion = createHmac('sha256', kDate).update('auto').digest();
  const kService = createHmac('sha256', kRegion).update('s3').digest();
  const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  return {
    url: `https://${host}${canonicalUri}`,
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.r2AccessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

function sanitizeKeyPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

async function uploadToR2(config: TestConfig, key: string, body: ArrayBuffer): Promise<void> {
  const signed = signR2Request(config, 'PUT', key, { 'cache-control': CACHE_CONTROL });
  const response = await fetch(signed.url, {
    method: 'PUT',
    headers: signed.headers,
    body,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`R2 Upload ${response.status} fuer ${key}: ${errorBody.slice(0, 200)}`);
  }
}

async function verifyPublicUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchBrochureOffers(
  config: TestConfig,
  location: BrochureLocation,
): Promise<Array<{ brn: string }>> {
  const params = new URLSearchParams({
    type: 'brochure',
    providerId: 'bring-de',
    lat: String(location.latitude),
    long: String(location.longitude),
    zipCode: location.zipCode,
  });
  const listUrl = `https://production.bringapi.app/offers/rest/v1/offers?${params}`;
  const list = (await fetchJson(listUrl, bringHeaders(config))) as {
    offers?: Array<Record<string, unknown>>;
  };
  const offers = Array.isArray(list?.offers) ? list.offers : [];
  return offers
    .map((offer) => (typeof offer?.brn === 'string' ? { brn: offer.brn } : null))
    .filter((offer): offer is { brn: string } => offer !== null)
    .slice(0, config.brochureLimit);
}

function offerDetailUrl(brochureId: string, location: BrochureLocation): string {
  const params = new URLSearchParams({
    brochureId,
    lat: String(location.latitude),
    long: String(location.longitude),
    providerId: 'bring-de',
    zipCode: location.zipCode,
  });
  return `https://production.bringapi.app/offers/rest/v1/offers/brochures/${encodeURIComponent(brochureId)}?${params}`;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const location: BrochureLocation = {
    zipCode: config.zipCode,
    // Test-PLZ: Grobe Koordinate reicht fuer die Bring-Suche.
    latitude: 53.57,
    longitude: 10.03,
  };

  console.log(`Teste PLZ ${location.zipCode}, max ${config.brochureLimit} Prospekte...`);
  const offers = await fetchBrochureOffers(config, location);
  if (offers.length === 0) {
    console.log('Keine Prospekte gefunden.');
    return;
  }

  const output: TestOutput = { zipCode: location.zipCode, brochures: [] };
  const dumpRun = new Date().toISOString().slice(0, 10);

  for (const [offerIndex, offer] of offers.entries()) {
    console.log(`Prospekt ${offerIndex + 1}/${offers.length}: ${offer.brn}`);
    const detail = await fetchJson(offerDetailUrl(offer.brn, location), bringHeaders(config));
    const transformed = transformBrochure(offer, detail);
    if (!transformed) {
      console.log(`  -> Transformation fehlgeschlagen, uebersprungen.`);
      continue;
    }

    const brochure: BrochureDump = transformed.brochure;
    const keyPrefix = `brochures/test/${dumpRun}/${location.zipCode}/${sanitizeKeyPart(brochure.id)}`;
    const uploads: R2UploadResult[] = [];

    const selectedPages = brochure.pages.slice(0, config.pageLimit);
    const imageTasks: Array<{ originalUrl: string; key: string }> = [];

    const coverKey = `${keyPrefix}/cover.jpg`;
    imageTasks.push({ originalUrl: brochure.coverImage, key: coverKey });
    for (const page of selectedPages) {
      imageTasks.push({
        originalUrl: page.imageUrl,
        key: `${keyPrefix}/page-${String(page.number).padStart(3, '0')}.jpg`,
      });
    }

    for (const task of imageTasks) {
      const image = await fetchImage(task.originalUrl);
      await uploadToR2(config, task.key, image);
      const r2Url = `${config.r2PublicUrl}/${task.key}`;
      const verified = await verifyPublicUrl(r2Url);
      uploads.push({
        originalUrl: task.originalUrl,
        r2Key: task.key,
        r2Url,
        verified,
      });
      console.log(`  ${verified ? 'OK ' : 'ERR'} ${r2Url}`);
      await wait(REQUEST_DELAY_MS);
    }

    output.brochures.push({
      id: brochure.id,
      store: transformed.store.name,
      coverImage: uploads[0]?.r2Url ?? brochure.coverImage,
      pages: selectedPages.length,
      uploads,
    });
    await wait(REQUEST_DELAY_MS);
  }

  console.log('\n=== Ergebnis (JSON) ===');
  console.log(JSON.stringify(output, null, 2));
  const failed = output.brochures.flatMap((b) => b.uploads).filter((u) => !u.verified);
  if (failed.length > 0) {
    console.error(`\n${failed.length} Upload(s) nicht verifiziert. Kein Supabase-Write.`);
    process.exitCode = 1;
  } else {
    console.log('\nAlle Uploads verifiziert. Kein Supabase-Write (nur Ausgabe).');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
