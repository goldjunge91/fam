export type SupabaseKeyMapName = 'SUPABASE_PUBLISHABLE_KEYS' | 'SUPABASE_SECRET_KEYS';

type SupabaseKeyType = 'publishable' | 'secret';

const KEY_PREFIXES: Record<SupabaseKeyType, string> = {
  publishable: 'sb_publishable_',
  secret: 'sb_secret_',
};

/** Reads only the default key from Supabase's hosted key maps and rejects legacy JWT keys. */
export function readDefaultSupabaseKey(
  keysJson: string | undefined,
  type: SupabaseKeyType,
): string | undefined {
  if (!keysJson?.trim()) return undefined;

  let keys: unknown;
  try {
    keys = JSON.parse(keysJson);
  } catch {
    return undefined;
  }

  if (typeof keys !== 'object' || keys === null || Array.isArray(keys)) return undefined;

  const key = Reflect.get(keys, 'default');
  if (typeof key !== 'string') return undefined;

  const trimmedKey = key.trim();
  const prefix = KEY_PREFIXES[type];
  if (
    !trimmedKey.startsWith(prefix) ||
    trimmedKey.length === prefix.length ||
    /\s/.test(trimmedKey)
  ) {
    return undefined;
  }

  return trimmedKey;
}

/** Requires the default hosted key and fails closed when it is missing or not a new-format key. */
export function requireDefaultSupabaseKey(name: SupabaseKeyMapName): string {
  const type = name === 'SUPABASE_PUBLISHABLE_KEYS' ? 'publishable' : 'secret';
  const key = readDefaultSupabaseKey(Deno.env.get(name), type);
  if (!key) throw new Error(`missing_or_invalid_env:${name}`);
  return key;
}
