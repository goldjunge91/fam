import { useCallback } from 'react';
import { useSession } from '@/features/auth/session-provider';
import { env } from '@/lib/config/env';

export const BROCHURE_IMAGE_FUNCTION_PATH = 'functions/v1/brochure-image';

export type BrochureImageSource = {
  uri: string;
  headers?: Record<string, string>;
};

function privateBrochureKey(value: string): string | null {
  if (value.startsWith('brochures/dumps/')) return value;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.r2.dev')) return null;
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    return key.startsWith('brochures/dumps/') ? key : null;
  } catch {
    return null;
  }
}

/** Builds the authenticated Edge Function URL for a private R2 key. */
export function brochureImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = privateBrochureKey(value);
  if (!key) return value;

  const baseUrl = env.supabaseUrl.replace(/\/+$/, '');
  return `${baseUrl}/${BROCHURE_IMAGE_FUNCTION_PATH}?key=${encodeURIComponent(key)}`;
}

export function brochureImageSource(
  value: string | null | undefined,
  accessToken: string | null | undefined,
): BrochureImageSource | null {
  const uri = brochureImageUrl(value);
  if (!uri) return null;
  if (!privateBrochureKey(value ?? '')) return { uri };
  if (!accessToken) return null;

  return { uri, headers: { Authorization: `Bearer ${accessToken}` } };
}

export function useBrochureImageSourceFactory() {
  const { session } = useSession();
  const accessToken = session?.access_token ?? null;

  return useCallback(
    (value: string | null | undefined) => brochureImageSource(value, accessToken),
    [accessToken],
  );
}
