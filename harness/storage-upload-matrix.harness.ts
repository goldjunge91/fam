import 'react-native-url-polyfill/auto';

import { fetch as expoFetch } from 'expo/fetch';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'react-native-harness';

import { RECEIPT_ASSET_BUCKET } from '@/features/ocr/capture/capture/constants';
import type { Database } from '@/lib/database.types';

/**
 * Storage-Upload-Diagnose in der echten Runtime.
 *
 * Prüft ausschließlich den gewählten Bildtransport: Uint8Array über
 * Supabase Storage mit expo/fetch. Jede Dateigröße muss erfolgreich sein.
 * Der Capture-Adapter wird umgangen; Parent-Sync und Metadaten werden
 * separat getestet. Dies ist kein vollständiger Bon-End-to-End-Test.
 *
 * Der Diagnose-Client baut bewusst einen eigenen supabase-js-Client mit
 * expo/fetch als Transport — identisch zum App-Client in
 * src/lib/backend/supabase/client.ts, aber gegen die lokale Instanz
 * (EXPO_PUBLIC_HARNESS_SUPABASE_URL), unabhaengig davon, auf welches Projekt
 * das App-Bundle zeigt.
 *
 * `react-native-url-polyfill/auto` muss vor supabase-js geladen werden
 * (gleiche Reihenfolge wie der App-Client): supabase-js weist
 * `realtimeUrl.protocol` zu, was die Expo-Winter-URL nur mit installiertem
 * Polyfill unterstuetzt.
 *
 * Credentials kommen als EXPO_PUBLIC_HARNESS_* (Metro inlined EXPO_PUBLIC_*
 * beim Bundlen). scripts/diagnose-storage-upload.sh legt den Test-Account an
 * und setzt alle drei Variablen.
 */

const EMAIL = process.env.EXPO_PUBLIC_HARNESS_TEST_EMAIL;
const PASSWORD = process.env.EXPO_PUBLIC_HARNESS_TEST_PASSWORD;
const SUPABASE_URL = process.env.EXPO_PUBLIC_HARNESS_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_HARNESS_SUPABASE_KEY;
const FAILURE_URL = process.env.EXPO_PUBLIC_HARNESS_FAILURE_URL;

function diagnoseClient(fetchImplementation: typeof fetch, url = SUPABASE_URL) {
  if (!url || !SUPABASE_KEY) {
    throw new Error(
      'EXPO_PUBLIC_HARNESS_SUPABASE_URL/KEY fehlen. scripts/diagnose-storage-upload.sh setzt beide.',
    );
  }
  return createClient<Database>(url, SUPABASE_KEY, {
    global: { fetch: fetchImplementation },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

type UploadOutcome = {
  label: string;
  ok: boolean;
  detail: string;
};

const outcomes: UploadOutcome[] = [];

function record(label: string, error: unknown): void {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
  outcomes.push({ label, ok: false, detail: message });
  console.warn(`[storage-matrix] FAIL ${label} -> ${message}`);
}

function recordOk(label: string): void {
  outcomes.push({ label, ok: true, detail: 'uploaded' });
  console.warn(`[storage-matrix] OK   ${label}`);
}

function testBytes(sizeBytes: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(sizeBytes));
  // Deterministisches Muster statt Nullen: komprimierbare Daten wuerden
  // Transportgrenzen schoener aussehen lassen, als sie sind.
  for (let index = 0; index < sizeBytes; index += 1) {
    bytes[index] = index % 251;
  }
  return bytes;
}

function diagnosePath(householdId: string, assetId: string): string {
  return `${householdId}/diagnose/${assetId}.jpg`;
}

async function uploadViaStorageClient(
  transport: (typeof transports)[number],
  householdId: string,
  assetId: string,
  body: Uint8Array<ArrayBuffer>,
  contentType: string,
): Promise<void> {
  const path = diagnosePath(householdId, assetId);
  const { error } = await transport.client
    .storage.from(RECEIPT_ASSET_BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw error;

  const { data, error: downloadError } = await transport.client
    .storage.from(RECEIPT_ASSET_BUCKET)
    .download(path);
  if (downloadError) throw downloadError;
  expect(new Uint8Array(await data.arrayBuffer())).toEqual(body);
}

let householdId: string | null = null;
const uploadedAssetIds: string[] = [];
const transports = [
  { label: 'expo/fetch', fetch: expoFetch as typeof fetch, client: diagnoseClient(expoFetch as typeof fetch) },
  {
    label: 'global fetch (EXPO_PUBLIC_USE_RN_FETCH)',
    fetch: globalThis.fetch,
    client: diagnoseClient(globalThis.fetch),
  },
] as const;

describe('Storage-Upload-Diagnose (echte Runtime)', () => {
  it('meldet fehlende Credentials klar', () => {
    expect(
      `email=${EMAIL ? 'gesetzt' : 'FEHLT'} password=${PASSWORD ? 'gesetzt' : 'FEHLT'}`,
    ).toBe('email=gesetzt password=gesetzt');
  });

  it('sign-in und JSON-Kontrolle ueber den Supabase-Client funktionieren', async () => {
    expect(globalThis.fetch).not.toBe(expoFetch);

    for (const transport of transports) {
      const { error } = await transport.client.auth.signInWithPassword({
        email: EMAIL ?? '',
        password: PASSWORD ?? '',
      });
      if (error) throw new Error(`${transport.label}: ${error.message}`);

      const { data, error: selectError } = await transport.client
        .from('households')
        .select('id')
        .limit(1);
      if (selectError) throw selectError;
      console.warn(`[storage-matrix] JSON-Kontrolle ${transport.label}: ${data.length} Zeile(n)`);
    }
  });

  it('legt einen Diagnose-Haushalt an', async () => {
    const { data, error } = await transports[0].client.rpc('create_household', {
      household_name: `Storage-Diagnose ${new Date().toISOString()}`,
    });
    if (error) throw error;
    householdId = data;
    expect(householdId).toBeTruthy();
    console.warn(`[storage-matrix] Haushalt: ${householdId}`);
  });

  const SIZES = [
    { label: '1 KB', bytes: 1024 },
    { label: '64 KB', bytes: 64 * 1024 },
    { label: '512 KB', bytes: 512 * 1024 },
    { label: '884 KB (Fehlerfall aus dem Log)', bytes: 883918 },
    { label: '2 MB', bytes: 2 * 1024 * 1024 },
  ] as const;

  it('meldet einen abgebrochenen Response-Body als Netzwerkfehler', async () => {
    if (!FAILURE_URL) {
      throw new Error('EXPO_PUBLIC_HARNESS_FAILURE_URL fehlt; diagnose-storage-upload.sh setzt sie.');
    }

    const results = await Promise.all(
      transports.map(async (transport) => {
        const client = createClient<Database>(FAILURE_URL, SUPABASE_KEY ?? '', {
          global: { fetch: transport.fetch },
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            client.from('households').select('id').throwOnError(),
            new Promise<never>((_, reject) => {
              timeout = setTimeout(() => reject(new Error('body read timed out')), 8000);
            }),
          ]);
          return { label: transport.label, result: 'resolved with a partial response' };
        } catch (error) {
          const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
          return { label: transport.label, result: message };
        } finally {
          if (timeout) clearTimeout(timeout);
        }
      }),
    );

    for (const result of results) {
      console.warn(`[storage-matrix] mid-body ${result.label}: ${result.result}`);
    }
    const rnFetch = results.find((result) => result.label.startsWith('global fetch'))?.result;
    expect(rnFetch).toBeDefined();
    expect(rnFetch).not.toContain('body read timed out');
    expect(rnFetch).not.toContain('SyntaxError');
    expect(rnFetch).not.toBe('resolved with a partial response');
  });

  it('Uint8Array (View) via beide Supabase-Transporte ueber alle Groessen', async () => {
    for (const transport of transports) {
      for (const size of SIZES) {
        const id = `${transport.label.startsWith('expo') ? 'expo' : 'rn'}-${size.bytes}`;
        uploadedAssetIds.push(id);
        try {
          await uploadViaStorageClient(
            transport,
            householdId ?? '',
            id,
            testBytes(size.bytes),
            'image/jpeg',
          );
          recordOk(`Uint8Array ${size.label} via ${transport.label}`);
        } catch (error) {
          record(`${transport.label} Uint8Array ${size.label}`, error);
        }
      }
    }
  });

  it('druckt die Ergebnismatrix', async () => {
    console.warn('\n[storage-matrix] ===== ERGEBNISMATRIX =====');
    for (const outcome of outcomes) {
      console.warn(
        `[storage-matrix] ${outcome.ok ? 'OK  ' : 'FAIL'} ${outcome.label}${
          outcome.ok ? '' : ` -> ${outcome.detail}`
        }`,
      );
    }
    const failed = outcomes.filter((outcome) => !outcome.ok);
    console.warn(
      `[storage-matrix] ===== ${outcomes.length - failed.length}/${outcomes.length} OK =====\n`,
    );
    expect(outcomes).toHaveLength(SIZES.length * transports.length);
    expect(failed).toEqual([]);
  });

  it('raeumt die Diagnose-Objekte auf', async () => {
    if (!householdId) return;
    const { error } = await transports[0].client
      .storage.from(RECEIPT_ASSET_BUCKET)
      .remove(uploadedAssetIds.map((assetId) => diagnosePath(householdId ?? '', assetId)));
    if (error) console.warn(`[storage-matrix] Cleanup-Warnung: ${error.message}`);
  });
});
