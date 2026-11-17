import { assertEquals } from 'jsr:@std/assert@1';

import { readDefaultSupabaseKey, requireDefaultSupabaseKey } from './supabase-keys.ts';

const validPublishable = JSON.stringify({ default: 'sb_publishable_test' });
const validSecret = JSON.stringify({ default: 'sb_secret_test' });

Deno.test('accepts the default publishable key with its required prefix', () => {
  assertEquals(readDefaultSupabaseKey(validPublishable, 'publishable'), 'sb_publishable_test');
});

Deno.test('accepts the default secret key with its required prefix', () => {
  assertEquals(readDefaultSupabaseKey(validSecret, 'secret'), 'sb_secret_test');
});

Deno.test('rejects malformed, legacy, and non-default key bindings', () => {
  assertEquals(readDefaultSupabaseKey('{invalid', 'secret'), undefined);
  assertEquals(
    readDefaultSupabaseKey(JSON.stringify({ default: 'legacy-service-role' }), 'secret'),
    undefined,
  );
  assertEquals(
    readDefaultSupabaseKey(JSON.stringify({ other: 'sb_secret_test' }), 'secret'),
    undefined,
  );
  assertEquals(
    readDefaultSupabaseKey(JSON.stringify({ default: 'sb_secret_test value' }), 'secret'),
    undefined,
  );
});

Deno.test('requires the expected hosted binding and fails closed when it is absent', () => {
  const previous = Deno.env.get('SUPABASE_SECRET_KEYS');
  Deno.env.delete('SUPABASE_SECRET_KEYS');
  try {
    let message: string | undefined;
    try {
      requireDefaultSupabaseKey('SUPABASE_SECRET_KEYS');
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    assertEquals(message, 'missing_or_invalid_env:SUPABASE_SECRET_KEYS');
  } finally {
    if (previous === undefined) Deno.env.delete('SUPABASE_SECRET_KEYS');
    else Deno.env.set('SUPABASE_SECRET_KEYS', previous);
  }
});
