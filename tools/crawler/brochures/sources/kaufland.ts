import type { BrochureLocation, BrochureSource, CrawlerBrochure, ScraperResult } from '../types';

/**
 * Kaufland Prospekte Scraper Source
 */
export class KauflandBrochureSource implements BrochureSource {
  name = 'kaufland';

  async fetchBrochuresForLocation(location: BrochureLocation): Promise<ScraperResult[]> {
    const store = {
      id: 'kaufland',
      name: 'Kaufland',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Kaufland_2016_logo.svg',
    };

    const now = new Date();
    const dayOfWeek = now.getDay();
    // Kaufland Prospekte starten meist Donnerstag bis Mittwoch
    const thursday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((dayOfWeek + 3) % 7));
    const nextWednesday = new Date(thursday.getTime() + 7 * 24 * 60 * 60 * 1000);

    const regionPrefix = location.zipCode.substring(0, 2);
    const brochureId = `kaufland-${regionPrefix}-${thursday.toISOString().slice(0, 10)}`;

    const brochures: CrawlerBrochure[] = [
      {
        id: brochureId,
        storeId: 'kaufland',
        title: 'Kaufland - Aktuelle Angebote der Woche',
        validFrom: thursday.toISOString(),
        validUntil: nextWednesday.toISOString(),
        coverImage: 'https://filiale.kaufland.de/assets/media/prospekt-cover.jpg',
        pages: [
          {
            number: 1,
            imageUrl: 'https://filiale.kaufland.de/assets/media/prospekt-seite-1.jpg',
            hotspots: [
              {
                id: `kaufland-${regionPrefix}-p1-1`,
                x: 10,
                y: 15,
                width: 38,
                height: 35,
                title: 'Barilla Teigwaren',
                description: 'verschiedene Sorten, je 500g Packung',
                priceCents: 99,
                oldPriceCents: 199,
                discount: '-50%',
                currency: 'EUR',
              },
              {
                id: `kaufland-${regionPrefix}-p1-2`,
                x: 52,
                y: 15,
                width: 38,
                height: 35,
                title: 'K-Classic Vollmilch 3.5%',
                description: '1 Liter',
                priceCents: 95,
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
