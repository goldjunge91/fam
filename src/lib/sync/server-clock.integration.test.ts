import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { createServerClock } from '@/lib/sync/server-clock';

/**
 * `createServerClock` gegen die echte lokale Supabase-Instanz — kein Mock.
 * Braucht `supabase start`.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

describe('createServerClock gegen die lokale Supabase-Instanz', () => {
  beforeAll(() => {
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(SUPABASE_URL)) {
      throw new Error(`Nur gegen localhost erlaubt. Erhalten: ${SUPABASE_URL || '(leer)'}`);
    }
    if (!SUPABASE_KEY) {
      throw new Error('Kein ANON_KEY. Laeuft `supabase start`?');
    }
  });

  it('ein echter Request durch einen mit clock.fetch gebauten Client befuellt serverNowMs()', async () => {
    const clock = createServerClock();
    const client = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
      global: { fetch: clock.fetch },
    });

    expect(clock.serverNowMs()).toBeNull();

    // Irgendein echter Request reicht — products ist oeffentlich lesbar,
    // braucht keine vorherige Anmeldung.
    const { error } = await client.from('products').select('id').limit(1);
    expect(error).toBeNull();

    const serverNow = clock.serverNowMs();
    expect(serverNow).not.toBeNull();
    // Sekundenpraezision reicht laut Design — grosszuegige Toleranz gegen
    // Testumgebungs-Uhrendrift.
    expect(Math.abs(Date.now() - (serverNow ?? 0))).toBeLessThan(30_000);
  }, 30_000);
});
