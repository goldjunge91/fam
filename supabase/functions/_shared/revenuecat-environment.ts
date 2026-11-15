const LOCAL_SUPABASE_HOSTS = new Set([
  '127.0.0.1',
  '::1',
  '[::1]',
  'host.docker.internal',
  'kong',
  'localhost',
]);

/** Identifies the disposable local Supabase stack. */
export function isLocalSupabaseUrl(supabaseUrl: string): boolean {
  try {
    return LOCAL_SUPABASE_HOSTS.has(new URL(supabaseUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Allows RevenueCat sandbox data only for local or explicitly enabled testing. */
export function isRevenueCatSandboxAllowed(supabaseUrl: string): boolean {
  if (isLocalSupabaseUrl(supabaseUrl)) return true;
  return Deno.env.get('AI_ALLOW_SANDBOX_ENTITLEMENTS')?.trim().toLowerCase() === 'true';
}
