import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { createTestDatabase, type TestDatabase } from './node-sqlite-adapter';

/**
 * Baut zwei "Geraete" derselben Nutzerin fuer Zwei-Geraete-Tests: eigene
 * lokale DB, eigene Session, gemeinsamer Haushalt. Gemeinsam genutzt von
 * `engine.integration.test.ts` (#47) und `realtime.integration.test.ts`
 * (#48) — kein Mock, echte lokale Supabase-Instanz, echte node:sqlite-DBs.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/**
 * Service-Role-Client fuer Teardown — loescht Testdaten per SQL, ohne den
 * Household-Admin-Constraint auszuloesen. Lazy initialisiert, damit der
 * Import allein noch keinen Client baut.
 */
let _admin: SupabaseClient<Database> | null = null;
function adminClient(): SupabaseClient<Database> {
  if (_admin) return _admin;
  if (!SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt — Teardown unmoeglich.');
  }
  _admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

function inMemoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: async (key: string) => {
      data.delete(key);
    },
  };
}

export function makeClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: { storage: inMemoryStorage(), autoRefreshToken: false, persistSession: true },
  });
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export type Device = { db: TestDatabase; client: SupabaseClient<Database> };

export type TwoDeviceSetup = {
  deviceA: Device;
  deviceB: Device;
  householdId: string;
  /** Raeumt alle Server-Daten auf (Haushalt, Members, User). Immer aufrufen — in afterEach oder finally. */
  teardown: () => Promise<void>;
};

export async function setupTwoDevices(prefix = 'device'): Promise<TwoDeviceSetup> {
  const email = uniqueEmail(prefix);
  const password = 'langgenug1';

  // Admin-Erstellung mit email_confirm:true statt des oeffentlichen
  // signUp()-Wegs: seit enable_confirmations=true (lokal jetzt passend zum
  // Remote-Projekt, siehe config.toml) liefert signUp() keine Session mehr,
  // solange die Adresse nicht per Klick auf den Bestaetigungslink bestaetigt
  // wurde. Diese Suite prueft Sync-Konvergenz, nicht den
  // Bestaetigungs-Flow — der hat eigene Tests (EmailVerificationPanel).
  const { data: createData, error: createError } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;
  const userId = createData.user.id;

  const clientA = makeClient();
  const { error: signInAError } = await clientA.auth.signInWithPassword({ email, password });
  if (signInAError) throw signInAError;

  const clientB = makeClient();
  const { error: signInBError } = await clientB.auth.signInWithPassword({ email, password });
  if (signInBError) throw signInBError;

  // GoTrue stellt beide Tokens aus, bevor PostgREST sie verwendet. Leichte
  // Clock-Drifts zwischen den lokalen Containern koennen ein ganz frisches
  // Token sonst bereits beim folgenden RPC als "issued at future" ablehnen.
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const { data: householdId, error: hhError } = await clientA.rpc('create_household', {
    household_name: `Test ${email}`,
  });
  if (hhError) throw hhError;
  if (!householdId) throw new Error('create_household lieferte keine id');

  const dbA = createTestDatabase();
  const dbB = createTestDatabase();
  await runMigrations(dbA, MIGRATIONS);
  await runMigrations(dbB, MIGRATIONS);
  await runDrizzleMigrations(dbA);
  await runDrizzleMigrations(dbB);

  const teardown = async () => {
    // Reihenfolge: Kind-Tabellen → Elterntabellen → auth.users.
    // Direkt per service-role RPC, nicht ueber admin.auth.admin.deleteUser —
    // das scheitert am Household-Admin-Constraint und hinterlaesst Leichen.
    const admin = adminClient();
    await admin.from('symptom_logs').delete().eq('user_id', userId);
    await admin.from('medication_logs').delete().eq('user_id', userId);
    await admin.from('shopping_list_items').delete().eq('household_id', householdId);
    await admin.from('fridge_items').delete().eq('household_id', householdId);
    await admin.from('storage_locations').delete().eq('household_id', householdId);
    await admin.from('household_members').delete().eq('household_id', householdId);
    await admin.from('households').delete().eq('id', householdId);
    // Jetzt ist der User kein Admin mehr → deleteUser greift.
    await admin.auth.admin.deleteUser(userId);

    // Versuche, offene WebSocket-Handles und SQLite-Verbindungen abzubauen, damit Jest sauber beenden kann
    try {
      await clientA.removeAllChannels();
      await clientB.removeAllChannels();
      await clientA.realtime.disconnect();
      await clientB.realtime.disconnect();
      (clientA.realtime as any).conn?.close();
      (clientB.realtime as any).conn?.close();
    } catch {
      // Ignoriere Fehler bei bereits geschlossenen Sockets
    }
    dbA.close();
    dbB.close();
  };

  return {
    deviceA: { db: dbA, client: clientA },
    deviceB: { db: dbB, client: clientB },
    householdId,
    teardown,
  };
}

/** Wirft, wenn die Testsuite versehentlich gegen ein entferntes Projekt liefe. */
export function assertLocalSupabase(): void {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(SUPABASE_URL)) {
    throw new Error(`Nur gegen localhost erlaubt. Erhalten: ${SUPABASE_URL || '(leer)'}`);
  }
  if (!SUPABASE_KEY) {
    throw new Error('Kein ANON_KEY. Laeuft `supabase start`?');
  }
}
