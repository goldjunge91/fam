// @ts-nocheck deno-lint-ignore-file
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { createEnrichOffProductHandler } from './handler.ts';
import { fetchOffProduct } from './off-client.ts';
import { SlidingWindowRateLimiter } from './rate-limiter.ts';

// JWT-geschuetzte globale Anreicherung mit Abstand zum OFF-Limit von 15/min/IP.
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
