import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { createChunkedStorage, type KeyValueStore } from '@/lib/chunked-storage';
import type { Database } from '@/lib/database.types';

/**
 * Auth gegen die echte lokale Supabase-Instanz — keine Testdoubles.
 *
 * Braucht `supabase start`. Deshalb NICHT Teil von `bun run test` (das muss
 * ueberall laufen), sondern von `bun run test:integration`.
 *
 * Was hier geprueft wird, laesst sich mit Unit-Tests nicht abdecken: dass der
 * Trigger aus #34 wirklich feuert, dass RLS einen abgemeldeten Client
 * tatsaechlich aussperrt, und dass eine Session einen Client-Neustart
 * ueberlebt, wenn sie durch den chunkenden Adapter aus #30 gelaufen ist.
 */

// Gesetzt von test/setup-integration.js aus `supabase status` — nicht aus der
// .env, die auf das Remote-Projekt zeigt.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

/** In-Memory-Speicher, der das iOS-Limit von SecureStore nachbildet. */
function createMemoryStore(maxValueLength = 2048) {
  const data = new Map<string, string>();
  const store: KeyValueStore = {
    async getItem(key) {
      return data.get(key) ?? null;
    },
    async setItem(key, value) {
      if (value.length > maxValueLength) {
        throw new Error(`Wert zu gross: ${value.length} > ${maxValueLength}`);
      }
      data.set(key, value);
    },
    async removeItem(key) {
      data.delete(key);
    },
  };
  return { store, data };
}

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

describe('Auth gegen die lokale Supabase-Instanz', () => {
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
    // Zweite Sicherung, unabhaengig vom Setup-File: Diese Suite legt Konten an
    // und darf deshalb unter keinen Umstaenden gegen ein entferntes Projekt
    // laufen.
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(SUPABASE_URL)) {
      throw new Error(`Nur gegen localhost erlaubt. Erhalten: ${SUPABASE_URL || '(leer)'}`);
    }
    if (!SUPABASE_KEY) {
      throw new Error('Kein ANON_KEY. Laeuft `supabase start`?');
    }
  });

  beforeEach(() => {
    sharedStore = createMemoryStore();
    client = makeClient(createChunkedStorage(sharedStore.store));
  });

  it('legt beim Registrieren automatisch ein Profil an', async () => {
    const email = uniqueEmail();
    const { data, error } = await client.auth.signUp({ email, password: 'langgenug1' });

    expect(error).toBeNull();
    expect(data.user).not.toBeNull();

    // Der Trigger on_auth_user_created (#34) soll gefeuert haben.
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('id, display_name')
      .eq('id', data.user?.id ?? '')
      .single();

    expect(profileError).toBeNull();
    expect(profile?.id).toBe(data.user?.id);
    // display_name wird aus dem lokalen Teil der E-Mail vorbelegt.
    expect(profile?.display_name).toBe(email.split('@')[0]);
  }, 30_000);

  it('speichert die Session durch den chunkenden Adapter und ueberlebt einen Client-Neustart', async () => {
    const email = uniqueEmail();
    await client.auth.signUp({ email, password: 'langgenug1' });

    // Der eigentliche Praxistest fuer #30: Der Speicher wirft, sobald ein
    // Einzelwert 2048 Zeichen ueberschreitet. Kaeme die Session ungechunkt an,
    // waere sie hier bereits fehlgeschlagen.
    expect(sharedStore.data.size).toBeGreaterThan(0);
    for (const value of sharedStore.data.values()) {
      expect(value.length).toBeLessThanOrEqual(2048);
    }

    // Neuer Client, gleicher Speicher — wie ein App-Neustart.
    const restarted = makeClient(createChunkedStorage(sharedStore.store));
    const { data, error } = await restarted.auth.getSession();

    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
    expect(data.session?.user.email).toBe(email);
  }, 30_000);

  it('meldet falsche Zugangsdaten, ohne zu verraten ob die Adresse existiert', async () => {
    const email = uniqueEmail();
    await client.auth.signUp({ email, password: 'langgenug1' });
    await client.auth.signOut();

    const falschesPasswort = await client.auth.signInWithPassword({
      email,
      password: 'falschfalsch',
    });
    const unbekannteAdresse = await client.auth.signInWithPassword({
      email: uniqueEmail(),
      password: 'langgenug1',
    });

    expect(falschesPasswort.error).not.toBeNull();
    expect(unbekannteAdresse.error).not.toBeNull();
    // Gleiche Meldung in beiden Faellen — sonst waere sie eine Auskunft darueber,
    // wer hier ein Konto hat.
    expect(falschesPasswort.error?.message).toBe(unbekannteAdresse.error?.message);
  }, 30_000);

  it('sperrt nach dem Abmelden den Zugriff auf eigene Daten', async () => {
    const email = uniqueEmail();
    const { data } = await client.auth.signUp({ email, password: 'langgenug1' });
    const userId = data.user?.id ?? '';

    const angemeldet = await client.from('profiles').select('id').eq('id', userId);
    expect(angemeldet.data).toHaveLength(1);

    await client.auth.signOut();

    // RLS-Policies sind `to authenticated`; ein abgemeldeter Client faellt auf
    // `anon` zurueck und sieht nichts — ohne Fehler, mit leerem Ergebnis.
    const abgemeldet = await client.from('profiles').select('id').eq('id', userId);
    expect(abgemeldet.error).toBeNull();
    expect(abgemeldet.data).toHaveLength(0);
  }, 30_000);

  it('laesst einen angemeldeten Nutzer einen Haushalt anlegen', async () => {
    const email = uniqueEmail();
    await client.auth.signUp({ email, password: 'langgenug1' });

    const { data: householdId, error } = await client.rpc('create_household', {
      household_name: 'Testhaushalt',
    });

    expect(error).toBeNull();
    expect(householdId).toEqual(expect.any(String));

    // create_household legt Mitgliedschaft und die drei Lagerorte mit an (#39).
    const { data: locations } = await client.from('storage_locations').select('kind');
    expect(locations).toHaveLength(3);

    const { data: members } = await client.from('household_members').select('role');
    expect(members).toEqual([{ role: 'admin' }]);
  }, 30_000);
});
