import { parseBrochureLocations, parseGeoNamesPostalCodes, transformBrochure } from './transform';

describe('brochure dump transformation', () => {
  it('extrahiert Haendler, Seitenbilder und Discount-Hotspots', () => {
    const transformed = transformBrochure(
      {
        brn: 'brn:brochure:123',
        title: 'Wochenangebote',
        activeFrom: '2026-08-24T00:00:00.000Z',
        activeTo: '2026-08-30T23:59:59.000Z',
        company: { title: 'EDEKA Nord', logoUrl: 'https://cdn.example/edeka.png' },
        pages: [{ image: { imageUrl: 'https://cdn.example/cover.jpg' } }],
      },
      {
        pages: [
          {
            page: 1,
            image: { imageUrl: 'https://cdn.example/page-1.jpg' },
            discounts: [
              {
                providerDiscountId: '416769',
                name: 'Barilla Pasta',
                description: '500 g',
                price: 129,
                oldPrice: 149,
                discount: '-13%',
                currency: 'EUR',
                coordinates: { top: 0.1, left: 0.2, width: 0.3, height: 0.4 },
              },
            ],
          },
        ],
      },
    );

    expect(transformed).toEqual({
      store: {
        id: 'edeka_nord',
        name: 'EDEKA Nord',
        logoUrl: 'https://cdn.example/edeka.png',
      },
      brochure: {
        id: 'brn:brochure:123',
        storeId: 'edeka_nord',
        title: 'Wochenangebote',
        validFrom: '2026-08-24T00:00:00.000Z',
        validUntil: '2026-08-30T23:59:59.000Z',
        coverImage: 'https://cdn.example/cover.jpg',
        pages: [
          {
            number: 1,
            imageUrl: 'https://cdn.example/page-1.jpg',
            hotspots: [
              {
                id: '416769',
                x: 20,
                y: 10,
                width: 30,
                height: 40,
                title: 'Barilla Pasta',
                description: '500 g',
                discount: '-13%',
                priceCents: 129,
                oldPriceCents: 149,
                currency: 'EUR',
              },
            ],
          },
        ],
      },
    });
  });

  it('ignoriert unvollstaendige Hotspots, behaelt aber die Prospektseite', () => {
    const transformed = transformBrochure(
      {
        brn: 'brochure-1',
        activeFrom: '2026-08-24T00:00:00.000Z',
        activeTo: '2026-08-30T23:59:59.000Z',
        company: { title: 'Lidl' },
      },
      {
        pages: [
          {
            page: 1,
            image: { imageUrl: 'https://cdn.example/page.jpg' },
            discounts: [{ name: 'Ohne Koordinaten' }],
          },
        ],
      },
    );

    expect(transformed?.brochure.pages[0].hotspots).toEqual([]);
    expect(transformed?.brochure.coverImage).toBe('https://cdn.example/page.jpg');
  });

  it('validiert konfigurierbare PLZ-Gebiete', () => {
    expect(
      parseBrochureLocations('[{"zipCode":"10115","latitude":52.5323,"longitude":13.3846}]'),
    ).toEqual([{ zipCode: '10115', latitude: 52.5323, longitude: 13.3846 }]);
    expect(() => parseBrochureLocations('[{"zipCode":"1011"}]')).toThrow(
      'Ungueltiger Ort an Position 0',
    );
  });

  it('verdichtet GeoNames-Orte auf einen Mittelpunkt je deutscher PLZ', () => {
    const rows = [
      'DE\t10115\tBerlin\tBerlin\t16\t\t\t\t\t52.53\t13.38\t4',
      'DE\t10115\tBerlin Mitte\tBerlin\t16\t\t\t\t\t52.55\t13.40\t4',
      'DE\t22043\tHamburg\tHamburg\t04\t\t\t\t\t53.57\t10.09\t4',
      'AT\t1010\tWien\tWien\t09\t\t\t\t\t48.21\t16.37\t4',
    ].join('\n');

    expect(parseGeoNamesPostalCodes(rows)).toEqual([
      { zipCode: '10115', latitude: 52.54, longitude: 13.39 },
      { zipCode: '22043', latitude: 53.57, longitude: 10.09 },
    ]);
  });
});
