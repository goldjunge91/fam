import { describe, expect, it } from '@jest/globals';
import {
  inspectBrochureCompleteness,
  inspectPageSequence,
  statusFromDiagnostics,
} from './completeness';

describe('Prospekt-Vollständigkeitsdiagnosen', () => {
  it('bewahrt fehlende und ungültige Gültigkeitswerte im Prüfbericht', () => {
    const diagnostics = inspectBrochureCompleteness(
      {
        id: 'brochure-1',
        validFrom: 'not-a-date',
        validUntil: '',
        pages: [],
      },
      { source: 'synthetic', brochureId: 'brochure-1' },
      { checkPages: false },
    );

    expect(diagnostics.map(({ code }) => code)).toEqual([
      'invalid-valid-from',
      'missing-valid-until',
    ]);
    expect(diagnostics[0].rawValue).toBe('not-a-date');
    expect(diagnostics[1].rawValue).toBe('');
    expect(statusFromDiagnostics(diagnostics)).toBe('incomplete');
  });

  it('erkennt Duplikate, Lücken und fehlende Bild-URLs ohne eine Lücke zu erfinden', () => {
    const diagnostics = inspectPageSequence(
      [
        { page: 1, image: 'https://example.test/1.jpg' },
        { page: 1, image: 'https://example.test/1b.jpg' },
        { page: 3, image: null },
      ],
      { source: 'synthetic', brochureId: 'brochure-1' },
    );

    expect(diagnostics.map(({ code }) => code)).toEqual([
      'duplicate-page-number',
      'missing-image-url',
      'page-number-gap',
    ]);
    expect(diagnostics.find(({ code }) => code === 'missing-image-url')?.rawValue).toBeNull();
    expect(
      diagnostics.find(({ code }) => code === 'page-number-gap')?.details?.missingPageNumbers,
    ).toEqual([2]);
  });

  it('stuft einen Händler ohne Quelle als not-found und nicht als Abruffehler ein', () => {
    const diagnostics = [
      {
        code: 'offers-list-succeeded' as const,
        severity: 'info' as const,
        scope: 'location' as const,
        message: 'ok',
      },
      {
        code: 'store-not-found' as const,
        severity: 'warning' as const,
        scope: 'location' as const,
        message: 'missing',
      },
    ];

    expect(statusFromDiagnostics(diagnostics)).toBe('not-found');
  });
});
