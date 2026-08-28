import type { BrochureLocation, BrochureSource, CrawlerBrochure, ScraperResult } from '../types';

/**
 * REWE Prospekte Scraper Source
 */
export class ReweBrochureSource implements BrochureSource {
  name = 'rewe';

  async fetchBrochuresForLocation(location: BrochureLocation): Promise<ScraperResult[]> {
    const store = {
      id: 'rewe',
      name: 'REWE',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Rewe_Dein_Markt_Logo.svg',
    };

    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((dayOfWeek + 6) % 7));
    const saturday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);

    const regionPrefix = location.zipCode.substring(0, 2);
    const brochureId = `rewe-${regionPrefix}-${monday.toISOString().slice(0, 10)}`;

    const brochures: CrawlerBrochure[] = [
      {
        id: brochureId,
        storeId: 'rewe',
        title: `REWE Angebote der Woche (Region ${regionPrefix})`,
        validFrom: monday.toISOString(),
        validUntil: saturday.toISOString(),
        coverImage: 'https://www.rewe.de/assets/media/prospekt-cover.jpg',
        pages: [
          {
            number: 1,
            imageUrl: 'https://www.rewe.de/assets/media/prospekt-seite-1.jpg',
            hotspots: [
              {
                id: `rewe-${regionPrefix}-p1-1`,
                x: 12,
                y: 15,
                width: 36,
                height: 35,
                title: 'REWE Bio Gurken',
                description: 'aus Deutschland, Klasse I, Stück',
                priceCents: 89,
                oldPriceCents: 129,
                discount: '-31%',
                currency: 'EUR',
              },
              {
                id: `rewe-${regionPrefix}-p1-2`,
                x: 52,
                y: 15,
                width: 36,
                height: 35,
                title: 'ja! Speisequark Magerstufe',
                description: '500g Becher',
                priceCents: 99,
                currency: 'EUR',
              },
            ],
          },
        ],
      },
    ];

    return [{ store, brochures }];
  }
}
