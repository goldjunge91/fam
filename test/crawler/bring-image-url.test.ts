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

  it('akzeptiert die öffentliche Publitas-Bildquelle auf dem exakten Host', () => {
    const value = bringImageUrl(
      'https://view.publitas.com/resize/rev-95488569/UriN_fEyVDqXuIIRQh0jCOt8oXkYxmgjFSnJPzjCwik/fit-in/1504x2659/filters:quality(90)/production-revolution-publitas-com/89773/3471876/pages/57961b7d-99f7-4fbc-a118-d1d4c801580d-downscaled.jpg',
    );

    expect(value?.toString()).toBe(
      'https://view.publitas.com/resize/rev-95488569/UriN_fEyVDqXuIIRQh0jCOt8oXkYxmgjFSnJPzjCwik/fit-in/1504x2659/filters:quality(90)/production-revolution-publitas-com/89773/3471876/pages/57961b7d-99f7-4fbc-a118-d1d4c801580d-downscaled.jpg',
    );
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
    'https://evil.view.publitas.com/resize/publication/pages/page.jpg',
    'https://view.publitas.com.evil.test/resize/publication/pages/page.jpg',
    'https://view.publitas.com/content/publication/pages/page.jpg',
    'https://view.publitas.com/resize/../page.jpg',
  ])('weist nicht erlaubte URL zurück: %s', (value) => {
    expect(isAllowedBringImageUrl(value)).toBe(false);
    expect(bringImageUrl(value)).toBeNull();
  });
});
