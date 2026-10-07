import { describe, expect } from '@jest/globals';
import { brochureImageSource, brochureImageUrl } from './brochure-image';

describe('brochureImageUrl', () => {
  const token = 'jwt-token';

  it('keeps access tokens out of private image urls', () => {
    expect(brochureImageUrl('brochures/dumps/assets/abc.jpg')).toBe(
      'http://127.0.0.1:54321/functions/v1/brochure-image?key=brochures%2Fdumps%2Fassets%2Fabc.jpg',
    );
  });

  it('adds the session token as an Authorization header for private image requests', () => {
    expect(brochureImageSource('brochures/dumps/assets/abc.jpg', token)).toEqual({
      uri: 'http://127.0.0.1:54321/functions/v1/brochure-image?key=brochures%2Fdumps%2Fassets%2Fabc.jpg',
      headers: { Authorization: 'Bearer jwt-token' },
    });
  });

  it('routes previously stored r2.dev links through the authenticated endpoint', () => {
    expect(
      brochureImageSource('https://pub-example.r2.dev/brochures/dumps/assets/abc.jpg', token),
    ).toEqual({
      uri: 'http://127.0.0.1:54321/functions/v1/brochure-image?key=brochures%2Fdumps%2Fassets%2Fabc.jpg',
      headers: { Authorization: 'Bearer jwt-token' },
    });
  });

  it('passes external urls through unchanged', () => {
    expect(brochureImageSource('https://cdn.example.test/cover.jpg', token)).toEqual({
      uri: 'https://cdn.example.test/cover.jpg',
    });
  });

  it('returns null for a private key without an access token', () => {
    expect(brochureImageSource('brochures/dumps/assets/abc.jpg', null)).toBeNull();
  });

  it('returns null for a missing value', () => {
    expect(brochureImageSource(null, token)).toBeNull();
    expect(brochureImageSource(undefined, token)).toBeNull();
  });
});
