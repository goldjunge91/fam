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

function diagnoseClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      'EXPO_PUBLIC_HARNESS_SUPABASE_URL/KEY fehlen. scripts/diagnose-storage-upload.sh setzt beide.',
    );
  }
  return createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    global: { fetch: expoFetch as typeof fetch },
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
  householdId: string,
  assetId: string,
  body: Uint8Array<ArrayBuffer>,
  contentType: string,
): Promise<void> {
  const path = diagnosePath(householdId, assetId);
  const { error } = await client
    .storage.from(RECEIPT_ASSET_BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw error;
}

let householdId: string | null = null;
const uploadedAssetIds: string[] = [];
// Ein Client fuer die ganze Suite: persistSession=false, damit der Sign-In
// im ersten Test die Session fuer alle Upload-Tests haelt.
const client = diagnoseClient();

describe('Storage-Upload-Diagnose (echte Runtime)', () => {
  it('meldet fehlende Credentials klar', () => {
    expect(
      `email=${EMAIL ? 'gesetzt' : 'FEHLT'} password=${PASSWORD ? 'gesetzt' : 'FEHLT'}`,
    ).toBe('email=gesetzt password=gesetzt');
  });

  it('sign-in und JSON-Kontrolle ueber den Supabase-Client funktionieren', async () => {
    const { error } = await client.auth.signInWithPassword({
      email: EMAIL ?? '',
      password: PASSWORD ?? '',
    });
    if (error) throw error;

    // Kontrolle: JSON-PostgREST-Request ueber denselben Client.
    const { data, error: selectError } = await client
      .from('households')
      .select('id')
      .limit(1);
    if (selectError) throw selectError;
    console.warn(`[storage-matrix] JSON-Kontrolle: ${data.length} Zeile(n) gelesen`);
  });

  it('legt einen Diagnose-Haushalt an', async () => {
    const { data, error } = await client.rpc('create_household', {
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

  it('Uint8Array (View) via Storage-Client ueber alle Groessen', async () => {
    for (const size of SIZES) {
      const id = `u8-${size.bytes}`;
      uploadedAssetIds.push(id);
      try {
        await uploadViaStorageClient(householdId ?? '', id, testBytes(size.bytes), 'image/jpeg');
        recordOk(`Uint8Array ${size.label} via storage.upload()`);
      } catch (error) {
        record(`Uint8Array ${size.label} via storage.upload()`, error);
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
    expect(outcomes).toHaveLength(SIZES.length);
    expect(failed).toEqual([]);
  });

  it('raeumt die Diagnose-Objekte auf', async () => {
    if (!householdId) return;
    const { error } = await client
      .storage.from(RECEIPT_ASSET_BUCKET)
      .remove(uploadedAssetIds.map((assetId) => diagnosePath(householdId ?? '', assetId)));
    if (error) console.warn(`[storage-matrix] Cleanup-Warnung: ${error.message}`);
  });
});