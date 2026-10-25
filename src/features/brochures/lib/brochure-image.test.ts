import { describe, expect, it } from '@jest/globals';
import { brochureImageSource, brochureImageUrl } from './brochure-image';

describe('brochureImageUrl', () => {
  const token = 'jwt-token';

  it('builds a stable page request from its regional brochure id', () => {
    const value = brochureImageUrl({
      brochureId: 'canonical:["10115","brn-1"]',
      kind: 'page',
      pageNumber: 3,
    });
    if (!value) throw new Error('Expected a brochure image URL');
    const url = new URL(value);

    expect(url.origin).toBe('http://127.0.0.1:54321');
    expect(url.pathname).toBe('/functions/v1/brochure-image');
    expect(url.searchParams.get('brochure_id')).toBe('canonical:["10115","brn-1"]');
    expect(url.searchParams.get('asset')).toBe('page');
    expect(url.searchParams.get('page_number')).toBe('3');
  });

  it('sends the app key and session token only to the authenticated backend path', () => {
    expect(brochureImageSource({ brochureId: 'regional-id', kind: 'cover' }, token)).toEqual({
      uri: 'http://127.0.0.1:54321/functions/v1/brochure-image?asset=cover&brochure_id=regional-id',
      headers: {
        apikey: 'test-supabase-anon-key',
        Authorization: 'Bearer jwt-token',
      },
    });
  });

  it('creates a shared logo request by store identity', () => {
    const value = brochureImageUrl({ kind: 'store-logo', storeId: 'store-1' });
    if (!value) throw new Error('Expected a store logo URL');
    const url = new URL(value);

    expect(url.searchParams.get('asset')).toBe('store-logo');
    expect(url.searchParams.get('store_id')).toBe('store-1');
  });

  it('does not create an image source without a session token', () => {
    expect(brochureImageSource({ brochureId: 'regional-id', kind: 'cover' }, null)).toBeNull();
  });

  it('returns null for a missing reference', () => {
    expect(brochureImageSource(null, token)).toBeNull();
    expect(brochureImageSource(undefined, token)).toBeNull();
  });
});
