import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cleanNullBytes } from './engine';
import type { CrawlerStore, LocationDump } from './types';

export const UPLOAD_BATCH_SIZE = 10;
const DEFAULT_DUMP_VALIDITY_DAYS = 14;

export type UploaderConfig = {
  supabaseUrl: string;
  supabaseSecretKey: string;
  dryRun?: boolean;
};

export function createSupabaseUploaderClient(config: UploaderConfig): SupabaseClient | null {
  if (config.dryRun) return null;
  if (!config.supabaseUrl || !config.supabaseSecretKey) {
    throw new Error('SUPABASE_URL oder SUPABASE_SECRET_KEY fehlt für den Upload.');
  }
  return createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function calculateValidityRange(
  dump: LocationDump,
  now: Date,
): { validFrom: string; validUntil: string } {
  if (dump.brochures.length === 0) {
    return {
      validFrom: now.toISOString(),
      validUntil: new Date(
        now.getTime() + DEFAULT_DUMP_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
  }

  const validFrom = dump.brochures.reduce(
    (earliest, b) => (b.validFrom < earliest ? b.validFrom : earliest),
    dump.brochures[0].validFrom,
  );

  const validUntil = dump.brochures.reduce(
    (latest, b) => (b.validUntil > latest ? b.validUntil : latest),
    dump.brochures[0].validUntil,
  );

  return { validFrom, validUntil };
}

/**
 * Säubert ein JSON-Objekt auf String-Ebene von jeglichen unzulässigen PostgreSQL-Steuerzeichen & Null-Bytes.
 */
export function sanitizeJsonForPostgres<T>(value: T): T {
  try {
    const rawString = JSON.stringify(value);
    const sanitizedString = rawString
      .replace(/\\u0000/gi, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    return JSON.parse(sanitizedString) as T;
  } catch {
    return cleanNullBytes(value);
  }
}

/**
 * Lädt einen einzelnen kleinen Chunk (z. B. 10 Dumps) direkt nach Supabase hoch.
 * Resistent gegen Timeouts und mit Fallback auf zeilenweisen Upload.
 */
export async function uploadSingleBatch(
  supabase: SupabaseClient,
  chunk: LocationDump[],
  runStartedAt: string,
): Promise<{ uploadedCount: number; storesCount: number }> {
  if (chunk.length === 0) return { uploadedCount: 0, storesCount: 0 };

  const now = new Date();
  const stores = new Map<string, CrawlerStore>();

  for (const dump of chunk) {
    for (const store of dump.stores) {
      stores.set(store.id, store);
    }
  }

  // 1. Stores aktualisieren
  if (stores.size > 0) {
    const cleanStores = sanitizeJsonForPostgres(
      [...stores.values()].map((s) => ({
        id: s.id,
        name: s.name,
        logo_url: s.logoUrl || null,
        active: true,
      })),
    );

    const { error: storeError } = await supabase
      .from('brochure_stores')
      .upsert(cleanStores, { onConflict: 'id' });

    if (storeError) {
      console.warn('⚠️ Warnung beim Aktualisieren der brochure_stores:', storeError.message);
    }
  }

  // 2. Dumps einfügen
  const rows = chunk.map((dump) => {
    const validity = calculateValidityRange(dump, now);
    const rawPayload = {
      generatedAt: now.toISOString(),
      locationSource: dump.location.cityName
        ? `GeoNames (${dump.location.cityName})`
        : 'GeoNames CC BY 4.0',
      stores: dump.stores,
      brochures: dump.brochures,
    };

    return {
      zip_code: dump.location.zipCode,
      run_id: runStartedAt,
      payload_json: sanitizeJsonForPostgres(rawPayload),
      valid_from: validity.validFrom,
      valid_until: validity.validUntil,
    };
  });

  let uploadedCount = 0;
  const { error: insertError } = await supabase
    .from('brochure_dumps')
    .upsert(rows, { onConflict: 'zip_code,run_id' });

  if (insertError) {
    // Fallback: Einzel-Inserts
    for (const row of rows) {
      try {
        const { error: singleError } = await supabase.from('brochure_dumps').insert([row]);
        if (!singleError) {
          uploadedCount += 1;
        } else {
          console.error(`❌ Einzelzeile PLZ ${row.zip_code} fehlgeschlagen:`, singleError.message);
        }
      } catch (err) {
        console.error(`❌ Exception bei PLZ ${row.zip_code}:`, err);
      }
    }
  } else {
    uploadedCount = rows.length;
  }

  // 3. Ältere Dumps für diese PLZs bereinigen
  try {
    await supabase
      .from('brochure_dumps')
      .delete()
      .in(
        'zip_code',
        chunk.map((d) => d.location.zipCode),
      )
      .lt('created_at', runStartedAt);
  } catch {
    // Ignorieren
  }

  return { uploadedCount, storesCount: stores.size };
}

export type ParallelUploadOptions = {
  concurrency?: number;
  onProgress?: (uploadedCount: number, total: number, storesCount: number) => void;
};

/**
 * Lädt Dumps parallel in schlanken Batches (Größe 10) nach Supabase hoch (z.B. für --from-backup).
 */
export async function uploadDumpsInParallel(
  dumps: LocationDump[],
  config: UploaderConfig,
  options?: ParallelUploadOptions,
): Promise<{ uploadedCount: number; storesCount: number }> {
  if (config.dryRun) {
    return { uploadedCount: dumps.length, storesCount: 0 };
  }

  const supabase = createSupabaseUploaderClient(config);
  if (!supabase) throw new Error('Supabase Client nicht initialisiert.');

  const runStartedAt = new Date().toISOString();
  const concurrency = options?.concurrency ?? 4;
  let totalUploaded = 0;
  let totalStores = 0;

  // Erstelle 10er-Batches
  const batches: LocationDump[][] = [];
  for (let i = 0; i < dumps.length; i += UPLOAD_BATCH_SIZE) {
    batches.push(dumps.slice(i, i + UPLOAD_BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i += concurrency) {
    const chunkOfBatches = batches.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      chunkOfBatches.map((batch) => uploadSingleBatch(supabase, batch, runStartedAt)),
    );

    for (const res of results) {
      if (res.status === 'fulfilled') {
        totalUploaded += res.value.uploadedCount;
        totalStores += res.value.storesCount;
      }
    }

    options?.onProgress?.(totalUploaded, dumps.length, totalStores);
  }

  return {
    uploadedCount: totalUploaded,
    storesCount: totalStores,
  };
}

/**
 * Kompatibilitäts-Wrapper für Batch-Uploads.
 */
export async function uploadDumpsToSupabase(
  dumps: LocationDump[],
  config: UploaderConfig,
): Promise<{ uploadedCount: number; storesCount: number }> {
  return uploadDumpsInParallel(dumps, config);
}
