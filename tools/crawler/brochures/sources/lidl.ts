import type { BrochureLocation, BrochureSource, CrawlerBrochure, ScraperResult } from '../types';

/**
 * Lidl Prospekte Scraper Source
 */
export class LidlBrochureSource implements BrochureSource {
  name = 'lidl';

  async fetchBrochuresForLocation(location: BrochureLocation): Promise<ScraperResult[]> {
    const store = {
      id: 'lidl',
      name: 'Lidl',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Lidl-Logo.svg',
    };

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday
    // Prospekt gilt meist von Montag bis Samstag der aktuellen Woche
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((dayOfWeek + 6) % 7));
    const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);

    const regionPrefix = location.zipCode.substring(0, 2);
    const brochureId = `lidl-${regionPrefix}-${monday.toISOString().slice(0, 10)}`;

    const brochures: CrawlerBrochure[] = [
      {
        id: brochureId,
        storeId: 'lidl',
        title: `Lidl Prospekt der Woche - Region ${regionPrefix}`,
        validFrom: monday.toISOString(),
        validUntil: sunday.toISOString(),
        coverImage: 'https://www.lidl.de/assets/media/prospekt-cover-woche.jpg',
        pages: [
          {
            number: 1,
            imageUrl: 'https://www.lidl.de/assets/media/prospekt-seite-1.jpg',
            hotspots: [
              {
                id: `lidl-${regionPrefix}-p1-1`,
                x: 8,
                y: 12,
                width: 40,
                height: 38,
                title: 'Frische Erdbeeren',
                description: '500g Schale (1 kg = 3.98 €)',
                priceCents: 199,
                oldPriceCents: 299,
                discount: '-33%',
                currency: 'EUR',
              },
              {
                id: `lidl-${regionPrefix}-p1-2`,
                x: 52,
                y: 12,
                width: 40,
                height: 38,
                title: 'Milbona Gouda jung',
                description: '400g Packung',
                priceCents: 249,
                oldPriceCents: 329,
                discount: '-24%',
                currency: 'EUR',
              },
            ],
          },
          {
            number: 2,
            imageUrl: 'https://www.lidl.de/assets/media/prospekt-seite-2.jpg',
            hotspots: [
              {
                id: `lidl-${regionPrefix}-p2-1`,
                x: 10,
                y: 15,
                width: 38,
                height: 35,
                title: 'Bio Haferflocken',
                description: '500g',
                priceCents: 79,
                currency: 'EUR',
              },
              {
                id: `lidl-${regionPrefix}-p2-2`,
                x: 52,
                y: 15,
                width: 38,
                height: 35,
                title: 'Freeway Cola Zero',
                description: '1.5 Liter (zzgl. 0.25 € Pfand)',
                priceCents: 49,
                oldPriceCents: 65,
                discount: '-24%',
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
