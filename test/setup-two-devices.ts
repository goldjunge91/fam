import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { createTestDatabase, type TestDatabase } from './node-sqlite-adapter';

/** Zwei echte lokale Datenbanken und Sessions in einem gemeinsamen Haushalt. */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** Lazy Service-Role-Client fuer den vollstaendigen Test-Teardown. */
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
  /** In `afterEach` oder `finally` aufrufen. */
  teardown: () => Promise<void>;
};

export async function setupTwoDevices(prefix = 'device'): Promise<TwoDeviceSetup> {
  const email = uniqueEmail(prefix);
  const password = 'langgenug1';

  // Diese Sync-Suite umgeht bewusst den getrennt getesteten Bestaetigungs-Flow.
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

  const { data: householdId, error: hhError } = await clientA.rpc('create_household', {
    household_name: `Test ${email}`,
  });
  if (hhError) throw hhError;
  if (!householdId) throw new Error('create_household lieferte keine id');

  const clientB = makeClient();
  const { error: signInError } = await clientB.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  const dbA = createTestDatabase();
  const dbB = createTestDatabase();
  await runMigrations(dbA, MIGRATIONS);
  await runMigrations(dbB, MIGRATIONS);

  const teardown = async () => {
    // Kindtabellen muessen vor Haushalt und Auth-Nutzer verschwinden.
    const admin = adminClient();
    await admin.from('shopping_list_items').delete().eq('household_id', householdId);
    await admin.from('fridge_items').delete().eq('household_id', householdId);
    await admin.from('storage_locations').delete().eq('household_id', householdId);
    await admin.from('household_members').delete().eq('household_id', householdId);
    await admin.from('households').delete().eq('id', householdId);
    await admin.auth.admin.deleteUser(userId);

    // Offene Handles wuerden den Testprozess am Beenden hindern.
    try {
      await clientA.removeAllChannels();
      await clientB.removeAllChannels();
      await clientA.realtime.disconnect();
      await clientB.realtime.disconnect();
      (clientA.realtime as any).conn?.close();
      (clientB.realtime as any).conn?.close();
    } catch {}
    dbA.close();
    dbB.close();
  };

  // Puffer fuer Clock-Drift zwischen GoTrue, PostgREST und Realtime.
  await new Promise((resolve) => setTimeout(resolve, 3000));

  return {
    deviceA: { db: dbA, client: clientA },
    deviceB: { db: dbB, client: clientB },
    householdId,
    teardown,
  };
}

export function assertLocalSupabase(): void {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(SUPABASE_URL)) {
    throw new Error(`Nur gegen localhost erlaubt. Erhalten: ${SUPABASE_URL || '(leer)'}`);
  }
  if (!SUPABASE_KEY) {
    throw new Error('Kein ANON_KEY. Laeuft `supabase start`?');
  }
}
