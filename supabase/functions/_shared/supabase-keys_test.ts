import { assertEquals } from 'jsr:@std/assert@1';

import { readDefaultSupabaseKey } from './supabase-keys.ts';

Deno.test('reads the default publishable key and trims surrounding whitespace', () => {
  assertEquals(
    readDefaultSupabaseKey(' {"default":"  sb_publishable_test_value  "} ', 'publishable'),
    'sb_publishable_test_value',
  );
});

Deno.test('reads the default secret key', () => {
  assertEquals(
    readDefaultSupabaseKey('{"default":"sb_secret_test_value"}', 'secret'),
    'sb_secret_test_value',
  );
});

for (
  const [label, keysJson, type] of [
    ['missing map', undefined, 'secret'],
    ['malformed JSON', '{"default":', 'secret'],
    ['array instead of key map', '["sb_secret_test_value"]', 'secret'],
    ['missing default key', '{"secondary":"sb_secret_test_value"}', 'secret'],
    ['non-string default key', '{"default":123}', 'secret'],
    ['legacy service role JWT', '{"default":"eyJhbGciOiJIUzI1NiJ9.old.signature"}', 'secret'],
    ['legacy anon JWT', '{"default":"eyJhbGciOiJIUzI1NiJ9.old.signature"}', 'publishable'],
    ['secret key used as publishable', '{"default":"sb_secret_test_value"}', 'publishable'],
    ['publishable key used as secret', '{"default":"sb_publishable_test_value"}', 'secret'],
    ['prefix without a value', '{"default":"sb_secret_"}', 'secret'],
    ['key containing whitespace', '{"default":"sb_secret_test value"}', 'secret'],
  ] as const
) {
  Deno.test(`rejects ${label}`, () => {
    assertEquals(readDefaultSupabaseKey(keysJson, type), undefined);
  });
}
