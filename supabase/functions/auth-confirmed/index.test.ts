import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { handleAuthConfirmed } from './index.ts';

Deno.test('auth-confirmed: returns 200 with HTML and required security headers', async () => {
  const response = handleAuthConfirmed();

  assertEquals(response.status, 200);
  assertEquals(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assertEquals(response.headers.get('Cache-Control'), 'no-store');
  assertEquals(response.headers.get('X-Frame-Options'), 'DENY');
  assertEquals(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assertEquals(response.headers.get('Referrer-Policy'), 'no-referrer');
  assertEquals(
    response.headers.get('Content-Security-Policy'),
    "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none';",
  );

  const text = await response.text();
  assertStringIncludes(text, 'E-Mail bestätigt');
  assertStringIncludes(text, 'location.hash');
});
