import { createOffApiSource, formatOFFProduct, SlidingWindowRateLimiter } from './off-api-source';

const originalFetch = global.fetch;
const originalOfflineFlag = process.env.EXPO_PUBLIC_OFF_OFFLINE;

afterEach(() => {
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
});
