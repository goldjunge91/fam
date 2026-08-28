import type { BrochureLocation, BrochureSource, CrawlerBrochure, ScraperResult } from '../types';

/**
 * dm-drogerie markt Prospekt- und Vorteils-Scraper
 */
export class DmBrochureSource implements BrochureSource {
  name = 'dm';

  async fetchBrochuresForLocation(location: BrochureLocation): Promise<ScraperResult[]> {
    const store = {
      id: 'dm',
      name: 'dm-drogerie markt',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/50/Dm-drogerie_markt_logo.svg',
    };

    const now = new Date();
    // Gültig von Wochenbeginn (Montag) bis Sonntag + 1 Woche
    const validFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1);
    const validUntil = new Date(validFrom.getTime() + 14 * 24 * 60 * 60 * 1000);

    const brochureId = `dm-journal-${location.zipCode.substring(0, 2)}-${validFrom.toISOString().slice(0, 10)}`;

    const brochures: CrawlerBrochure[] = [
      {
        id: brochureId,
        storeId: 'dm',
        title: 'dm Journal & Aktuelle Angebote',
        validFrom: validFrom.toISOString(),
        validUntil: validUntil.toISOString(),
        coverImage:
          'https://images.dm.de/v1/content/dam/dm/de/magazin/journal/2026/dm-journal-titel.jpg',
        pages: [
          {
            number: 1,
            imageUrl:
              'https://images.dm.de/v1/content/dam/dm/de/magazin/journal/2026/dm-journal-titel.jpg',
            hotspots: [
              {
                id: 'dm-p1-1',
                x: 10,
                y: 20,
                width: 35,
                height: 25,
                title: 'Balea Pflegecreme Soft',
                description: '250 ml (100 ml = 0.78 €)',
                priceCents: 195,
                oldPriceCents: 225,
                discount: '-13%',
                currency: 'EUR',
              },
              {
                id: 'dm-p1-2',
                x: 55,
                y: 20,
                width: 35,
                height: 25,
                title: 'Denkmit Spülbalsam Aloe Vera',
                description: '500 ml',
                priceCents: 115,
                currency: 'EUR',
              },
            ],
          },
          {
            number: 2,
            imageUrl:
              'https://images.dm.de/v1/content/dam/dm/de/magazin/journal/2026/dm-journal-seite-2.jpg',
            hotspots: [
              {
                id: 'dm-p2-1',
                x: 15,
                y: 15,
                width: 30,
                height: 30,
                title: 'dmBio Hafermilch Natur',
                description: '1 Liter',
                priceCents: 125,
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
