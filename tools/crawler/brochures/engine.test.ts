import { describe, expect, it } from '@jest/globals';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { cleanNullBytes, crawlAllLocations, sanitizeBrochure } from './engine';
import type { BrochureLocation, BrochureSource, CrawlerBrochure, LocationDump } from './types';

describe('Crawler Engine & Schema Sanitizer', () => {
  it('entfernt zuverlässig Null-Bytes (\u0000 und \\0) aus Strings, Objekten und Arrays', () => {
    const dirtyData = {
      title: 'Barilla\u0000 Pasta & Pesto\0',
      description: 'Sonderangebot mit \\u0000 Null-Byte',
      tags: ['Bio\u0000', 'Vegan\0', 'Günstig'],
      nested: {
        raw: 'Ungültiges\u0000Zeichen',
      },
    };

    const cleaned = cleanNullBytes(dirtyData);

    expect(cleaned.title).toBe('Barilla Pasta & Pesto');
    expect(cleaned.description).toBe('Sonderangebot mit  Null-Byte');
    expect(cleaned.tags).toEqual(['Bio', 'Vegan', 'Günstig']);
    expect(cleaned.nested.raw).toBe('UngültigesZeichen');

    // Postgres JSONB serialization check: darf keine Null-Bytes mehr enthalten
    const jsonStr = JSON.stringify(cleaned);
    expect(jsonStr).not.toContain('\u0000');
    expect(jsonStr).not.toContain('\\u0000');
  });

  it('reinigt alle Hotspot-Felder und URLs beim Sanitizen', () => {
    const dirtyBrochure: CrawlerBrochure = {
      id: 'b-123\u0000',
      storeId: 'lidl\0',
      title: 'Lidl\u0000 Prospekt',
      validFrom: '2026-08-25T00:00:00.000Z',
      validUntil: '2026-09-01T00:00:00.000Z',
      coverImage: 'https://example.com/cover\u0000.jpg',
      pages: [
        {
          number: 1,
          imageUrl: 'https://example.com/page1\0.jpg',
          hotspots: [
            {
              id: 'h-1\u0000',
              x: 10,
              y: 20,
              width: 30,
              height: 40,
              title: 'Kaffee\u0000 Krönung',
              description: '500g\0 Packung',
              discount: '-20%\u0000',
              priceCents: 499,
              currency: 'EUR\0',
            },
          ],
        },
      ],
    };

    const sanitized = sanitizeBrochure(dirtyBrochure, 'lidl');

    expect(sanitized.id).toBe('b-123');
    expect(sanitized.storeId).toBe('lidl');
    expect(sanitized.title).toBe('Lidl Prospekt');
    expect(sanitized.coverImage).toBe('https://example.com/cover.jpg');
    expect(sanitized.pages[0].imageUrl).toBe('https://example.com/page1.jpg');
    expect(sanitized.pages[0].hotspots[0].title).toBe('Kaffee Krönung');
    expect(sanitized.pages[0].hotspots[0].description).toBe('500g Packung');
    expect(sanitized.pages[0].hotspots[0].discount).toBe('-20%');
    expect(sanitized.pages[0].hotspots[0].currency).toBe('EUR');
  });

  it('stellt sicher, dass alle SQLite NOT NULL Pflichtfelder existieren', () => {
    const brokenBrochure: Partial<CrawlerBrochure> = {
      title: 'Test Prospekt',
    };

    const fixed = sanitizeBrochure(brokenBrochure as CrawlerBrochure, 'store_1');

    expect(fixed.id).toBeDefined();
    expect(fixed.storeId).toBe('store_1');
    expect(fixed.title).toBe('Test Prospekt');
    expect(typeof fixed.validFrom).toBe('string');
    expect(typeof fixed.validUntil).toBe('string');
    expect(typeof fixed.coverImage).toBe('string');
    expect(Array.isArray(fixed.pages)).toBe(true);
  });

  it('schreibt automatisch ein lokales Backup auf Festplatte beim Crawling', async () => {
    const mockLocation: BrochureLocation = {
      zipCode: '99999',
      latitude: 50.0,
      longitude: 10.0,
      cityName: 'Teststadt',
    };

    const mockSource: BrochureSource = {
      name: 'mock',
      async fetchBrochuresForLocation() {
        return [
          {
            store: { id: 'test_store', name: 'Test Store' },
            brochures: [
              {
                id: 'mock-1',
                storeId: 'test_store',
                title: 'Mock Prospekt',
                validFrom: '2026-08-25T00:00:00Z',
                validUntil: '2026-09-01T00:00:00Z',
                coverImage: 'https://example.com/mock.jpg',
                pages: [],
              },
            ],
          },
        ];
      },
    };

    const backupPath = join(process.cwd(), 'tools', 'crawler', 'data', 'last_crawl_backup.json');
    if (existsSync(backupPath)) unlinkSync(backupPath);

    const result = await crawlAllLocations([mockLocation], {
      concurrency: 1,
      sources: [mockSource],
    });

    const content = JSON.parse(readFileSync(backupPath, 'utf8')) as LocationDump[];
    expect(content).toHaveLength(1);
    expect(content[0].location.zipCode).toBe('99999');
    expect(content[0].brochures[0].title).toBe('Mock Prospekt');
  });

  it('verhindert Postgres 22P05 Error (\\u0000 cannot be converted to text) auf realen Dump-Payloads', () => {
    // Simuliert reale Daten aus dem vorherigen Crawl mit fehlerhaften Unicode-Escape-Sequenzen
    const rawApiPayload = {
      stores: [{ id: 'kaufland\u0000', name: 'Kaufland\0 Filiale' }],
      brochures: [
        {
          id: 'kaufland-dump-1',
          storeId: 'kaufland',
          title: 'Angebote der Woche \u0000(Supermarkt)',
          validFrom: '2026-08-25T00:00:00Z',
          validUntil: '2026-09-01T00:00:00Z',
          coverImage: 'https://example.com/img.jpg',
          pages: [
            {
              number: 1,
              imageUrl: 'https://example.com/p1.jpg',
              hotspots: [
                {
                  id: 'h1',
                  x: 10,
                  y: 10,
                  width: 20,
                  height: 20,
                  title: 'Kaffee \u0000Jacobs Krönung',
                  description: '500g Packung \u0000 gemahlen',
                },
              ],
            },
          ],
        },
      ],
    };

    const cleaned = cleanNullBytes(rawApiPayload);
    const jsonString = JSON.stringify(cleaned);

    // Verifiziere, dass absolut kein Null-Byte im JSON vorkommt
    expect(jsonString).not.toContain('\u0000');
    expect(jsonString).not.toContain('\\u0000');
    expect(cleaned.stores[0].id).toBe('kaufland');
    expect(cleaned.stores[0].name).toBe('Kaufland Filiale');
    expect(cleaned.brochures[0].title).toBe('Angebote der Woche (Supermarkt)');
  });

  it('ruft den onChunkDone-Streaming-Callback nach jedem verarbeiteten Chunk auf', async () => {
    const mockLocations: BrochureLocation[] = [
      { zipCode: '11111', latitude: 50.0, longitude: 10.0, cityName: 'Ort 1' },
      { zipCode: '22222', latitude: 50.0, longitude: 10.0, cityName: 'Ort 2' },
    ];

    const mockSource: BrochureSource = {
      name: 'mock',
      async fetchBrochuresForLocation(loc) {
        return [
          {
            store: { id: `store-${loc.zipCode}`, name: 'Store' },
            brochures: [],
          },
        ];
      },
    };

    const streamedChunks: LocationDump[][] = [];

    await crawlAllLocations(mockLocations, {
      concurrency: 1,
      sources: [mockSource],
      onChunkDone: (chunk) => {
        streamedChunks.push(chunk);
      },
    });

    expect(streamedChunks).toHaveLength(2);
    expect(streamedChunks[0][0].location.zipCode).toBe('11111');
    expect(streamedChunks[1][0].location.zipCode).toBe('22222');
  });
});
