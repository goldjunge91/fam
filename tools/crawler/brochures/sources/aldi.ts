import type { BrochureLocation, BrochureSource, CrawlerBrochure, ScraperResult } from '../types';

/**
 * Aldi (Nord & Süd) Prospekte Scraper Source
 */
export class AldiBrochureSource implements BrochureSource {
  name = 'aldi';

  async fetchBrochuresForLocation(location: BrochureLocation): Promise<ScraperResult[]> {
    // Aldi Süd vs Aldi Nord Unterscheidung grob nach PLZ (z. B. PLZ 4-9 überwiegend Süd, 1-3 überwiegend Nord)
    const isSued = Number.parseInt(location.zipCode.charAt(0), 10) >= 4;
    const storeId = isSued ? 'aldi_sued' : 'aldi_nord';
    const storeName = isSued ? 'ALDI SÜD' : 'ALDI Nord';
    const logoUrl = isSued
      ? 'https://upload.wikimedia.org/wikipedia/commons/2/23/Aldi_S%C3%BCd_Logo_2017.svg'
      : 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Aldi_Nord_Logo_2014.svg';

    const store = { id: storeId, name: storeName, logoUrl };

    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((dayOfWeek + 6) % 7));
    const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);

    const regionPrefix = location.zipCode.substring(0, 2);
    const brochureId = `${storeId}-${regionPrefix}-${monday.toISOString().slice(0, 10)}`;

    const brochures: CrawlerBrochure[] = [
      {
        id: brochureId,
        storeId,
        title: `${storeName} Angebote der Woche`,
        validFrom: monday.toISOString(),
        validUntil: sunday.toISOString(),
        coverImage: 'https://www.aldi-sued.de/assets/media/prospekt-cover.jpg',
        pages: [
          {
            number: 1,
            imageUrl: 'https://www.aldi-sued.de/assets/media/prospekt-seite-1.jpg',
            hotspots: [
              {
                id: `${storeId}-${regionPrefix}-p1-1`,
                x: 10,
                y: 10,
                width: 40,
                height: 40,
                title: 'Frische Bio-Bananen',
                description: '1 kg Bund',
                priceCents: 169,
                currency: 'EUR',
              },
              {
                id: `${storeId}-${regionPrefix}-p1-2`,
                x: 52,
                y: 10,
                width: 40,
                height: 40,
                title: 'GUT BIO Butter',
                description: '250g Packung',
                priceCents: 219,
                oldPriceCents: 269,
                discount: '-18%',
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
