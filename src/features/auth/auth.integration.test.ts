import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { createChunkedStorage, type KeyValueStore } from '@/lib/chunked-storage';
import type { Database } from '@/lib/database.types';

/** Auth gegen eine echte Supabase-Instanz. */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

let _admin: SupabaseClient<Database> | null = null;
function adminClient(): SupabaseClient<Database> {
  if (_admin) return _admin;
  if (!SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt.');
  }
  _admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

/** Erstellt fuer den Test einen bereits bestaetigten Nutzer. */
async function signUpConfirmed(client: SupabaseClient<Database>, email: string, password: string) {
  const { error: createError } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;

  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;
  return signInData.session;
}

function createMemoryStore(): {
  store: KeyValueStore;
  data: Map<string, string>;
} {
  const data = new Map<string, string>();
  const store: KeyValueStore = {
    async getItem(key) {
      return data.get(key) ?? null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
    async removeItem(key) {
      data.delete(key);
    },
  };
  return { store, data };
}

function uniqueEmail() {
  return `tester_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
}

describe('Auth Integration Tests', () => {
  let sharedStore: ReturnType<typeof createMemoryStore>;
  let client: SupabaseClient<Database>;

  function makeClient(storage: KeyValueStore) {
    return createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage,
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  beforeAll(() => {
    if (!SUPABASE_URL) {
      throw new Error('Keine SUPABASE_URL konfiguriert.');
    }
    if (!SUPABASE_KEY) {
      throw new Error('Kein ANON_KEY konfiguriert.');
    }
  });

  beforeEach(() => {
    sharedStore = createMemoryStore();
    client = makeClient(createChunkedStorage(sharedStore.store));
  });

  it('legt beim Registrieren automatisch ein Profil an', async () => {
    const email = uniqueEmail();
    const password = 'langgenug1';

    const session = await signUpConfirmed(client, email, password);
    const userId = session.user.id;

    const { data: profile, error } = await client
      .from('profiles')
      .select('id, display_name')
      .eq('id', userId)
      .single();

    expect(error).toBeNull();
    expect(profile).not.toBeNull();
    expect(profile?.id).toBe(userId);
  }, 30_000);

  it('speichert die Session durch den chunkenden Adapter und ueberlebt einen Client-Neustart', async () => {
    const email = uniqueEmail();
    const password = 'langgenug1';

    await signUpConfirmed(client, email, password);

    const keys = [...sharedStore.data.keys()];
    expect(keys.length).toBeGreaterThan(0);

    const clientAfterRestart = makeClient(createChunkedStorage(sharedStore.store));
    const {
      data: { session: restoredSession },
    } = await clientAfterRestart.auth.getSession();

    expect(restoredSession).not.toBeNull();
    expect(restoredSession?.user.email).toBe(email);
  }, 30_000);

  it('meldet falsche Zugangsdaten, ohne zu verraten ob die Adresse existiert', async () => {
    const email = uniqueEmail();
    const password = 'langgenug1';

    await signUpConfirmed(client, email, password);

    const { error: errorWrongPassword } = await client.auth.signInWithPassword({
      email,
      password: 'falschespasswort',
    });
    const { error: errorNonExistent } = await client.auth.signInWithPassword({
      email: uniqueEmail(),
      password: 'falschespasswort',
    });

    expect(errorWrongPassword).not.toBeNull();
    expect(errorNonExistent).not.toBeNull();
    expect(errorWrongPassword?.message).toBe(errorNonExistent?.message);
  }, 30_000);

  it('sperrt nach dem Abmelden den Zugriff auf eigene Daten', async () => {
    const email = uniqueEmail();
    const password = 'langgenug1';

    const session = await signUpConfirmed(client, email, password);
    const userId = session.user.id;

    const { data: beforeSignOut } = await client
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    expect(beforeSignOut).not.toBeNull();

    await client.auth.signOut();

    const { data: afterSignOut, error } = await client
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    expect(afterSignOut).toBeNull();
    expect(error).not.toBeNull();
  }, 30_000);

  it('laesst einen angemeldeten Nutzer einen Haushalt ueber RPC anlegen', async () => {
    const email = uniqueEmail();
    const password = 'langgenug1';

    const session = await signUpConfirmed(client, email, password);
    const userId = session.user.id;

    const { data: householdId, error: rpcError } = await client.rpc('create_household', {
      household_name: 'Schmidt-Familie',
    });

    expect(rpcError).toBeNull();
    expect(householdId).not.toBeNull();

    const { data: member, error: memberError } = await client
      .from('household_members')
      .select('household_id, user_id, role')
      .eq('household_id', householdId ?? '')
      .eq('user_id', userId)
      .single();

    expect(memberError).toBeNull();
    expect(member).not.toBeNull();
    expect(member?.role).toBe('admin');
  }, 30_000);
});
