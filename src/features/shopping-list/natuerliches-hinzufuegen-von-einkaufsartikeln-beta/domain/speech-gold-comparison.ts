import type { ParsedShoppingItem } from '../types';
import type { SpeechGoldLabel, SpeechGoldLabelItem } from './speech-gold-contract';

export type SpeechGoldMismatchField = 'quantity' | 'unit' | 'brand';

export type SpeechGoldMismatchedItem = Readonly<{
  expected: SpeechGoldLabelItem;
  actual: ParsedShoppingItem;
  fields: readonly SpeechGoldMismatchField[];
}>;

export type SpeechGoldComparison = Readonly<{
  schemaVersion: 1;
  comparisonKind: 'speech-gold-label';
  audio: string;
  referenceLine: number;
  expectedItemCount: number;
  actualItemCount: number;
  nameMatchedItemCount: number;
  matchedItemCount: number;
  missing: readonly SpeechGoldLabelItem[];
  unexpected: readonly ParsedShoppingItem[];
  mismatched: readonly SpeechGoldMismatchedItem[];
  expectedUnparsedText: string | null;
  actualUnparsedText: string | null;
  unparsedTextMatch: boolean;
  exactMatch: boolean;
}>;

export type SpeechGoldRate = Readonly<{
  numerator: number;
  denominator: number;
  value: number | null;
}>;

export type SpeechGoldAggregate = Readonly<{
  fixtureCount: number;
  completedFixtureCount: number;
  exactMatchFixtureCount: number;
  expectedItemCount: number;
  actualItemCount: number;
  nameMatchedItemCount: number;
  matchedItemCount: number;
  missingItemCount: number;
  unexpectedItemCount: number;
  quantityMismatchCount: number;
  unitMismatchCount: number;
  brandMismatchCount: number;
  unparsedTextMismatchCount: number;
  rates: Readonly<{
    completion: SpeechGoldRate;
    exactMatch: SpeechGoldRate;
    itemMatch: SpeechGoldRate;
    missingItem: SpeechGoldRate;
    unexpectedItem: SpeechGoldRate;
    quantityMismatch: SpeechGoldRate;
    unitMismatch: SpeechGoldRate;
    brandMismatch: SpeechGoldRate;
    unparsedTextMismatch: SpeechGoldRate;
  }>;
}>;

type ActualSpeechResult = Readonly<{
  items: readonly ParsedShoppingItem[];
  unparsedText: string | null;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('de-DE');
}

function validateOptionalText(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string or null`);
  }
  return value;
}

function validateItem(value: unknown, field: string): ParsedShoppingItem {
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    throw new Error(`${field}.name must be a non-empty string`);
  }
  if (
    typeof value.quantity !== 'number' ||
    !Number.isFinite(value.quantity) ||
    value.quantity <= 0
  ) {
    throw new Error(`${field}.quantity must be a positive finite number`);
  }

  return {
    name: value.name,
    quantity: value.quantity,
    unit: validateOptionalText(value.unit, `${field}.unit`),
    brand: validateOptionalText(value.brand, `${field}.brand`),
  };
}

function validateExpectedLabel(label: SpeechGoldLabel): void {
  if (!isRecord(label)) throw new Error('expected must be a Goldlabel object');
  if (!Array.isArray(label.items) || label.items.length === 0) {
    throw new Error('expected.items must contain at least one item');
  }
  label.items.forEach((item, index) => {
    validateItem(item, `expected.items[${index}]`);
  });
  validateOptionalText(label.expectedUnparsedText, 'expected.expectedUnparsedText');
}

function validateActualResult(value: ActualSpeechResult): ActualSpeechResult {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error('actual.items must be an array');
  }
  const items = value.items.map((item, index) => validateItem(item, `actual.items[${index}]`));
  const unparsedText = validateOptionalText(value.unparsedText, 'actual.unparsedText');
  return { items, unparsedText };
}

function sameOptionalText(left: string | null, right: string | null): boolean {
  if (left === null || right === null) return left === right;
  return normalizeText(left) === normalizeText(right);
}

function mismatchFields(
  expected: SpeechGoldLabelItem,
  actual: ParsedShoppingItem,
): SpeechGoldMismatchField[] {
  const fields: SpeechGoldMismatchField[] = [];
  if (expected.quantity !== actual.quantity) fields.push('quantity');
  if (!sameOptionalText(expected.unit, actual.unit)) fields.push('unit');
  if (!sameOptionalText(expected.brand, actual.brand)) fields.push('brand');
  return fields;
}

function findUnusedMatchingName(
  expected: SpeechGoldLabelItem,
  actual: readonly ParsedShoppingItem[],
  used: readonly boolean[],
): number {
  const expectedName = normalizeText(expected.name);
  return actual.findIndex(
    (candidate, index) => !used[index] && normalizeText(candidate.name) === expectedName,
  );
}

function findUnusedExactMatch(
  expected: SpeechGoldLabelItem,
  actual: readonly ParsedShoppingItem[],
  used: readonly boolean[],
): number {
  const expectedName = normalizeText(expected.name);
  return actual.findIndex(
    (candidate, index) =>
      !used[index] &&
      normalizeText(candidate.name) === expectedName &&
      mismatchFields(expected, candidate).length === 0,
  );
}

/** Compares one independently validated gold label against one speech result. */
export function compareSpeechGoldLabel(
  expected: SpeechGoldLabel,
  actualInput: ActualSpeechResult,
): SpeechGoldComparison {
  validateExpectedLabel(expected);
  const actual = validateActualResult(actualInput);
  const usedActual = actual.items.map(() => false);
  const missing: SpeechGoldLabelItem[] = [];
  const mismatched: SpeechGoldMismatchedItem[] = [];
  let matchedItemCount = 0;
  let nameMatchedItemCount = 0;

  for (const expectedItem of expected.items) {
    const exactIndex = findUnusedExactMatch(expectedItem, actual.items, usedActual);
    const index =
      exactIndex >= 0 ? exactIndex : findUnusedMatchingName(expectedItem, actual.items, usedActual);
    if (index < 0) {
      missing.push(expectedItem);
      continue;
    }

    usedActual[index] = true;
    nameMatchedItemCount += 1;
    const actualItem = actual.items[index];
    const fields = mismatchFields(expectedItem, actualItem);
    if (fields.length === 0) matchedItemCount += 1;
    else mismatched.push({ expected: expectedItem, actual: actualItem, fields });
  }

  const unexpected = actual.items.filter((_, index) => !usedActual[index]);
  const expectedUnparsedText = expected.expectedUnparsedText;
  const unparsedTextMatch = sameOptionalText(expectedUnparsedText, actual.unparsedText);

  return {
    schemaVersion: 1,
    comparisonKind: 'speech-gold-label',
    audio: expected.audio,
    referenceLine: expected.referenceLine,
    expectedItemCount: expected.items.length,
    actualItemCount: actual.items.length,
    nameMatchedItemCount,
    matchedItemCount,
    missing,
    unexpected,
    mismatched,
    expectedUnparsedText,
    actualUnparsedText: actual.unparsedText,
    unparsedTextMatch,
    exactMatch:
      missing.length === 0 &&
      unexpected.length === 0 &&
      mismatched.length === 0 &&
      unparsedTextMatch,
  };
}

function makeRate(numerator: number, denominator: number): SpeechGoldRate {
  return {
    numerator,
    denominator,
    value: denominator === 0 ? null : (numerator / denominator) * 100,
  };
}

function incrementFieldCounts(
  mismatched: readonly SpeechGoldMismatchedItem[],
): Pick<SpeechGoldAggregate, 'quantityMismatchCount' | 'unitMismatchCount' | 'brandMismatchCount'> {
  return mismatched.reduce(
    (counts, item) => {
      if (item.fields.includes('quantity')) counts.quantityMismatchCount += 1;
      if (item.fields.includes('unit')) counts.unitMismatchCount += 1;
      if (item.fields.includes('brand')) counts.brandMismatchCount += 1;
      return counts;
    },
    { quantityMismatchCount: 0, unitMismatchCount: 0, brandMismatchCount: 0 },
  );
}

/** Aggregates only completed, already compared fixtures. */
export function aggregateSpeechGoldComparisons(
  comparisons: readonly SpeechGoldComparison[],
  options: Readonly<{ fixtureCount: number }>,
): SpeechGoldAggregate {
  if (!Number.isInteger(options.fixtureCount) || options.fixtureCount < 0) {
    throw new Error('fixtureCount must be a non-negative integer');
  }
  if (comparisons.length > options.fixtureCount) {
    throw new Error('fixtureCount cannot be smaller than completed fixture count');
  }

  const totals = comparisons.reduce(
    (aggregate, comparison) => {
      const fieldCounts = incrementFieldCounts(comparison.mismatched);
      aggregate.expectedItemCount += comparison.expectedItemCount;
      aggregate.actualItemCount += comparison.actualItemCount;
      aggregate.nameMatchedItemCount += comparison.nameMatchedItemCount;
      aggregate.matchedItemCount += comparison.matchedItemCount;
      aggregate.missingItemCount += comparison.missing.length;
      aggregate.unexpectedItemCount += comparison.unexpected.length;
      aggregate.quantityMismatchCount += fieldCounts.quantityMismatchCount;
      aggregate.unitMismatchCount += fieldCounts.unitMismatchCount;
      aggregate.brandMismatchCount += fieldCounts.brandMismatchCount;
      aggregate.unparsedTextMismatchCount += comparison.unparsedTextMatch ? 0 : 1;
      aggregate.exactMatchFixtureCount += comparison.exactMatch ? 1 : 0;
      return aggregate;
    },
    {
      expectedItemCount: 0,
      actualItemCount: 0,
      nameMatchedItemCount: 0,
      matchedItemCount: 0,
      missingItemCount: 0,
      unexpectedItemCount: 0,
      quantityMismatchCount: 0,
      unitMismatchCount: 0,
      brandMismatchCount: 0,
      unparsedTextMismatchCount: 0,
      exactMatchFixtureCount: 0,
    },
  );

  const completedFixtureCount = comparisons.length;
  return {
    fixtureCount: options.fixtureCount,
    completedFixtureCount,
    ...totals,
    rates: {
      completion: makeRate(completedFixtureCount, options.fixtureCount),
      exactMatch: makeRate(totals.exactMatchFixtureCount, completedFixtureCount),
      itemMatch: makeRate(totals.matchedItemCount, totals.expectedItemCount),
      missingItem: makeRate(totals.missingItemCount, totals.expectedItemCount),
      unexpectedItem: makeRate(totals.unexpectedItemCount, totals.actualItemCount),
      quantityMismatch: makeRate(totals.quantityMismatchCount, totals.nameMatchedItemCount),
      unitMismatch: makeRate(totals.unitMismatchCount, totals.nameMatchedItemCount),
      brandMismatch: makeRate(totals.brandMismatchCount, totals.nameMatchedItemCount),
      unparsedTextMismatch: makeRate(totals.unparsedTextMismatchCount, completedFixtureCount),
    },
  };
}
