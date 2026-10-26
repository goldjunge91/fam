import {
  parseKaufdaShelfPage,
  scrapeKaufdaZip,
} from '../../scripts/scrapers/kaufda';

function makeResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => JSON.parse(text) as unknown,
  } as Response;
}

function shelfBrochure(overrides: Record<string, unknown> = {}) {
  return {
    contentType: 'brochure',
    content: {
      type: 'BROCHURE',
      contentId: 'kaufda-content-1',
      title: 'Aktuelle Angebote',
      validFrom: '2026-10-26T00:00:00.000Z',
      validUntil: '2026-10-30T23:59:59.000Z',
      pageCount: 1,
      publisher: { id: 'publisher-123', name: 'Möbel Kraft' },
      ...overrides,
    },
  };
}

function shelfPage(
  contents: unknown[],
  {
    number = 0,
    size = 250,
    totalElements = contents.length,
    totalPages,
  }: { number?: number; size?: number; totalElements?: number; totalPages?: number } = {},
) {
  return {
    contents,
    page: {
      number,
      size,
      totalElements,
      totalPages: totalPages ?? Math.ceil(totalElements / size),
    },
  };
}

function viewerPageResponse(contentId = 'kaufda-content-1') {
  return {
    contents: [
      {
        images: [
          {
            size: '2800x2800',
            url: `https://content-media.bonial.biz/${contentId}-page-1.jpg?impolicy=zoomlarge`,
          },
          {
            size: '75x96',
            url: `https://content-media.bonial.biz/${contentId}-small.jpg?impolicy=previews`,
          },
        ],
        offers: [
          {
            content: {
              id: 'offer-1',
              image: 'https://content-media.bonial.biz/offer-1/main.jpg',
              products: [
                {
                  name: 'Sesamöl',
                  description: [{ paragraph: '250 ml' }, { paragraph: 'Hergestellt in Deutschland' }],
                },
              ],
              deals: [{ min: 1.29, currencyCode: 'EUR' }],
              discountLabel: { value: '20', type: 'PERCENTAGE' },
              parentContent: {
                page: {
                  area: {
                    topLeft: { x: 0.1, y: 0.2 },
                    bottomRight: { x: 0.6, y: 0.7 },
                  },
                },
              },
            },
          },
          {
            content: {
              id: 'offer-without-area',
              products: [{ name: 'Not positioned' }],
              parentContent: { page: { area: null } },
            },
          },
          {
            content: {
              id: 'offer-without-product-name',
              products: [],
              parentContent: {
                page: {
                  area: {
                    topLeft: { x: 0.1, y: 0.2 },
                    bottomRight: { x: 0.6, y: 0.7 },
                  },
                },
              },
            },
          },
        ],
      },
    ],
  };
}

function queuedFetcher(responses: Response[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    const response = responses.shift();
    if (!response) throw new Error('Unexpected request.');
    return response;
  };
  return { fetcher, calls };
}

const location = {
  zipCode: '22043',
  city: 'Hamburg',
  latitude: 53.5659,
  longitude: 10.0254,
};

describe('KaufDA brochure scraper', () => {
  it('discovers publishers across categories from the ZIP shelf and keeps each copy regional', async () => {
    const { fetcher, calls } = queuedFetcher([
      makeResponse(
        200,
        shelfPage([
          shelfBrochure(),
          shelfBrochure({
            contentId: 'furniture-content-2',
            title: 'Wohnideen',
            publisher: { id: 'publisher-456', name: 'XXXLutz' },
          }),
          {
            contentType: 'brochurePremium',
            content: { type: 'DYNAMIC', publisher: { id: 'dynamic', name: 'Dynamic' } },
          },
          { contentType: 'blogCarousel', content: { type: 'BLOG' } },
        ]),
      ),
      makeResponse(200, viewerPageResponse()),
      makeResponse(200, viewerPageResponse('furniture-content-2')),
    ]);

    const brochures = await scrapeKaufdaZip({ ...location, fetcher });

    expect(brochures).toHaveLength(2);
    expect(brochures[0]).toMatchObject({
      id: 'kaufda:22043:kaufda:publisher-123:kaufda-content-1',
      content_id: 'kaufda-content-1',
      source_zip_code: '22043',
      store_id: 'kaufda:publisher-123',
      store_name: 'Möbel Kraft',
      available_zip_codes: ['22043'],
      page_count: 1,
      cover_image_url:
        'https://content-media.bonial.biz/kaufda-content-1-page-1.jpg?impolicy=zoomlarge',
    });
    expect(brochures[1]).toMatchObject({
      store_name: 'XXXLutz',
      store_id: 'kaufda:publisher-456',
      content_id: 'furniture-content-2',
    });
    expect(brochures[0]?.pages[0]).toMatchObject({
      page_number: 1,
      thumbnail_url:
        'https://content-media.bonial.biz/kaufda-content-1-small.jpg?impolicy=previews',
      hotspots: [
        {
          id: 'offer-1',
          title: 'Sesamöl',
          description: '250 ml Hergestellt in Deutschland',
          priceCents: 129,
          priceLabel: '1,29 €',
          discount: '-20%',
          x: 10,
          y: 20,
          width: 50,
          height: 50,
        },
      ],
    });
    expect(calls).toHaveLength(3);
    expect(calls.map(({ url }) => new URL(url).hostname)).toEqual([
      'www.kaufda.de',
      'content-viewer-be.kaufda.de',
      'content-viewer-be.kaufda.de',
    ]);
    expect(new URL(calls[0]?.url ?? '').pathname).toBe('/api/shelf');
    expect(new URL(calls[0]?.url ?? '').searchParams.get('sectorIds')).toBe('');
    expect(new URL(calls[0]?.url ?? '').searchParams.get('size')).toBe('250');
    expect(calls[0]?.init?.headers).toMatchObject({
      Cookie: expect.stringContaining('zip%22%3A%2222043'),
    });
    expect(new URL(calls[1]?.url ?? '').searchParams.get('lat')).toBe('53.5659');
  });

  it('fetches every shelf page before fetching all real brochure pages', async () => {
    const firstPageContents: unknown[] = [shelfBrochure()];
    while (firstPageContents.length < 250) {
      firstPageContents.push({ contentType: 'newsletterBanner', content: {} });
    }
    const secondBrochure = shelfBrochure({
      contentId: 'page-two-content',
      publisher: { id: 'publisher-two', name: 'MediaMarkt Saturn' },
    });
    const { fetcher, calls } = queuedFetcher([
      makeResponse(
        200,
        shelfPage(firstPageContents, { size: 250, totalElements: 251, totalPages: 2 }),
      ),
      makeResponse(200, shelfPage([secondBrochure], { number: 1, size: 250, totalElements: 251, totalPages: 2 })),
      makeResponse(200, viewerPageResponse()),
      makeResponse(200, viewerPageResponse('page-two-content')),
    ]);

    const brochures = await scrapeKaufdaZip({ ...location, fetcher });

    expect(brochures).toHaveLength(2);
    expect(calls).toHaveLength(4);
    expect(new URL(calls[0]?.url ?? '').searchParams.get('page')).toBe('0');
    expect(new URL(calls[1]?.url ?? '').searchParams.get('page')).toBe('1');
  });

  it('does not return partial page data when the detail response is incomplete', async () => {
    const { fetcher } = queuedFetcher([
      makeResponse(200, shelfPage([shelfBrochure({ pageCount: 2 })])),
      makeResponse(200, viewerPageResponse()),
    ]);

    await expect(scrapeKaufdaZip({ ...location, fetcher })).rejects.toThrow('expected 2');
  });

  it('fails clearly when the shelf response no longer has the expected structure', () => {
    expect(() => parseKaufdaShelfPage({ contents: [], page: {} }, 0)).toThrow(
      'invalid shelf page number',
    );
    expect(() =>
      parseKaufdaShelfPage(
        shelfPage([shelfBrochure({ pageCount: 0 })]),
        0,
      ),
    ).toThrow('invalid dates or pageCount');
  });

  it('rejects pagination changes while a ZIP is being read', async () => {
    const firstPageContents: unknown[] = [shelfBrochure()];
    while (firstPageContents.length < 250) {
      firstPageContents.push({ contentType: 'newsletterBanner', content: {} });
    }
    const secondPageContents = Array.from({ length: 250 }, () => ({
      contentType: 'newsletterBanner',
      content: {},
    }));
    const { fetcher } = queuedFetcher([
      makeResponse(
        200,
        shelfPage(firstPageContents, { size: 250, totalElements: 501, totalPages: 3 }),
      ),
      makeResponse(
        200,
        shelfPage(secondPageContents, { number: 1, size: 250, totalElements: 502, totalPages: 3 }),
      ),
    ]);

    await expect(scrapeKaufdaZip({ ...location, fetcher })).rejects.toThrow(
      'pagination changed during the PLZ scan',
    );
  });

  it('skips dynamic cards that do not contain brochure pages', async () => {
    const { fetcher, calls } = queuedFetcher([
      makeResponse(
        200,
        shelfPage([
          {
            contentType: 'brochurePremium',
            content: { type: 'DYNAMIC', publisher: { id: 'dynamic', name: 'Dynamic' } },
          },
        ]),
      ),
    ]);

    await expect(scrapeKaufdaZip({ ...location, fetcher })).resolves.toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('retries a rate-limited shelf request', async () => {
    const { fetcher, calls } = queuedFetcher([
      makeResponse(429, {}, { 'retry-after': '0' }),
      makeResponse(200, shelfPage([])),
    ]);

    await expect(scrapeKaufdaZip({ ...location, fetcher })).resolves.toEqual([]);
    expect(calls).toHaveLength(2);
  });
});
