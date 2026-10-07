import { readFile } from 'node:fs/promises';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  type BrochureDump,
  type BrochureLocation,
  type BrochureStoreDump,
  parseBrochureLocations,
  parseGeoNamesPostalCodes,
  transformBrochure,
} from './brochures/transform';

type PipelineConfig = {
  bringAuthToken: string;
  bringApiKey: string;
  bringUserUuid: string;
  supabaseUrl: string;
  supabaseSecretKey: string;
  locations: BrochureLocation[];
  dryRun: boolean;
};

type LocationDump = {
  location: BrochureLocation;
  stores: BrochureStoreDump[];
  brochures: BrochureDump[];
};

const CONCURRENCY = 12;
const UPLOAD_BATCH_SIZE = 24;
const EMPTY_DUMP_LIFETIME_MS = 8 * 24 * 60 * 60 * 1000;
const MIN_EXPECTED_GERMAN_POSTAL_CODES = 8_000;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} fehlt.`);
  return value;
}

function optionalLimit(): number | null {
  const argument = process.argv.find((value) => value.startsWith('--limit='));
  if (!argument) return null;
  const limit = Number(argument.slice('--limit='.length));
  if (!Number.isInteger(limit) || limit <= 0) throw new Error('--limit muss positiv sein.');
  return limit;
}

async function loadLocations(): Promise<BrochureLocation[]> {
  const file = process.env.BROCHURE_LOCATIONS_FILE?.trim();
  const locations = file
    ? parseGeoNamesPostalCodes(await readFile(file, 'utf8'))
    : parseBrochureLocations(process.env.BROCHURE_LOCATIONS_JSON);
  if (file && locations.length < MIN_EXPECTED_GERMAN_POSTAL_CODES) {
    throw new Error(
      `GeoNames-Datei ist unvollstaendig: nur ${locations.length} deutsche PLZ gefunden.`,
    );
  }
  const limit = optionalLimit();
  return limit ? locations.slice(0, limit) : locations;
}

async function loadConfig(): Promise<PipelineConfig> {
  const dryRun = process.argv.includes('--dry-run');
  return {
    bringAuthToken: requireEnv('BRING_AUTH_TOKEN').replace(/^Bearer\s+/i, ''),
    bringApiKey: requireEnv('BRING_API_KEY'),
    bringUserUuid: requireEnv('BRING_USER_UUID'),
    supabaseUrl: dryRun ? (process.env.SUPABASE_URL ?? '') : requireEnv('SUPABASE_URL'),
    supabaseSecretKey: dryRun
      ? (process.env.SUPABASE_SECRET_KEY ?? '')
      : requireEnv('SUPABASE_SECRET_KEY'),
    locations: await loadLocations(),
    dryRun,
  };
}

function bringHeaders(config: PipelineConfig): HeadersInit {
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
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
    if (response.ok) return response.json();

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 3) {
      throw new Error(`Bring API ${response.status} fuer ${new URL(url).pathname}`);
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    const delay =
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
    await wait(Math.min(delay, 30_000));
  }
  throw new Error('Bring API konnte nicht erreicht werden.');
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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

async function buildLocationDump(
  config: PipelineConfig,
  location: BrochureLocation,
  detailCache: Map<string, Promise<unknown>>,
): Promise<LocationDump> {
  const params = new URLSearchParams({
    type: 'brochure',
    providerId: 'bring-de',
    lat: String(location.latitude),
    long: String(location.longitude),
    zipCode: location.zipCode,
  });
  const listUrl = `https://production.bringapi.app/offers/rest/v1/offers?${params}`;
  const list = record(await fetchJson(listUrl, bringHeaders(config)));
  const offers = Array.isArray(list?.offers) ? list.offers : [];
  const stores = new Map<string, BrochureStoreDump>();
  const brochures = new Map<string, BrochureDump>();

  for (const offerValue of offers) {
    const offer = record(offerValue);
    const brochureId = typeof offer?.brn === 'string' ? offer.brn : null;
    if (!brochureId) continue;

    let detailPromise = detailCache.get(brochureId);
    if (!detailPromise) {
      detailPromise = fetchJson(offerDetailUrl(brochureId, location), bringHeaders(config));
      detailCache.set(brochureId, detailPromise);
      detailPromise.catch(() => detailCache.delete(brochureId));
    }
    const transformed = transformBrochure(offer, await detailPromise);
    if (!transformed) continue;
    stores.set(transformed.store.id, transformed.store);
    brochures.set(transformed.brochure.id, transformed.brochure);
  }

  return {
    location,
    stores: [...stores.values()],
    brochures: [...brochures.values()],
  };
}

function validityRange(
  brochures: BrochureDump[],
  now: Date,
): { validFrom: string; validUntil: string } {
  if (brochures.length === 0) {
    return {
      validFrom: now.toISOString(),
      validUntil: new Date(now.getTime() + EMPTY_DUMP_LIFETIME_MS).toISOString(),
    };
  }
  return {
    validFrom: brochures.reduce(
      (earliest, brochure) => (brochure.validFrom < earliest ? brochure.validFrom : earliest),
      brochures[0].validFrom,
    ),
    validUntil: brochures.reduce(
      (latest, brochure) => (brochure.validUntil > latest ? brochure.validUntil : latest),
      brochures[0].validUntil,
    ),
  };
}

async function publishBatch(
  supabase: SupabaseClient,
  dumps: LocationDump[],
  runStartedAt: string,
): Promise<void> {
  const stores = new Map<string, BrochureStoreDump>();
  for (const dump of dumps) {
    for (const store of dump.stores) stores.set(store.id, store);
  }
  if (stores.size > 0) {
    const { error } = await supabase.from('brochure_stores').upsert(
      [...stores.values()].map((store) => ({
        id: store.id,
        name: store.name,
        logo_url: store.logoUrl,
        active: true,
      })),
      { onConflict: 'id' },
    );
    if (error) throw error;
  }

  const now = new Date();
  const { error: insertError } = await supabase.from('brochure_dumps').insert(
    dumps.map((dump) => {
      const validity = validityRange(dump.brochures, now);
      return {
        zip_code: dump.location.zipCode,
        payload_json: {
          generatedAt: now.toISOString(),
          locationSource: 'GeoNames CC BY 4.0',
          stores: dump.stores,
          brochures: dump.brochures,
        },
        valid_from: validity.validFrom,
        valid_until: validity.validUntil,
      };
    }),
  );
  if (insertError) throw insertError;

  // Alte Zeilen erst nach einem erfolgreichen Batch-Insert entfernen. Ein
  // fehlgeschlagener Lauf laesst damit fuer jede PLZ den letzten Dump stehen.
  const { error: cleanupError } = await supabase
    .from('brochure_dumps')
    .delete()
    .in(
      'zip_code',
      dumps.map((dump) => dump.location.zipCode),
    )
    .lt('created_at', runStartedAt);
  if (cleanupError) throw cleanupError;
}

async function main(): Promise<void> {
  const config = await loadConfig();
  const runStartedAt = new Date().toISOString();
  const detailCache = new Map<string, Promise<unknown>>();
  const failures: Array<{ zipCode: string; message: string }> = [];
  const supabase = config.dryRun
    ? null
    : createClient(config.supabaseUrl, config.supabaseSecretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

  console.log(`Verarbeite ${config.locations.length} deutsche PLZ...`);
  for (let start = 0; start < config.locations.length; start += UPLOAD_BATCH_SIZE) {
    const locations = config.locations.slice(start, start + UPLOAD_BATCH_SIZE);
    const dumps: LocationDump[] = [];

    for (let offset = 0; offset < locations.length; offset += CONCURRENCY) {
      const concurrentLocations = locations.slice(offset, offset + CONCURRENCY);
      const results = await Promise.allSettled(
        concurrentLocations.map((location) => buildLocationDump(config, location, detailCache)),
      );
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') dumps.push(result.value);
        else {
          failures.push({
            zipCode: concurrentLocations[index].zipCode,
            message: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
        }
      });
    }

    if (supabase && dumps.length > 0) await publishBatch(supabase, dumps, runStartedAt);
    console.log(
      `${Math.min(start + locations.length, config.locations.length)}/${config.locations.length} PLZ, ${detailCache.size} eindeutige Prospekte, ${failures.length} Fehler.`,
    );
  }

  if (failures.length > 0) {
    const examples = failures
      .slice(0, 10)
      .map((failure) => `${failure.zipCode}: ${failure.message}`)
      .join('\n');
    throw new Error(
      `${failures.length} PLZ fehlgeschlagen; alte Dumps blieben erhalten.\n${examples}`,
    );
  }
  console.log(
    config.dryRun ? 'Deutschland-Dry-Run abgeschlossen.' : 'Deutschland-Dump aktualisiert.',
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
