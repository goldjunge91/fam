import type { ParsedShoppingItem } from '../types';
import { aggregateSpeechGoldComparisons, compareSpeechGoldLabel } from './speech-gold-comparison';
import type { SpeechGoldLabel } from './speech-gold-contract';

function item(name: string, overrides: Partial<ParsedShoppingItem> = {}): ParsedShoppingItem {
  return {
    name,
    quantity: 1,
    unit: null,
    brand: null,
    ...overrides,
  };
}

function label(
  items: readonly SpeechGoldLabel['items'][number][],
  overrides: Partial<SpeechGoldLabel> = {},
): SpeechGoldLabel {
  return {
    schemaVersion: 1,
    fixtureSetVersion: '20-saetze-neu-gold-v1',
    audio: 'satz-01.wav',
    referenceFile: '20-einkaufslisten-saetze.txt',
    referenceLine: 1,
    targetListId: null,
    mentionedMarket: null,
    expectedUnparsedText: null,
    items,
    ...overrides,
  };
}

function actual(
  items: readonly ParsedShoppingItem[],
  unparsedText: string | null = null,
): { items: readonly ParsedShoppingItem[]; unparsedText: string | null } {
  return { items, unparsedText };
}

describe('compareSpeechGoldLabel', () => {
  it('matches names with NFC, trimmed, collapsed whitespace and case-insensitive normalization', () => {
    const result = compareSpeechGoldLabel(
      label([item('A\u0308pfel')]),
      actual([item('  äPFEL  ')]),
    );

    expect(result).toMatchObject({
      matchedItemCount: 1,
      missing: [],
      unexpected: [],
      mismatched: [],
      exactMatch: true,
    });
  });

  it('compares names as a multiset and keeps missing, unexpected and mismatched separate', () => {
    const result = compareSpeechGoldLabel(
      label([item('Milch'), item('Brot', { quantity: 2 }), item('Butter', { brand: 'Bio' })]),
      actual([item(' milch ', { quantity: 2 }), item('butter'), item('Eier')]),
    );

    expect(result).toMatchObject({
      expectedItemCount: 3,
      actualItemCount: 3,
      matchedItemCount: 0,
      missing: [item('Brot', { quantity: 2 })],
      unexpected: [item('Eier')],
      mismatched: [
        {
          expected: item('Milch'),
          actual: item(' milch ', { quantity: 2 }),
          fields: ['quantity'],
        },
        {
          expected: item('Butter', { brand: 'Bio' }),
          actual: item('butter'),
          fields: ['brand'],
        },
      ],
      exactMatch: false,
    });
  });

  it('reports every differing field for a name-matched item in stable order', () => {
    const result = compareSpeechGoldLabel(
      label([item('Käse', { quantity: 200, unit: 'g', brand: 'Marke A' })]),
      actual([item('Käse', { quantity: 1, unit: 'kg', brand: 'Marke B' })]),
    );

    expect(result.mismatched[0]?.fields).toEqual(['quantity', 'unit', 'brand']);
  });

  it('compares expected and actual unparsed text independently from item matching', () => {
    const result = compareSpeechGoldLabel(
      label([item('Milch')], { expectedUnparsedText: 'Rest' }),
      actual([item('Milch')], null),
    );

    expect(result).toMatchObject({
      expectedUnparsedText: 'Rest',
      actualUnparsedText: null,
      unparsedTextMatch: false,
      exactMatch: false,
    });
  });

  it('preserves duplicate names as separate multiset occurrences', () => {
    const result = compareSpeechGoldLabel(
      label([item('Apfel'), item('Apfel')]),
      actual([item('Apfel')]),
    );

    expect(result.missing).toEqual([item('Apfel')]);
    expect(result.matchedItemCount).toBe(1);
  });

  it('fails closed for malformed parsed input', () => {
    expect(() =>
      compareSpeechGoldLabel(
        label([item('Milch')]),
        actual([item('Milch', { quantity: Number.NaN })]),
      ),
    ).toThrow('actual.items[0].quantity');
  });
});

describe('aggregateSpeechGoldComparisons', () => {
  it('aggregates counters and rates with explicit denominators', () => {
    const exact = compareSpeechGoldLabel(label([item('Milch')]), actual([item('Milch')]));
    const mismatch = compareSpeechGoldLabel(
      label([item('Käse', { quantity: 200, unit: 'g' }), item('Brot')]),
      actual([item('Käse', { quantity: 1, unit: 'kg' }), item('Eier')], 'Rest'),
    );

    const result = aggregateSpeechGoldComparisons([exact, mismatch], { fixtureCount: 4 });

    expect(result).toMatchObject({
      fixtureCount: 4,
      completedFixtureCount: 2,
      exactMatchFixtureCount: 1,
      expectedItemCount: 3,
      actualItemCount: 3,
      nameMatchedItemCount: 2,
      matchedItemCount: 1,
      missingItemCount: 1,
      unexpectedItemCount: 1,
      quantityMismatchCount: 1,
      unitMismatchCount: 1,
      brandMismatchCount: 0,
      unparsedTextMismatchCount: 1,
    });
    expect(result.rates).toEqual({
      completion: { numerator: 2, denominator: 4, value: 50 },
      exactMatch: { numerator: 1, denominator: 2, value: 50 },
      itemMatch: { numerator: 1, denominator: 3, value: 33.33333333333333 },
      missingItem: { numerator: 1, denominator: 3, value: 33.33333333333333 },
      unexpectedItem: { numerator: 1, denominator: 3, value: 33.33333333333333 },
      quantityMismatch: { numerator: 1, denominator: 2, value: 50 },
      unitMismatch: { numerator: 1, denominator: 2, value: 50 },
      brandMismatch: { numerator: 0, denominator: 2, value: 0 },
      unparsedTextMismatch: { numerator: 1, denominator: 2, value: 50 },
    });
  });

  it('returns null rates instead of inventing a value for a zero denominator', () => {
    const result = aggregateSpeechGoldComparisons([], { fixtureCount: 2 });

    expect(result.rates).toMatchObject({
      completion: { numerator: 0, denominator: 2, value: 0 },
      exactMatch: { numerator: 0, denominator: 0, value: null },
      itemMatch: { numerator: 0, denominator: 0, value: null },
      missingItem: { numerator: 0, denominator: 0, value: null },
      unexpectedItem: { numerator: 0, denominator: 0, value: null },
      quantityMismatch: { numerator: 0, denominator: 0, value: null },
      unitMismatch: { numerator: 0, denominator: 0, value: null },
      brandMismatch: { numerator: 0, denominator: 0, value: null },
      unparsedTextMismatch: { numerator: 0, denominator: 0, value: null },
    });
  });

  it('fails closed when the completed fixture count exceeds the declared fixture count', () => {
    const comparison = compareSpeechGoldLabel(label([item('Milch')]), actual([item('Milch')]));

    expect(() => aggregateSpeechGoldComparisons([comparison], { fixtureCount: 0 })).toThrow(
      'fixtureCount',
    );
  });
});
