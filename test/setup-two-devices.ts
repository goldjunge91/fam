import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
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

export async function setupTwoDevices(
  prefix = 'device',
): Promise<{ deviceA: Device; deviceB: Device; householdId: string }> {
  const email = uniqueEmail(prefix);
  const password = 'langgenug1';

  const clientA = makeClient();
  const { error: signUpError } = await clientA.auth.signUp({ email, password });
  if (signUpError) throw signUpError;

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

  return {
    deviceA: { db: dbA, client: clientA },
    deviceB: { db: dbB, client: clientB },
    householdId,
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
