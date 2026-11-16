import { assertEquals } from 'jsr:@std/assert@1';

import { requireSupabaseSecretKey } from './env.ts';

const ENVIRONMENT_KEYS = [
  'SUPABASE_SECRET_KEYS',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

function withEnvironment(
  values: Partial<Record<(typeof ENVIRONMENT_KEYS)[number], string>>,
  callback: () => void,
): void {
  const previousValues = new Map<string, string | undefined>();
  for (const name of ENVIRONMENT_KEYS) {
    previousValues.set(name, Deno.env.get(name));
    Deno.env.delete(name);
  }

  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined) Deno.env.set(name, value);
  }

  try {
    callback();
  } finally {
    for (const name of ENVIRONMENT_KEYS) {
      const previousValue = previousValues.get(name);
      if (previousValue === undefined) Deno.env.delete(name);
      else Deno.env.set(name, previousValue);
    }
  }
}

function assertMissingSecret(): void {
  let message: string | undefined;
  try {
    requireSupabaseSecretKey();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assertEquals(message, 'missing_env:SUPABASE_SECRET_KEY');
}

Deno.test('uses the named secret from the injected JSON binding', () => {
  withEnvironment(
    {
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'injected-secret' }),
      SUPABASE_SECRET_KEY: 'legacy-secret',
      SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-role',
    },
    () => assertEquals(requireSupabaseSecretKey(), 'injected-secret'),
  );
});

Deno.test('does not fall back to SUPABASE_SECRET_KEY', () => {
  withEnvironment({ SUPABASE_SECRET_KEY: 'legacy-secret' }, assertMissingSecret);
});

Deno.test('does not fall back to SUPABASE_SERVICE_ROLE_KEY', () => {
  withEnvironment({ SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-role' }, assertMissingSecret);
});
