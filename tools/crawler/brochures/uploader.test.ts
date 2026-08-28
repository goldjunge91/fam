import { describe, expect, it } from '@jest/globals';
import { sanitizeJsonForPostgres, uploadDumpsInParallel, uploadDumpsToSupabase } from './uploader';
import type { LocationDump } from './types';

describe('Uploader Fault-Tolerance & Resilience', () => {
  it('schaltet im Dry-Run sauber ab und wirft keine Fehler', async () => {
    const mockDumps: LocationDump[] = [
      {
        location: { zipCode: '22043', latitude: 53.57, longitude: 10.09 },
        stores: [{ id: 'rewe', name: 'REWE' }],
        brochures: [
          {
            id: 'b-1',
            storeId: 'rewe',
            title: 'REWE Angebote',
            validFrom: new Date().toISOString(),
            validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
            coverImage: 'https://example.com/cover.jpg',
            pages: [],
          },
        ],
      },
    ];

    const result = await uploadDumpsToSupabase(mockDumps, {
      supabaseUrl: '',
      supabaseSecretKey: '',
      dryRun: true,
    });

    expect(result.uploadedCount).toBe(1);
    expect(result.storesCount).toBe(0);
  });

  it('entfernt zuverlässig Steuerzeichen und Null-Bytes auf JSON-String-Ebene', () => {
    const complexPayload = {
      title: 'Netto \u0000Prospekt\0',
      description: 'Gültig ab Montag \\u0000',
      hotspots: [
        {
          name: 'Milch \u00001.5%',
        },
      ],
    };

    const sanitized = sanitizeJsonForPostgres(complexPayload);
    const jsonStr = JSON.stringify(sanitized);

    expect(jsonStr).not.toContain('\u0000');
    expect(jsonStr).not.toContain('\\u0000');
    expect(sanitized.title).toBe('Netto Prospekt');
    expect(sanitized.description).toBe('Gültig ab Montag ');
    expect(sanitized.hotspots[0].name).toBe('Milch 1.5%');
  });

  it('unterstützt parallelen Upload mit Fortschritts-Callback im Dry-Run', async () => {
    const mockDumps: LocationDump[] = Array.from({ length: 25 }, (_, i) => ({
      location: { zipCode: `2000${i}`, latitude: 53.5, longitude: 10.0 },
      stores: [],
      brochures: [],
    }));

    let reportedCount = 0;

    const result = await uploadDumpsInParallel(
      mockDumps,
      { supabaseUrl: '', supabaseSecretKey: '', dryRun: true },
      {
        concurrency: 2,
        onProgress: (uploaded) => {
          reportedCount = uploaded;
        },
      },
    );

    expect(result.uploadedCount).toBe(25);
  });
});
