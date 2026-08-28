import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  sanitizeJsonForPostgres,
  uploadDumpsInParallel,
  uploadDumpsToSupabase,
  uploadSingleBatch,
} from './uploader';
import type { LocationDump } from './types';

type MockDatabaseError = { message: string } | null;

function createDump(zipCode: string): LocationDump {
  return {
    location: { zipCode, latitude: 53.5, longitude: 10 },
    stores: [{ id: 'rewe', name: 'REWE' }],
    brochures: [
      {
        id: `brochure-${zipCode}`,
        storeId: 'rewe',
        title: 'REWE Angebote',
        validFrom: '2026-08-25T00:00:00Z',
        validUntil: '2026-09-01T00:00:00Z',
        coverImage: 'https://example.com/cover.jpg',
        pages: [],
      },
    ],
  };
}

function createSupabaseMock(options?: {
  bulkError?: MockDatabaseError;
  rowErrors?: MockDatabaseError[];
  deleteError?: MockDatabaseError;
}) {
  const storeUpsert = jest.fn(async () => ({ error: null as MockDatabaseError }));
  const dumpUpsert = jest.fn(async () => ({ error: null as MockDatabaseError }));
  dumpUpsert.mockResolvedValueOnce({ error: options?.bulkError ?? null });
  for (const error of options?.rowErrors ?? []) {
    dumpUpsert.mockResolvedValueOnce({ error });
  }

  const neq = jest.fn(async () => ({ error: options?.deleteError ?? null }));
  const inFilter = jest.fn(() => ({ neq }));
  const deleteRows = jest.fn(() => ({ in: inFilter }));
  const from = jest.fn((table: string) =>
    table === 'brochure_stores'
      ? { upsert: storeUpsert }
      : { upsert: dumpUpsert, delete: deleteRows },
  );

  return {
    client: { from } as unknown as SupabaseClient,
    dumpUpsert,
    inFilter,
    neq,
  };
}

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

  it('überspringt leere Dumps vollständig', async () => {
    const from = jest.fn(() => {
      throw new Error('Supabase darf für leere Dumps nicht aufgerufen werden');
    });
    const emptyDump: LocationDump = {
      location: { zipCode: '22043', latitude: 53.57, longitude: 10.09 },
      stores: [],
      brochures: [],
    };

    const result = await uploadSingleBatch(
      { from } as unknown as SupabaseClient,
      [emptyDump],
      '2026-08-28T08:00:00.000Z',
    );

    expect(result).toEqual({ uploadedCount: 0, storesCount: 0 });
    expect(from).not.toHaveBeenCalled();
  });

  it('bereinigt alte Dumps nur für erfolgreich geschriebene PLZs und anhand der run_id', async () => {
    const runId = '2026-08-28T08:00:00.000Z';
    const supabase = createSupabaseMock({
      bulkError: { message: 'Bulk fehlgeschlagen' },
      rowErrors: [null, { message: 'Zeile ungültig' }],
    });

    await expect(
      uploadSingleBatch(supabase.client, [createDump('11111'), createDump('22222')], runId),
    ).rejects.toThrow('1 Prospekt-Dumps fehlgeschlagen');

    expect(supabase.inFilter).toHaveBeenCalledWith('zip_code', ['11111']);
    expect(supabase.neq).toHaveBeenCalledWith('run_id', runId);
  });

  it('propagiert Fehler bei der Bereinigung', async () => {
    const supabase = createSupabaseMock({
      deleteError: { message: 'Delete fehlgeschlagen' },
    });

    await expect(
      uploadSingleBatch(
        supabase.client,
        [createDump('11111')],
        '2026-08-28T08:00:00.000Z',
      ),
    ).rejects.toThrow('Delete fehlgeschlagen');
  });
});
