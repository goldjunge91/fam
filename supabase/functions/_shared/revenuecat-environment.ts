const LOCAL_SUPABASE_HOSTS = new Set([
  '127.0.0.1',
  '::1',
  '[::1]',
  'host.docker.internal',
  'kong',
  'localhost',
]);

/** Sandbox RevenueCat purchases are accepted only by a function using the local Supabase stack. */
export function isLocalSupabaseUrl(supabaseUrl: string): boolean {
  try {
    return LOCAL_SUPABASE_HOSTS.has(new URL(supabaseUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}
