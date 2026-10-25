import { useCallback } from 'react';
import { useSession } from '@/features/auth/session-provider';
import { env } from '@/lib/config/env';

export const BROCHURE_IMAGE_FUNCTION_PATH = 'functions/v1/brochure-image';

export type BrochureImageReference =
  | { brochureId: string; kind: 'cover' }
  | { brochureId: string; kind: 'page'; pageNumber: number }
  | { brochureId: string; kind: 'hotspot'; pageNumber: number; hotspotId: string }
  | { kind: 'store-logo'; storeId: string };

export type BrochureImageSource = {
  uri: string;
  headers?: Record<string, string>;
};

function referenceQuery(reference: BrochureImageReference): string {
  const params = new URLSearchParams({ asset: reference.kind });
  if ('brochureId' in reference) params.set('brochure_id', reference.brochureId);
  if (reference.kind === 'page' || reference.kind === 'hotspot') {
    params.set('page_number', String(reference.pageNumber));
  }
  if (reference.kind === 'hotspot') params.set('hotspot_id', reference.hotspotId);
  if (reference.kind === 'store-logo') params.set('store_id', reference.storeId);
  return params.toString();
}

export function brochureImageUrl(value: BrochureImageReference | null | undefined): string | null {
  if (!value) return null;
  const baseUrl = env.supabaseUrl.replace(/\/+$/, '');
  return `${baseUrl}/${BROCHURE_IMAGE_FUNCTION_PATH}?${referenceQuery(value)}`;
}

export function brochureImageSource(
  value: BrochureImageReference | null | undefined,
  accessToken: string | null | undefined,
): BrochureImageSource | null {
  const uri = brochureImageUrl(value);
  if (!uri) return null;
  if (!accessToken) return null;
  return {
    uri,
    headers: {
      apikey: env.supabaseKey,
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

export function useBrochureImageSourceFactory() {
  const { session } = useSession();
  const accessToken = session?.access_token ?? null;
  return useCallback(
    (value: BrochureImageReference | null | undefined) => brochureImageSource(value, accessToken),
    [accessToken],
  );
}
