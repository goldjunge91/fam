// @ts-nocheck deno-lint-ignore-file
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { createEnrichOffProductHandler } from './handler.ts';
import { fetchOffProduct } from './off-client.ts';
import { SlidingWindowRateLimiter } from './rate-limiter.ts';

/**
 * Wird ausschließlich von eingeloggten Nutzern der App aufgerufen (Standard-
 * JWT-Verifikation der Edge Runtime läuft davor bereits — kein Eintrag in
 * config.toml, `verify_jwt` bleibt auf dem Default `true`, wie bei
 * `delete-account`). Welcher Nutzer ruft, spielt keine Rolle: `products` ist
 * global, die Anreicherung ist nicht haushaltsgebunden.
 *
 * Sicherheitsabstand zum dokumentierten OFF-Limit (15 Produktabfragen/Min/IP,
 * https://openfoodfacts.github.io/openfoodfacts-server/api/) — dieselbe
 * Vorsicht wie beim Client (src/lib/open-food-facts.ts): mehrere gleichzeitige
 * Nutzer teilen sich die ausgehende IP dieser Function.
 */
const rateLimiter = new SlidingWindowRateLimiter(12, 60_000);

const adminClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(
  createEnrichOffProductHandler({
    isRateLimited: () => rateLimiter.isLimited(),
    recordAttempt: () => rateLimiter.record(),
    fetchOffProduct,
    updateIfNewer: async (ean, categoryTags, offLastModifiedAt) => {
      const { error, count } = await adminClient
        .from('products')
        .update(
          { off_category_tags: categoryTags, off_last_modified_at: offLastModifiedAt },
          { count: 'exact' },
        )
        .eq('barcode', ean)
        .eq('source', 'off')
        .or(`off_last_modified_at.is.null,off_last_modified_at.lt.${offLastModifiedAt}`);

      return { error, count };
    },
  }),
);
