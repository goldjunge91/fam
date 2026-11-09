import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import { extractPublicVideoUrl, isPublicHttpsUrl, loadRecipePage } from './recipe-source.ts';

type FakeDns = (hostname: string, recordType: string) => Promise<string[]>;

type FakeFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

async function withNetworkFakes<T>(
  dns: FakeDns,
  fetcher: FakeFetch,
  callback: () => Promise<T>,
): Promise<T> {
  const originalResolveDns = Deno.resolveDns;
  const originalFetch = globalThis.fetch;
  Object.defineProperty(Deno, 'resolveDns', {
    configurable: true,
    value: dns as typeof Deno.resolveDns,
  });
  globalThis.fetch = fetcher as typeof fetch;
  try {
    return await callback();
  } finally {
    Object.defineProperty(Deno, 'resolveDns', {
      configurable: true,
      value: originalResolveDns,
    });
    globalThis.fetch = originalFetch;
  }
}

function htmlResponse(body: string, contentType = 'text/html'): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': contentType },
  });
}

Deno.test('allows only public HTTPS hosts after resolving every address', async () => {
  const dnsCalls: string[] = [];
  await withNetworkFakes(
    (hostname, recordType) => {
      dnsCalls.push(`${hostname}:${recordType}`);
      if (hostname === 'private.example') return Promise.resolve(['192.168.1.10']);
      if (hostname === 'mixed.example' && recordType === 'AAAA') {
        return Promise.resolve(['fd00::1']);
      }
      if (hostname === 'dns-error.example') return Promise.reject(new Error('DNS unavailable'));
      return Promise.resolve(
        recordType === 'A' ? ['93.184.216.34'] : ['2001:4860:4860::8888'],
      );
    },
    () => Promise.resolve(htmlResponse('unused')),
    async () => {
      assertEquals(await isPublicHttpsUrl('https://example.test/recipe'), true);
      assertEquals(await isPublicHttpsUrl('https://private.example/recipe'), false);
      assertEquals(await isPublicHttpsUrl('https://mixed.example/recipe'), false);
      assertEquals(await isPublicHttpsUrl('https://dns-error.example/recipe'), false);

      for (
        const value of [
          'http://example.test/recipe',
          'https://user:password@example.test/recipe',
          'https://example.test:443/recipe',
          'https://localhost/recipe',
          'https://kitchen.local/recipe',
          'https://192.168.1.10/recipe',
          'not a url',
        ]
      ) {
        assertEquals(await isPublicHttpsUrl(value), false, value);
      }
      assertEquals(dnsCalls.includes('example.test:A'), true);
      assertEquals(dnsCalls.includes('example.test:AAAA'), true);
    },
  );
});

Deno.test('extracts structured recipes from JSON-LD graphs and instruction variants', async () => {
  const structuredHtml = `
    <html><body>
      <script type="application/ld+json">${
    JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': ['NewsArticle', 'Recipe'],
        name: ' Linsensuppe ',
        recipeYield: '4 Portionen',
        recipeIngredient: [' 200 g Linsen ', '', 4],
        recipeInstructions: [
          { '@type': 'HowToStep', text: 'Linsen waschen.' },
          'Linsen weich kochen.',
        ],
        description: 'Eine schnelle Suppe.',
      }],
    })
  }</script>
    </body></html>`;

  await withNetworkFakes(
    (_hostname, recordType) => Promise.resolve(recordType === 'A' ? ['93.184.216.34'] : []),
    () => Promise.resolve(htmlResponse(structuredHtml)),
    async () => {
      const result = await loadRecipePage('https://example.test/structured');
      assert(result.ok);
      if (!result.ok) return;
      assertEquals(result.draft, {
        kind: 'recipe_import_draft.v1',
        title: 'Linsensuppe',
        servings: 4,
        ingredients: [{ text: '200 g Linsen', confidence: 'high' }],
        steps: [
          'Linsen waschen.',
          'Linsen weich kochen.',
        ],
        notes: 'Eine schnelle Suppe.',
        warnings: [],
      });
      assertEquals(result.videoUrl, null);
    },
  );
});

Deno.test('resolves only HTTPS Instagram and Facebook CDN video metadata', () => {
  assertEquals(
    extractPublicVideoUrl(
      '<meta content="https://scontent.cdninstagram.com/reel.mp4?a=1&amp;b=2" property="og:video:secure_url">',
      'https://www.instagram.com/reel/abc/',
    ),
    'https://scontent.cdninstagram.com/reel.mp4?a=1&b=2',
  );
  assertEquals(
    extractPublicVideoUrl(
      '<meta property="og:video" content="https://video.xx.fbcdn.net/reel.mp4">',
      'https://www.instagram.com/reel/abc/',
    ),
    'https://video.xx.fbcdn.net/reel.mp4',
  );
  for (
    const content of [
      'http://scontent.cdninstagram.com/reel.mp4',
      'https://example.com/reel.mp4',
      'not a URL',
    ]
  ) {
    assertEquals(
      extractPublicVideoUrl(
        `<meta property="og:video" content="${content}">`,
        'https://www.instagram.com/reel/abc/',
      ),
      null,
    );
  }
  assertEquals(extractPublicVideoUrl('<html></html>', 'https://www.instagram.com/reel/abc/'), null);
});

Deno.test('falls back to readable text for malformed or incomplete JSON-LD recipes', async () => {
  const page = `
    <script type="application/ld+json">{not valid json}</script>
    <script type="application/ld+json">${
    JSON.stringify({
      '@type': 'Recipe',
      name: 'Unvollständige Suppe',
      recipeIngredient: ['Wasser'],
      recipeInstructions: [],
    })
  }</script>
    <article>Fallback-Rezepttext</article>`;

  await withNetworkFakes(
    (_hostname, recordType) => Promise.resolve(recordType === 'A' ? ['93.184.216.34'] : []),
    () => Promise.resolve(htmlResponse(page)),
    async () => {
      const result = await loadRecipePage('https://example.test/incomplete');
      assert(result.ok);
      if (!result.ok) return;
      assertEquals(result.draft, null);
      assertStringIncludes(result.text, 'Fallback-Rezepttext');
    },
  );
});

Deno.test('returns readable fallback text while removing inactive HTML content and decoding entities', async () => {
  const page = `
    <html>
      <head><style>private style</style><script>private script</script></head>
      <body>
        <h1>Tomatensuppe</h1>
        <p>Tomaten &amp; Öl</p>
        <div><span>Kochen</span><br>und umrühren.</div>
        <noscript>private noscript</noscript><iframe>private iframe</iframe>
      </body>
    </html>`;
  await withNetworkFakes(
    (_hostname, recordType) => Promise.resolve(recordType === 'A' ? ['93.184.216.34'] : []),
    () => Promise.resolve(htmlResponse(page)),
    async () => {
      const result = await loadRecipePage('https://example.test/plain');
      assert(result.ok);
      if (!result.ok) return;
      assertEquals(result.draft, null);
      assertStringIncludes(result.text, 'Tomatensuppe');
      assertStringIncludes(result.text, 'Tomaten & Öl');
      assertStringIncludes(result.text, 'Kochen');
      assertEquals(result.text.includes('private script'), false);
      assertEquals(result.text.includes('private style'), false);
      assertEquals(result.text.includes('private iframe'), false);
    },
  );
});

Deno.test('fails closed for unsafe redirects, content types, size limits, fetch errors, and redirect loops', async () => {
  const fetchCalls: string[] = [];
  const largeBody = new Uint8Array(1_500_001);
  await withNetworkFakes(
    (hostname, recordType) => {
      if (hostname === 'private.example') return Promise.resolve(['10.0.0.2']);
      return Promise.resolve(recordType === 'A' ? ['93.184.216.34'] : []);
    },
    (input) => {
      const url = String(input);
      fetchCalls.push(url);
      if (url.endsWith('/private-redirect')) {
        return Promise.resolve(
          new Response(null, {
            status: 302,
            headers: { location: 'https://private.example/recipe' },
          }),
        );
      }
      if (url.endsWith('/large-declared')) {
        return Promise.resolve(
          new Response('small', {
            status: 200,
            headers: { 'content-type': 'text/html', 'content-length': '1500001' },
          }),
        );
      }
      if (url.endsWith('/large-stream')) {
        return Promise.resolve(
          new Response(largeBody, {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
        );
      }
      if (url.endsWith('/pdf')) {
        return Promise.resolve(
          new Response('%PDF', {
            status: 200,
            headers: { 'content-type': 'application/pdf' },
          }),
        );
      }
      if (url.endsWith('/server-error')) {
        return Promise.resolve(new Response('error', { status: 500 }));
      }
      if (url.endsWith('/network-error')) {
        return Promise.reject(new Error('private network failure'));
      }
      if (url.endsWith('/redirect-loop')) {
        return Promise.resolve(
          new Response(null, {
            status: 302,
            headers: { location: 'https://example.test/redirect-loop' },
          }),
        );
      }
      if (url.endsWith('/malformed-redirect')) {
        return Promise.resolve(
          new Response(null, {
            status: 302,
            headers: { location: 'https://[invalid' },
          }),
        );
      }
      return Promise.resolve(htmlResponse('plain text', 'text/plain'));
    },
    async () => {
      assertEquals(await loadRecipePage('https://example.test/private-redirect'), {
        ok: false,
        status: 400,
        error: 'unsafe_source_url',
      });
      assertEquals(await loadRecipePage('https://example.test/pdf'), {
        ok: false,
        status: 415,
        error: 'source_not_a_webpage',
      });
      assertEquals(await loadRecipePage('https://example.test/large-declared'), {
        ok: false,
        status: 413,
        error: 'source_too_large',
      });
      assertEquals(await loadRecipePage('https://example.test/large-stream'), {
        ok: false,
        status: 413,
        error: 'source_too_large',
      });
      assertEquals(await loadRecipePage('https://example.test/network-error'), {
        ok: false,
        status: 422,
        error: 'source_unavailable',
      });
      assertEquals(await loadRecipePage('https://example.test/server-error'), {
        ok: false,
        status: 422,
        error: 'source_unavailable',
      });
      assertEquals(await loadRecipePage('https://example.test/redirect-loop'), {
        ok: false,
        status: 422,
        error: 'source_redirect_failed',
      });
      assertEquals(await loadRecipePage('https://example.test/malformed-redirect'), {
        ok: false,
        status: 422,
        error: 'source_redirect_failed',
      });
      assertEquals(await loadRecipePage('https://example.test/plain'), {
        ok: true,
        text: 'plain text',
        draft: null,
        videoUrl: null,
      });
      assertEquals(fetchCalls.includes('https://private.example/recipe'), false);
      assertEquals(fetchCalls.filter((url) => url.endsWith('/redirect-loop')).length, 4);
    },
  );
});
