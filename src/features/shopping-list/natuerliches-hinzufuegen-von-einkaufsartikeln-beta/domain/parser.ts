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
  zwölf: 12,
  zweihundert: 200,
  fünfhundert: 500,
};

const UNIT_ALIASES: Readonly<Record<string, string>> = {
  g: 'g',
  gramm: 'g',
  gram: 'g',
  kg: 'kg',
  kilogramm: 'kg',
  kilo: 'kg',
  ml: 'ml',
  milliliter: 'ml',
  l: 'l',
  liter: 'l',
  litre: 'l',
  stk: 'stück',
  'stk.': 'stück',
  stück: 'stück',
  stueck: 'stück',
  becher: 'stück',
  knolle: 'stück',
  knollen: 'stück',
  glas: 'stück',
  gläser: 'stück',
  glaeser: 'stück',
  flasche: 'stück',
  flaschen: 'stück',
  dose: 'stück',
  dosen: 'stück',
  packung: 'packung',
  packungen: 'packung',
  paket: 'packung',
  pakete: 'packung',
  pkg: 'packung',
  portion: 'portion',
};

const SPEECH_NAME_ALIASES: Readonly<Record<string, string>> = {
  'salat kopf': 'Salatkopf',
};
const TRAILING_SPEECH_COMMAND =
  /\s+(?:(?:zur|auf\s+die)\s+einkaufsliste(?:\s+(?:hinzu|hinzufügen))?|hinzu(?:fügen)?|hinzufügen|mit|kaufen)$/iu;

const LETTER = /[\p{L}]/u;

type ParsedQuantity = { quantity: number; remainder: string };

const UNIT_PERIOD_PLACEHOLDER = '\u0000';
const ABBREVIATION_PERIOD_PLACEHOLDER = '\u0001';
const FIRST_QUANTITY_START =
  /(?:\d+(?:[.,]\d+)?(?:\s*[x×])?|ein(?:e|en)?|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|zwölf|zweihundert|fünfhundert)\s+/iu;
const LEADING_SPEECH_ACTION =
  /\b(?:bitte|brauche|brauch|möchte|moechte|füge|fuege|setze|bring|bringe|kauf|kaufe|erledige|nimm|nehme|einkauf|einkaufen|kannst|will)\b/iu;
const QUANTITY_BOUNDARY =
  /(?<=[\p{L}\p{N}])\s+(?=(?:\d+(?:[.,]\d+)?(?:\s*[x×])?|ein(?:e|en)?|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|zwölf|zweihundert|fünfhundert)\s+)/giu;

function stripLeadingSpeechContext(input: string): string {
  const firstQuantity = input.match(FIRST_QUANTITY_START);
  if (!firstQuantity || firstQuantity.index === undefined || firstQuantity.index === 0) {
    return input;
  }

  const context = input.slice(0, firstQuantity.index);
  return LEADING_SPEECH_ACTION.test(context) ? input.slice(firstQuantity.index).trim() : input;
}

function splitIntoSegments(input: string): string[] {
  const protectedInput = input
    .replace(/\bz\s*\.\s*b\./giu, (match) => match.replaceAll('.', ABBREVIATION_PERIOD_PLACEHOLDER))
    .replace(/\bstk\./giu, (match) => `${match.slice(0, -1)}${UNIT_PERIOD_PLACEHOLDER}`);

  return protectedInput
    .replace(QUANTITY_BOUNDARY, ', ')
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

function normalizeSpeechName(input: string): string {
  const normalized = input.replace(/\s+/g, ' ').trim().replace(TRAILING_SPEECH_COMMAND, '');
  return SPEECH_NAME_ALIASES[normalized.toLocaleLowerCase('de-DE')] ?? normalized;
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
  const unit = rawUnit && UNIT_ALIASES[rawUnit] ? normalizeUnit(UNIT_ALIASES[rawUnit]) : null;
  const rawName = unit ? unitMatch?.[2] : remainder;
  const name = rawName ? normalizeSpeechName(rawName) : rawName;

  if (!name || !LETTER.test(name)) return null;

  return { name, quantity, unit, brand };
}

export function parseNaturalLanguageShoppingInput(input: string): ParseResult {
  const normalizedInput = stripLeadingSpeechContext(input.normalize('NFC').trim());
  const segments = splitIntoSegments(normalizedInput);

  const items: ParsedShoppingItem[] = [];
  const unparsed: string[] = [];

  for (const segment of segments) {
    const item = parseSegment(segment);
    if (item) items.push(item);
    else unparsed.push(segment);
  }

  const unparsedText = unparsed.length > 0 ? unparsed.join(', ') : null;

  return {
    items,
    unparsedText,
    qualityFlags: unparsedText === null ? [] : ['unparsed_text_present'],
  };
}
