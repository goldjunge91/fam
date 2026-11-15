export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

export function requireSupabaseSecretKey(): string {
  const legacySecretKey = Deno.env.get('SUPABASE_SECRET_KEY');
  if (legacySecretKey) return legacySecretKey;

  const secretKeysJson = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeysJson) {
    try {
      const secretKeys: unknown = JSON.parse(secretKeysJson);
      if (
        secretKeys && typeof secretKeys === 'object' &&
        'default' in secretKeys && typeof secretKeys.default === 'string' && secretKeys.default
      ) {
        return secretKeys.default;
      }
    } catch {
      // Ignore malformed injected keys and report a stable missing-secret error below.
    }
  }

  const legacyServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacyServiceRoleKey) return legacyServiceRoleKey;

  throw new Error('missing_env:SUPABASE_SECRET_KEY');
}
