import { describe, expect, it } from '@jest/globals';
import { classifyRecordCoverage, manifestSelectionMode } from './verify-versions';
import type { PageSelectionManifest } from './verify-versions';

function pageSelection(overrides: Partial<PageSelectionManifest> = {}): PageSelectionManifest {
  return {
    mode: 'all-pages',
    deliveredPageNumbers: [1, 2],
    selectedPageNumbers: [1, 2],
    savedPageNumbers: [1, 2],
    failedPages: [],
    complete: true,
    ...overrides,
  };
}

function record(selection?: PageSelectionManifest) {
  return {
    id: 'brochure-1',
    storeId: 'store-1',
    storeName: 'Store',
    title: 'Prospekt',
    validFrom: '2026-09-01T00:00:00Z',
    validUntil: '2026-09-07T00:00:00Z',
    contentSignature: 'page-1:page-2',
    locations: ['10115'],
    pages: [
      {
        pageNumber: 1,
        assetPath: 'assets/page-1.jpg',
        contentHash: 'page-1',
        perceptualHash: 'a',
        bytes: 10,
      },
      {
        pageNumber: 2,
        assetPath: 'assets/page-2.jpg',
        contentHash: 'page-2',
        perceptualHash: 'b',
        bytes: 10,
      },
    ],
    ...(selection ? { pageSelection: selection } : {}),
  };
}

describe('Prospekt-Vollständigkeit für die Verifikation', () => {
  it('markiert nur all-pages ohne Fehler als vollständigen Prospekt', () => {
    expect(classifyRecordCoverage(record(pageSelection()), 'all-pages').status).toBe('complete');
    expect(
      classifyRecordCoverage(
        record(pageSelection({ savedPageNumbers: [1], complete: false })),
        'all-pages',
      ),
    ).toMatchObject({ status: 'partial', reason: expect.stringContaining('gespeichert') });
    expect(
      classifyRecordCoverage(
        record(
          pageSelection({
            failedPages: [{ pageNumber: 2, code: 'STORAGE_BUDGET_EXCEEDED', message: 'Budget' }],
            savedPageNumbers: [1],
            complete: false,
          }),
        ),
        'all-pages',
      ),
    ).toMatchObject({ status: 'partial', reason: expect.stringContaining('fehlgeschlagen') });
  });

  it('hält alte Hotspot-Manifeste und leere Datensätze als Teilansicht', () => {
    expect(classifyRecordCoverage(record(), 'all-pages-with-discount-hotspots').status).toBe(
      'partial',
    );
    expect(
      classifyRecordCoverage(
        record(
          pageSelection({
            deliveredPageNumbers: [],
            selectedPageNumbers: [],
            savedPageNumbers: [],
            complete: false,
          }),
        ),
        'all-pages',
      ).reason,
    ).toContain('leere Seitenfolge');
  });

  it('übernimmt den neuen Auswahlmodus vor dem Legacy-Feld', () => {
    expect(
      manifestSelectionMode({
        selectionMode: 'all-pages',
        pageSelection: 'all-pages-with-discount-hotspots',
      }),
    ).toBe('all-pages');
  });

  it('wertet blockierende Quellen- und Seitendiagnosen auch bei kompletter Auswahl aus', () => {
    expect(
      classifyRecordCoverage(record(pageSelection()), 'all-pages', [
        { code: 'page-number-gap', severity: 'error', brochureId: 'brochure-1' },
      ]).status,
    ).toBe('partial');
  });
});
