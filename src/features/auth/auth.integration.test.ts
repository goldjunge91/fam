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

/**
 * Admin-Erstellung mit email_confirm:true statt `client.auth.signUp()`:
 * seit enable_confirmations=true (config.toml) liefert signUp() erst nach
 * Klick auf den Bestaetigungslink eine Session. Diese Suite testet Trigger,
 * RLS und den chunkenden Storage-Adapter — nicht den Bestaetigungs-Flow
 * selbst (der hat eigene Tests: pending-auth-banner.test.tsx).
 */
async function signUpConfirmed(client: SupabaseClient<Database>, email: string, password: string) {
  const { data: createData, error: createError } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // Workaround fuer "JWT issued at future" in lokalen Docker-Umgebungen (wie
  // in setup-two-devices.ts): GoTrue und PostgREST laufen in getrennten
  // Containern mit leicht driftenden Uhren, ein sofort danach verifiziertes
  // Token wird gelegentlich als "aus der Zukunft" abgelehnt.
  await new Promise((resolve) => setTimeout(resolve, 3000));

  return { user: createData.user, session: data.session };
}

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
    const { user } = await signUpConfirmed(client, email, 'langgenug1');

    expect(user).not.toBeNull();

    // Der Trigger on_auth_user_created (#34) soll gefeuert haben.
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('id, display_name')
      .eq('id', user?.id ?? '')
      .single();

    expect(profileError).toBeNull();
    expect(profile?.id).toBe(user?.id);
    // display_name wird aus dem lokalen Teil der E-Mail vorbelegt.
    expect(profile?.display_name).toBe(email.split('@')[0]);
  }, 30_000);

  it('speichert die Session durch den chunkenden Adapter und ueberlebt einen Client-Neustart', async () => {
    const email = uniqueEmail();
    await signUpConfirmed(client, email, 'langgenug1');

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
    await signUpConfirmed(client, email, 'langgenug1');
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
    const { user } = await signUpConfirmed(client, email, 'langgenug1');
    const userId = user?.id ?? '';

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
    await signUpConfirmed(client, email, 'langgenug1');

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

  /**
   * Der Bestaetigungsflow selbst — der Teil, den die uebrigen Tests dieser Suite
   * mit `admin.createUser({ email_confirm: true })` bewusst umgehen.
   *
   * Ohne Testdoubles: echte Registrierung, echte Mail aus Mailpit, echter
   * `verifyOtp`-Aufruf. Genau das deckt den Bug ab, der zu diesem Umbau gefuehrt
   * hat — ein Unit-Test mit gemocktem Client haette ihn nie gefunden, weil er in
   * der Kette Mailtemplate → GoTrue-Token → Client-Aufruf sass.
   */
  describe('E-Mail-Bestaetigung per 6-stelligem Code', () => {
    /** Web-UI von Mailpit, aus `supabase status` (INBUCKET_URL). */
    const MAILPIT_URL = 'http://127.0.0.1:54324';

    /**
     * Holt die zuletzt an `email` zugestellte Nachricht. Mailpit stellt sofort
     * zu, aber GoTrue verschickt asynchron — deshalb kurz nachfassen statt
     * einmal blind zu greifen.
     */
    async function fetchLatestMessageTo(email: string, attempts = 20): Promise<string> {
      for (let i = 0; i < attempts; i++) {
        const listRes = await fetch(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
        );
        if (listRes.ok) {
          const list = (await listRes.json()) as { messages?: { ID: string }[] };
          const id = list.messages?.[0]?.ID;
          if (id) {
            const msgRes = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
            const msg = (await msgRes.json()) as { HTML?: string; Text?: string };
            return msg.HTML || msg.Text || '';
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new Error(`Keine Mail an ${email} in Mailpit gefunden.`);
    }

    /** Der 6-stellige Code aus supabase/templates/confirm.html ({{ .Token }}). */
    function extractCode(body: string): string {
      const match = body.match(/\b(\d{6})\b/);
      if (!match) throw new Error(`Kein 6-stelliger Code in der Mail:\n${body}`);
      return match[1];
    }

    it('loest den Code aus der Mail ein und liefert eine bestaetigte Session', async () => {
      const email = uniqueEmail();
      const password = 'langgenug1';

      const { data: signUpData, error: signUpError } = await client.auth.signUp({
        email,
        password,
      });
      expect(signUpError).toBeNull();
      // Mit enable_confirmations=true gibt es hier bewusst noch keine Session.
      expect(signUpData.session).toBeNull();

      const code = extractCode(await fetchLatestMessageTo(email));

      const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'signup' });

      expect(error).toBeNull();
      expect(data.session).not.toBeNull();
      // Der Kern der Zusicherung: die Adresse gilt jetzt serverseitig als geprueft.
      expect(data.session?.user.email_confirmed_at).toEqual(expect.any(String));
    }, 30_000);

    it('weist denselben Code beim zweiten Mal ab', async () => {
      // Der Token gilt genau einmal — dieselbe Eigenschaft, die den
      // Bestaetigungslink beim zweiten Klick scheitern laesst. Sie ist gewollt,
      // und die App muss sie als solche melden statt im Wartezustand zu haengen.
      const email = uniqueEmail();
      await client.auth.signUp({ email, password: 'langgenug1' });

      const code = extractCode(await fetchLatestMessageTo(email));

      const first = await client.auth.verifyOtp({ email, token: code, type: 'signup' });
      expect(first.error).toBeNull();

      const second = await client.auth.verifyOtp({ email, token: code, type: 'signup' });
      expect(second.error).not.toBeNull();
      expect(second.data.session).toBeNull();
    }, 30_000);

    it('schickt einen Link ohne fam://-Deep-Link, der in jedem Browser aufgeht', async () => {
      // Regression: Der Link zeigte auf `fam:///onboarding`. Ein Browser ohne
      // installierte App kann ein Custom Scheme nicht aufloesen — der Klick lief
      // dort ins Leere. Und weil die Session nur im Fragment dieses einen
      // Redirects zurueckkam, war der One-Time-Token danach verbrannt.
      //
      // Jetzt hat der Link genau eine Aufgabe: `email_confirmed_at` setzen. Das
      // gelingt von jedem Geraet aus; die App fragt den Server selbst.
      const email = uniqueEmail();
      await client.auth.signUp({ email, password: 'langgenug1' });

      const body = await fetchLatestMessageTo(email);

      expect(body).toContain('/auth/v1/verify');
      expect(body).not.toContain('fam://');
    }, 30_000);

    it('bestaetigt den Account, wenn der Link wie aus einem fremden Browser aufgerufen wird', async () => {
      // Der Fall aus dem Bug-Report, jetzt als Zusicherung: Ein reiner
      // HTTP-Aufruf des Links — ohne App, ohne Deep Link, ohne Fragment
      // auszuwerten — muss die Adresse serverseitig bestaetigen. Genau daran
      // haengt, dass die App danach per signInWithPassword weiterkommt.
      const email = uniqueEmail();
      const password = 'langgenug1';
      await client.auth.signUp({ email, password });

      const body = await fetchLatestMessageTo(email);
      const link = body.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1]?.replace(/&amp;/g, '&');
      if (!link) throw new Error(`Kein Bestaetigungslink in der Mail:\n${body}`);

      // Kein Redirect folgen: Der Browser wuerde es tun, aber uns interessiert
      // nur, dass der Aufruf selbst die Bestaetigung ausloest.
      const res = await fetch(link, { redirect: 'manual' });
      expect(res.status).toBeGreaterThanOrEqual(300);

      const after = await client.auth.signInWithPassword({ email, password });
      expect(after.error).toBeNull();
      expect(after.data.session?.user.email_confirmed_at).toEqual(expect.any(String));
    }, 30_000);
  });
});
