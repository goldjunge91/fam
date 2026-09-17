import { normalizeUnit } from '@/lib/units';

import type { ParsedShoppingItem, ParseResult } from '../types';

const WORD_QUANTITIES: Readonly<Record<string, number>> = {
  ein: 1,
  eine: 1,
  einen: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
};

const UNIT_ALIASES = new Set([
  'g',
  'gramm',
  'gram',
  'kg',
  'kilogramm',
  'kilo',
  'ml',
  'milliliter',
  'l',
  'liter',
  'litre',
  'stk',
  'stk.',
  'stück',
  'stueck',
  'packung',
  'pkg',
  'portion',
]);

const LETTER = /[\p{L}]/u;

type ParsedQuantity = { quantity: number; remainder: string };

const UNIT_PERIOD_PLACEHOLDER = '\u0000';
const ABBREVIATION_PERIOD_PLACEHOLDER = '\u0001';

function splitIntoSegments(input: string): string[] {
  const protectedInput = input
    .replace(/\bz\s*\.\s*b\./giu, (match) => match.replaceAll('.', ABBREVIATION_PERIOD_PLACEHOLDER))
    .replace(/\bstk\./giu, (match) => `${match.slice(0, -1)}${UNIT_PERIOD_PLACEHOLDER}`);

  return protectedInput
    .split(/\s*(?:[,;\n]|\bund\b|(?<=[\p{L}\p{N}])[.!?])\s*/iu)
    .map((segment) =>
      segment
        .replaceAll(UNIT_PERIOD_PLACEHOLDER, '.')
        .replaceAll(ABBREVIATION_PERIOD_PLACEHOLDER, '.')
        .trim(),
    )
    .filter(Boolean);
}

function parseQuantity(input: string): ParsedQuantity {
  const numericMatch = input.match(/^(\d+(?:[.,]\d+)?)\s*(?:x|×)?\s+(.+)$/iu);
  if (numericMatch) {
    return {
      quantity: Number.parseFloat(numericMatch[1].replace(',', '.')),
      remainder: numericMatch[2],
    };
  }

  const wordMatch = input.match(/^([\p{L}]+)\s+(.+)$/u);
  const quantity = wordMatch ? WORD_QUANTITIES[wordMatch[1].toLocaleLowerCase('de-DE')] : undefined;
  if (quantity !== undefined && wordMatch) {
    return { quantity, remainder: wordMatch[2] };
  }

  const xMatch = input.match(/^(\d+(?:[.,]\d+)?)\s*(?:x|×)\s*(.+)$/iu);
  if (xMatch) {
    return {
      quantity: Number.parseFloat(xMatch[1].replace(',', '.')),
      remainder: xMatch[2],
    };
  }

  return { quantity: 1, remainder: input };
}

function parseSegment(segment: string): ParsedShoppingItem | null {
  const { quantity, remainder: quantityRemainder } = parseQuantity(segment.trim());
  let remainder = quantityRemainder.trim();
  let brand: string | null = null;

  const suffixBrand = remainder.match(/^(.+?)\s+von\s+(.+)$/iu);
  if (suffixBrand) {
    remainder = suffixBrand[1].trim();
    brand = suffixBrand[2].trim();
  }

  const prefixBrand = remainder.match(/^([A-ZÄÖÜ][A-ZÄÖÜ0-9.&-]{1,})\s+(.+)$/u);
  if (!brand && prefixBrand) {
    brand = prefixBrand[1];
    remainder = prefixBrand[2].trim();
  }

  const unitMatch = remainder.match(/^([^\s]+)\s+(.+)$/u);
  const rawUnit = unitMatch?.[1].toLocaleLowerCase('de-DE');
  const unit = rawUnit && UNIT_ALIASES.has(rawUnit) ? normalizeUnit(rawUnit) : null;
  const name = (unit ? unitMatch?.[2] : remainder)?.replace(/\s+/g, ' ').trim();

  if (!name || !LETTER.test(name)) return null;

  return { name, quantity, unit, brand };
}

export function parseNaturalLanguageShoppingInput(input: string): ParseResult {
  const segments = splitIntoSegments(input.normalize('NFC').trim());

  const items: ParsedShoppingItem[] = [];
  const unparsed: string[] = [];

  for (const segment of segments) {
    const item = parseSegment(segment);
    if (item) items.push(item);
    else unparsed.push(segment);
  }

  return { items, unparsedText: unparsed.length > 0 ? unparsed.join(', ') : null };
}
