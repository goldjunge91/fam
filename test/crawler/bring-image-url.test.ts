import { describe, expect, it } from '@jest/globals';
import {
  bringImageUrl,
  isAllowedBringImageUrl,
} from '../../tools/crawler/brochures/bring-image-url';

describe('Bring-Bildquellen', () => {
  it('akzeptiert HTTPS-Subdomains unter bringapi.app und bewahrt Query-Parameter', () => {
    const value = bringImageUrl('https://cdn.bringapi.app/content/de/page.jpg?size=large');

    expect(value?.toString()).toBe('https://cdn.bringapi.app/content/de/page.jpg?size=large');
  });

  it.each([
    'https://bringapi.app/content/page.jpg',
    'https://cdn.bringapi.app.evil.test/content/page.jpg',
    'http://cdn.bringapi.app/content/page.jpg',
    'https://cdn.bringapi.app:8443/content/page.jpg',
    'https://user:pass@cdn.bringapi.app/content/page.jpg',
    'https://cdn.bringapi.app./content/page.jpg',
    'https://cdn.bringapi.app/content/../secret.jpg',
    'https://cdn.bringapi.app/content/%2e%2e/secret.jpg',
    'https://cdn.bringapi.app/content/file%2fsecret.jpg',
    'https://cdn.bringapi.app/content/file%252e%252e/secret.jpg',
    'https://cdn.bringapi.app/content/file//secret.jpg',
    'https://cdn.bringapi.app/content/',
    'https://cdn.bringapi.app/content/page.jpg#fragment',
    'https://cdn.bringapi.app/offers/page.jpg',
    'https://cdn.bringapi.app/content/%ZZ.jpg',
  ])('weist nicht erlaubte URL zurück: %s', (value) => {
    expect(isAllowedBringImageUrl(value)).toBe(false);
    expect(bringImageUrl(value)).toBeNull();
  });
});
