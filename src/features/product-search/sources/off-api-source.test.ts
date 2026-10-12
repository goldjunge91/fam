import { createOffApiSource, formatOFFProduct, SlidingWindowRateLimiter } from './off-api-source';

const originalFetch = global.fetch;
const originalOfflineFlag = process.env.EXPO_PUBLIC_OFF_OFFLINE;

afterEach(() => {
  jest.useRealTimers();
  global.fetch = originalFetch;
  if (originalOfflineFlag === undefined) delete process.env.EXPO_PUBLIC_OFF_OFFLINE;
  else process.env.EXPO_PUBLIC_OFF_OFFLINE = originalOfflineFlag;
});

describe('SlidingWindowRateLimiter', () => {
  it('erlaubt Anfragen bis zum Limit und blockt danach', () => {
    const limiter = new SlidingWindowRateLimiter(3, 60_000);
    const t0 = 1_000_000;

    expect(limiter.isLimited(t0)).toBe(false);
    limiter.record(t0);
    expect(limiter.isLimited(t0)).toBe(false);
    limiter.record(t0);
    expect(limiter.isLimited(t0)).toBe(false);
    limiter.record(t0);

    expect(limiter.isLimited(t0)).toBe(true);
  });

  it('laesst wieder Anfragen zu, sobald aeltere aus dem Fenster fallen', () => {
    const limiter = new SlidingWindowRateLimiter(2, 60_000);
    const t0 = 1_000_000;

    limiter.record(t0);
    limiter.record(t0 + 1_000);
    expect(limiter.isLimited(t0 + 2_000)).toBe(true);

    // Das erste Timestamp ist nach 60s aus dem Fenster raus.
    expect(limiter.isLimited(t0 + 61_000)).toBe(false);
  });

  it('startet unbelastet (kein Limit ohne vorherige Anfragen)', () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000);
    expect(limiter.isLimited()).toBe(false);
  });
});

describe('formatOFFProduct', () => {
  it('sollte Open Food Facts Rohdaten ordentlich formatieren', () => {
    const raw = {
      code: '4008400401027',
      product_name_de: 'Hafermilch Barista',
      brands: 'Oatly, Oatly AB',
      categories: 'Pflanzliche Lebensmittel, Getränke',
      quantity: '1 L',
      image_front_small_url: 'https://images.openfoodfacts.org/1.jpg',
      ingredients_text_de: 'Wasser, Hafer, Rapsöl',
      allergens_tags: ['en:oats', 'de:gluten'],
      nutriments: {
        'energy-kcal_100g': 59,
        proteins_100g: 1.1,
        carbohydrates_100g: 6.6,
        fat_100g: 3.0,
      },
    };

    const formatted = formatOFFProduct(raw);
    expect(formatted).toEqual({
      barcode: '4008400401027',
      name: 'Hafermilch Barista',
      brand: 'Oatly',
      quantity: 1,
      unit: 'l',
      imageUrl: 'https://images.openfoodfacts.org/1.jpg',
      caloriesPer100g: 59,
      proteinsPer100g: 1.1,
      carbsPer100g: 6.6,
      fatPer100g: 3.0,
      ingredients: 'Wasser, Hafer, Rapsöl',
      allergens: ['oats', 'gluten'],
      categoryTags: [],
    });
  });

  it('sollte categories_tags als kanonische Tag-IDs übernehmen', () => {
    const formatted = formatOFFProduct({
      code: '1',
      product_name: 'Schweineschnitzel',
      categories_tags: ['en:meats', 'en:porks', 'de:schweinefleisch'],
    });
    expect(formatted?.categoryTags).toEqual(['en:meats', 'en:porks', 'de:schweinefleisch']);
  });

  it('sollte Nicht-String-Werte in categories_tags ignorieren', () => {
    const formatted = formatOFFProduct({
      code: '1',
      product_name: 'Test',
      // biome-ignore lint/suspicious/noExplicitAny: bewusst kaputte Rohdaten aus der API simuliert
      categories_tags: ['en:meats', null, 42, undefined] as any,
    });
    expect(formatted?.categoryTags).toEqual(['en:meats']);
  });

  it('sollte ohne categories_tags ein leeres Array liefern', () => {
    const formatted = formatOFFProduct({ code: '1', product_name: 'Test' });
    expect(formatted?.categoryTags).toEqual([]);
  });

  it('sollte last_modified_t (Unix-Sekunden) in einen ISO-Zeitstempel umwandeln', () => {
    const formatted = formatOFFProduct({
      code: '1',
      product_name: 'Test',
      last_modified_t: 1_700_000_000,
    });
    expect(formatted?.offLastModifiedAt).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });

  it('sollte offLastModifiedAt bei fehlendem oder ungültigem last_modified_t weglassen', () => {
    expect(
      formatOFFProduct({ code: '1', product_name: 'Test' })?.offLastModifiedAt,
    ).toBeUndefined();
    expect(
      formatOFFProduct({ code: '1', product_name: 'Test', last_modified_t: 'kaputt' })
        ?.offLastModifiedAt,
    ).toBeUndefined();
  });

  it('sollte null zurückgeben wenn kein Produktname vorhanden ist', () => {
    expect(formatOFFProduct(null)).toBeNull();
    expect(formatOFFProduct({ product_name: '' })).toBeNull();
  });

  it('sollte Nutri-Score, NOVA-Gruppe und Naehrwert-Ampel mit auslesen', () => {
    const raw = {
      code: '4019300005307',
      product_name_de: 'Balance Reich an Protein',
      nutriscore_grade: 'b',
      nova_group: 4,
      nutrient_levels: { fat: 'low', 'saturated-fat': 'low', sugars: 'moderate', salt: 'high' },
      nutriments: {
        'energy-kcal_100g': 91,
        proteins_100g: 10,
        carbohydrates_100g: 3.3,
        fat_100g: 4.2,
        sugars_100g: 2.1,
        'saturated-fat_100g': 2.9,
        salt_100g: 1.1,
      },
    };

    const formatted = formatOFFProduct(raw);
    expect(formatted?.nutriScore).toBe('b');
    expect(formatted?.novaGroup).toBe(4);
    expect(formatted?.sugarsPer100g).toBe(2.1);
    expect(formatted?.saturatedFatPer100g).toBe(2.9);
    expect(formatted?.saltPer100g).toBe(1.1);
    expect(formatted?.nutrientLevels).toEqual({
      fat: 'low',
      saturatedFat: 'low',
      sugars: 'moderate',
      salt: 'high',
    });
  });

  it('sollte nutrientLevels weglassen, wenn Open Food Facts keine Ampel liefert', () => {
    const formatted = formatOFFProduct({ code: '1', product_name: 'Test' });
    expect(formatted?.nutrientLevels).toBeUndefined();
  });

  it('unterstuetzt die neue Search-a-licious-Antwort mit Marken als Array', () => {
    const formatted = formatOFFProduct({
      code: '1',
      product_name: 'Kirschen',
      brands: ['TIP', 'Hausmarke'],
      nutriscore_grade: 'b',
      nova_groups: '3',
    });

    expect(formatted).toMatchObject({
      brand: 'TIP',
      nutriScore: 'b',
      novaGroup: '3',
    });
  });
});

describe('createOffApiSource.search', () => {
  it('verwendet Search-a-licious statt der Legacy-Suche und mappt hits', async () => {
    process.env.EXPO_PUBLIC_OFF_OFFLINE = 'false';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        hits: [
          {
            code: '1',
            product_name: 'Kirschen',
            brands: ['TIP'],
            quantity: '680 g',
          },
        ],
        page: 1,
        page_size: 20,
        page_count: 2,
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await createOffApiSource().search('Kirschen', {
      offset: 0,
      limit: 20,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(url);
    expect(parsedUrl.origin + parsedUrl.pathname).toBe('https://search.openfoodfacts.org/search');
    expect(parsedUrl.searchParams.get('q')).toBe('Kirschen');
    expect(parsedUrl.searchParams.get('page')).toBe('1');
    expect(parsedUrl.searchParams.get('page_size')).toBe('20');
    expect(parsedUrl.searchParams.get('langs')).toBe('de,en');
    expect(parsedUrl.searchParams.get('fields')).toContain('product_name');
    expect(init.headers).toEqual({
      Accept: 'application/json',
      'User-Agent': 'FamApp/1.0 (contact@fam.app)',
    });
    expect(result.products[0]).toMatchObject({
      barcode: '1',
      name: 'Kirschen',
      brand: 'TIP',
      quantity: 680,
      unit: 'g',
    });
    expect(result.hasMore).toBe(true);
  });

  it('skips queries shorter than two characters after trimming', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await createOffApiSource().search(' a ', { offset: 0, limit: 20 });

    expect(result).toEqual({ products: [], hasMore: false, failed: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a failed result while offline without making a request', async () => {
    process.env.EXPO_PUBLIC_OFF_OFFLINE = 'true';
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      createOffApiSource().search('offline apples', { offset: 0, limit: 20 }),
    ).resolves.toMatchObject({ failed: true, products: [], hasMore: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a failed result for an unsuccessful HTTP response', async () => {
    process.env.EXPO_PUBLIC_OFF_OFFLINE = 'false';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: jest.fn(),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      createOffApiSource().search('server error apples', { offset: 0, limit: 20 }),
    ).resolves.toMatchObject({ failed: true, products: [], hasMore: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses the result cache for a repeated case-insensitive query', async () => {
    process.env.EXPO_PUBLIC_OFF_OFFLINE = 'false';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        hits: [{ code: 'cache-1', product_name: 'Cached Apple' }],
        page_count: 1,
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const source = createOffApiSource();

    const first = await source.search('Cache apples', { offset: 0, limit: 20 });
    const second = await source.search(' cache APPLES ', { offset: 0, limit: 20 });

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('infers another page when page_count is missing and the response fills the page', async () => {
    process.env.EXPO_PUBLIC_OFF_OFFLINE = 'false';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hits: [{ code: 'page-1', product_name: 'Apple' }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await createOffApiSource().search('page apples', { offset: 1, limit: 1 });

    expect(result).toMatchObject({ hasMore: true, failed: false });
    expect(new URL(fetchMock.mock.calls[0]?.[0] as string).searchParams.get('page')).toBe('2');
  });

  it('returns the empty result when an obsolete request is aborted', async () => {
    process.env.EXPO_PUBLIC_OFF_OFFLINE = 'false';
    const controller = new AbortController();
    controller.abort();
    const fetchMock = jest.fn().mockRejectedValue(new Error('aborted'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await createOffApiSource().search('old apples', {
      offset: 0,
      limit: 20,
      signal: controller.signal,
    });

    expect(result).toEqual({ products: [], hasMore: false, failed: false });
  });

  it('returns a failed result when the response cannot be parsed', async () => {
    process.env.EXPO_PUBLIC_OFF_OFFLINE = 'false';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('invalid JSON');
      },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      createOffApiSource().search('invalid JSON apples', { offset: 0, limit: 20 }),
    ).resolves.toMatchObject({ failed: true, products: [], hasMore: false });
  });

  it('stops searches after the sliding-window limit is reached', async () => {
    process.env.EXPO_PUBLIC_OFF_OFFLINE = 'false';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hits: [], page_count: 1 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const source = createOffApiSource();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        source.search(`rate-limit-${index}`, { offset: 0, limit: 20 }),
      ),
    );

    expect(results.some((result) => result.failed)).toBe(true);
    expect(fetchMock.mock.calls.length).toBeLessThan(10);
  });
});

describe('createOffApiSource.findByBarcode', () => {
  it('returns null for a blank barcode or when offline', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const source = createOffApiSource();

    await expect(source.findByBarcode('  ')).resolves.toBeNull();
    process.env.EXPO_PUBLIC_OFF_OFFLINE = 'true';
    await expect(source.findByBarcode('offline-1')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a found barcode product and returns null when no product was found', async () => {
    process.env.EXPO_PUBLIC_OFF_OFFLINE = 'false';
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 1, product: { code: 'barcode-1', product_name: 'Pears' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 0 }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;
    const source = createOffApiSource();

    await expect(source.findByBarcode('barcode-1')).resolves.toMatchObject({
      barcode: 'barcode-1',
      name: 'Pears',
    });
    await expect(source.findByBarcode('barcode-2')).resolves.toBeNull();
  });

  it('returns null after a non-retryable HTTP response', async () => {
    process.env.EXPO_PUBLIC_OFF_OFFLINE = 'false';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'not found',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(createOffApiSource().findByBarcode('missing-404')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a server response and returns the later successful product', async () => {
    process.env.EXPO_PUBLIC_OFF_OFFLINE = 'false';
    jest.useFakeTimers();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => '' })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 1, product: { code: 'retry-1', product_name: 'Plums' } }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const pending = createOffApiSource().findByBarcode('retry-1');
    await jest.advanceTimersByTimeAsync(500);

    await expect(pending).resolves.toMatchObject({ name: 'Plums' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null when an obsolete barcode request is aborted', async () => {
    process.env.EXPO_PUBLIC_OFF_OFFLINE = 'false';
    const controller = new AbortController();
    controller.abort();
    const fetchMock = jest.fn().mockRejectedValue(new Error('aborted'));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      createOffApiSource().findByBarcode('aborted-1', controller.signal),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null after exhausting retries for a network failure', async () => {
    process.env.EXPO_PUBLIC_OFF_OFFLINE = 'false';
    jest.useFakeTimers();
    const fetchMock = jest.fn().mockRejectedValue(new Error('network unavailable'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const pending = createOffApiSource().findByBarcode('network-failure-1');
    await jest.runAllTimersAsync();

    await expect(pending).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns null when barcode requests exceed their rate limit', async () => {
    process.env.EXPO_PUBLIC_OFF_OFFLINE = 'false';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 0 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const source = createOffApiSource();
    const results = await Promise.all(
      Array.from({ length: 15 }, (_, index) => source.findByBarcode(`rate-limit-${index}`)),
    );

    expect(results).toContain(null);
    expect(fetchMock.mock.calls.length).toBeLessThan(15);
  });
});
