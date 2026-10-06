import 'react-native-url-polyfill/auto';

import { fetch as expoFetch } from 'expo/fetch';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'react-native-harness';

import { RECEIPT_ASSET_BUCKET } from '@/features/ocr/capture/capture/constants';
import { createFetchWithResponseTimeout } from '@/lib/backend/supabase/fetch-response-timeout';
import type { Database } from '@/lib/database.types';

/**
 * Storage-Upload-Diagnose in der echten Runtime.
 *
 * Vergleicht Expo-fetch und den globalen RN-fetch mit einer begrenzten
 * Expo-fetch-Variante. Alle Größen laufen über den begrenzten Kandidaten;
 * die Rohtransporte prüfen den 884-KB-Fehlerfall. Der Capture-Adapter wird
 * umgangen; Parent-Sync und Metadaten werden separat getestet.
 *
 * Der Diagnose-Client baut bewusst eigene supabase-js-Clients gegen die
 * lokale Instanz (EXPO_PUBLIC_HARNESS_SUPABASE_URL), unabhängig davon,
 * auf welches Projekt das App-Bundle zeigt. Der Timeout-Kandidat verwendet
 * denselben Expo-fetch-Wrapper wie der App-Client.
 *
 * `react-native-url-polyfill/auto` muss vor supabase-js geladen werden
 * (gleiche Reihenfolge wie der App-Client): supabase-js weist
 * `realtimeUrl.protocol` zu, was die Expo-Winter-URL nur mit installiertem
 * Polyfill unterstuetzt.
 *
 * Credentials kommen als EXPO_PUBLIC_HARNESS_* (Metro inlined EXPO_PUBLIC_*
 * beim Bundlen). harness/diagnose-storage-upload.sh legt den Test-Account an
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
      'EXPO_PUBLIC_HARNESS_SUPABASE_URL/KEY fehlen. harness/diagnose-storage-upload.sh setzt beide.',
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

type DiagnosticTransport = {
  label: string;
  fetch: typeof fetch;
  client: ReturnType<typeof diagnoseClient>;
  storageEvents: string[];
};

const outcomes: UploadOutcome[] = [];

function record(label: string, error: unknown, storageEvents: string[]): void {
  const message =
    error instanceof Error
      ? error.stack ?? `${error.name}: ${error.message}`
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
  const detail = storageEvents.length
    ? `${message}\nStorage requests:\n${storageEvents.join('\n')}`
    : `${message}\nStorage requests: none reached fetch`;
  outcomes.push({ label, ok: false, detail });
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

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;

  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function diagnosePath(householdId: string, assetId: string): string {
  return `${householdId}/diagnose/${assetId}.jpg`;
}

async function uploadViaStorageClient(
  transport: DiagnosticTransport,
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

  const { data: sessionData, error: sessionError } = await transport.client.auth.getSession();
  if (sessionError) throw sessionError;
  const session = sessionData.session;
  if (!session || !SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Storage readback requires the signed-in session and Supabase credentials.');
  }

  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const response = await transport.fetch(
    `${SUPABASE_URL}/storage/v1/object/${RECEIPT_ASSET_BUCKET}/${encodedPath}`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Storage readback failed with HTTP ${response.status}.`);
  }
  expect(equalBytes(new Uint8Array(await response.arrayBuffer()), body)).toBe(true);
}

function diagnoseTransport(label: string, fetchImplementation: typeof fetch): DiagnosticTransport {
  const storageEvents: string[] = [];
  const trackedFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    if (!url.includes('/storage/v1/object/')) return fetchImplementation(input, init);

    const request = `${init?.method ?? 'GET'} ${url}`;
    storageEvents.push(`started ${request}`);
    try {
      const response = await fetchImplementation(input, init);
      storageEvents.push(`resolved ${request} -> HTTP ${response.status}`);
      return response;
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      storageEvents.push(`rejected ${request} -> ${detail}`);
      throw error;
    }
  };

  return {
    label,
    fetch: fetchImplementation,
    client: diagnoseClient(trackedFetch),
    storageEvents,
  };
}

let householdId: string | null = null;
const uploadedAssetIds: string[] = [];
const transports: DiagnosticTransport[] = [
  diagnoseTransport('expo/fetch', expoFetch as typeof fetch),
  diagnoseTransport('global fetch (EXPO_PUBLIC_USE_RN_FETCH)', globalThis.fetch),
  diagnoseTransport(
    'expo/fetch with response timeout',
    createFetchWithResponseTimeout(expoFetch as typeof fetch, 60_000),
  ),
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
  const REFERENCE_SIZE = SIZES.filter((size) => size.bytes === 883918);

  const failureTransports = [
    { label: 'expo/fetch', fetch: expoFetch as typeof fetch },
    { label: 'global fetch (EXPO_PUBLIC_USE_RN_FETCH)', fetch: globalThis.fetch },
    {
      label: 'expo/fetch with response timeout',
      fetch: createFetchWithResponseTimeout(expoFetch as typeof fetch, 2500),
    },
  ];

  it('begrenzt einen abgebrochenen Response-Body mit dem Fetch-Timeout', async () => {
    if (!FAILURE_URL) {
      throw new Error('EXPO_PUBLIC_HARNESS_FAILURE_URL fehlt; harness/diagnose-storage-upload.sh setzt sie.');
    }

    const results = await Promise.all(
      failureTransports.map(async (transport) => {
        const client = createClient<Database>(FAILURE_URL, SUPABASE_KEY ?? '', {
          global: { fetch: transport.fetch },
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
        const controller = new AbortController();
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            client
              .from('households')
              .select('id')
              .abortSignal(controller.signal)
              .throwOnError(),
            new Promise<never>((_, reject) => {
              timeout = setTimeout(() => {
                controller.abort();
                reject(new Error('body read timed out'));
              }, 4000);
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
    const boundedFetch = results.find((result) => result.label.includes('response timeout'))?.result;
    if (!boundedFetch?.includes('Fetch response timed out after 2500 ms.')) {
      throw new Error(`Abgebrochene Response-Ergebnisse:\n${JSON.stringify(results, null, 2)}`);
    }
  });

  for (const transport of transports) {
    const sizes = transport.label.includes('response timeout') ? SIZES : REFERENCE_SIZE;
    for (const size of sizes) {
      it(`round-trips Uint8Array ${size.label} via ${transport.label}`, async () => {
        const prefix = transport.label.startsWith('global')
          ? 'rn'
          : transport.label.includes('response timeout')
            ? 'expo-timeout'
            : 'expo';
        const id = `${prefix}-${size.bytes}`;
        uploadedAssetIds.push(id);
        transport.storageEvents.length = 0;
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
          record(`${transport.label} Uint8Array ${size.label}`, error, transport.storageEvents);
        }
      });
    }
  }

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
    expect(outcomes).toHaveLength(SIZES.length + transports.length - 1);
    if (failed.length > 0) {
      throw new Error(`Upload failures:\n${JSON.stringify(failed, null, 2)}`);
    }
  });

  it('raeumt die Diagnose-Objekte auf', async () => {
    if (!householdId) return;
    const { error } = await transports[0].client
      .storage.from(RECEIPT_ASSET_BUCKET)
      .remove(uploadedAssetIds.map((assetId) => diagnosePath(householdId ?? '', assetId)));
    if (error) console.warn(`[storage-matrix] Cleanup-Warnung: ${error.message}`);
  });
});
