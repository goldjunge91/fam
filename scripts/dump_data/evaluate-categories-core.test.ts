import { CLASSIFIER_VERSION } from '@/features/shopping-list/classification/classifier-version';
import type { GoldenCorpusEntry } from './category-golden-corpus';
import { evaluateDump } from './evaluate-categories-core';

describe('evaluateDump', () => {
  it('zählt Kategorieverteilung und Sonstiges-Anteil korrekt', () => {
    const report = evaluateDump(
      [
        { barcode: '1', name: 'Apfel' }, // produce
        { barcode: '2', name: 'Brötchen' }, // bakery
        { barcode: '3', name: 'Restposten XY' }, // Sonstiges (kein Signal)
      ],
      [],
    );

    expect(report.classifierVersion).toBe(CLASSIFIER_VERSION);
    expect(report.totalProducts).toBe(3);
    expect(report.categoryDistribution.produce).toBe(1);
    expect(report.categoryDistribution.bakery).toBe(1);
    expect(report.sonstigesCount).toBe(1);
    expect(report.sonstigesShare).toBeCloseTo(1 / 3);
  });

  it('zählt off_taxonomy- und name_fallback-Quellen getrennt', () => {
    const report = evaluateDump(
      [
        { barcode: '1', name: 'Schnitzel', categoryTags: ['en:porks'] }, // off_taxonomy
        { barcode: '2', name: 'Vollmilch' }, // name_fallback
        { barcode: '3', name: 'Restposten XY' }, // keins
      ],
      [],
    );

    expect(report.sourceCounts).toEqual({ off_taxonomy: 1, name_fallback: 1, none: 1 });
  });

  it('liefert je Kategorie deterministische Stichproben mit konfigurierbarem Limit', () => {
    const manyApples = Array.from({ length: 1200 }, (_, i) => ({
      barcode: `apple-${i}`,
      name: 'Apfel',
    }));

    const defaultRun = evaluateDump(manyApples, []);
    const secondDefaultRun = evaluateDump(manyApples, []);
    const customRun = evaluateDump(manyApples, [], 50);

    expect(defaultRun.samples.produce).toHaveLength(1000);
    expect(defaultRun.samples.produce).toEqual(secondDefaultRun.samples.produce);
    expect(customRun.samples.produce).toHaveLength(50);
  });

  it('markiert Golden-Korpus-Einträge, deren tatsächliche Kategorie vom Soll abweicht', () => {
    const golden: GoldenCorpusEntry[] = [
      { name: 'Apfel', expected: 'produce' },
      { name: 'Wein', expected: 'produce', note: 'absichtlich falsch fürs Testen' },
    ];

    const report = evaluateDump([], golden);

    expect(report.golden.total).toBe(2);
    expect(report.golden.passedCount).toBe(1);
    expect(report.golden.failed).toEqual([
      expect.objectContaining({ name: 'Wein', expected: 'produce', actual: 'beverages' }),
    ]);
  });
});
