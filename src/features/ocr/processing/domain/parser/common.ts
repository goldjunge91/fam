import {
  assertEuroCents,
  type EuroCents,
  type ReceiptDraftExcludedLineReason,
  type ReceiptDraftField,
  type ReceiptDraftItem,
} from '../types';
import { emptyField, field, type MoneyToken, type NormalizedLine, scaleConfidence } from './input';

type TotalCandidate = {
  priority: number;
  line: NormalizedLine;
  token: MoneyToken;
};

const MONEY_PATTERN =
  /(?<![\d.])(?:€|EUR)?\s*[-−+]?(?:(?:\d{1,3}(?:\.\d{3})+,\d{2})|(?:\d+\s*[,.]\s*\d{2}))(?![\d.])/g;
const DATE_PATTERN = /\b(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})\b/;
export const FINAL_TOTAL_PATTERN =
  /\b(?:gesamt(?:summe|betrag)?|summe|zu\s+zahlen|zahlbetrag|endbetrag|rechnungsbetrag|total)\b/i;
const ITEM_SECTION_END_PATTERN =
  /\b(?:zwischensumme|sie\s+haben\s+insgesamt|gesamt(?:summe|betrag)?|summe|zu\s+zahlen|zahlbetrag|endbetrag|rechnungsbetrag|total)\b/i;
const SUBTOTAL_LABEL_PATTERN = /\bzwischensumme\b/i;
const TOTAL_LABELS = [
  {
    pattern: /\b(?:zu\s+zahlen|zahlbetrag|endbetrag|rechnungsbetrag)\b/i,
    priority: 4,
    take: 'last',
  },
  { pattern: /\bgesamt(?:summe|betrag)?\b/i, priority: 4, take: 'last' },
  { pattern: /\bsumme\b/i, priority: 3, take: 'first' },
  { pattern: /\btotal\b/i, priority: 2, take: 'last' },
] as const;
const SAVINGS_LINE_PATTERN = /\b(?:gespart|rabatt|nachlass|coupon|gutschein)\b/i;
const ADDRESS_OR_RECEIPT_METADATA_PATTERN =
  /(?:straße|str\.?|weg|platz|filiale|markt|frischecenter|tel\.?|telefon|www\.|http|bon(?:-?nr)?|beleg(?:-?nr)?|kasse|kd\s*nr|kunden(?:nummer|nr)|zwischensumme|subtotal|posten|duplikat|eur|öffnungszeiten|umtausch|rückzahlung|kassenbon|kartenkonto|steuerreferenz|filialfinder|ust\s*-?\s*id|gmbh|hamburg|wandsbeker)\b/i;
const BARCODE_TOKEN_SEARCH_PATTERN = /\b\d{8,14}\b/;
const TAX_RATE_ROW_PATTERN = /^\s*(?:A|B|AW|BW)\s+\d{1,2}\s*%\b/i;
const TAX_CODE_ONLY_PATTERN = /^(?:A|B|AW|BW)(?:\s+\d{1,2}\s*%)?$/i;
export function parseMoneyTokens(text: string): readonly MoneyToken[] {
  return [...text.matchAll(MONEY_PATTERN)].flatMap((match) => {
    const raw = match[0];
    const unsigned = raw.replace(/^(?:€|EUR)\s*/i, '').replace(/\s*(?:€|EUR)$/i, '');
    const negative = /^[-−]/.test(unsigned);
    const compactUnsigned = unsigned.replace(/\s+/g, '');
    const numberText = compactUnsigned.replace(/^[-−+]/, '').includes(',')
      ? compactUnsigned
          .replace(/^[-−+]/, '')
          .replace(/\./g, '')
          .replace(',', '.')
      : compactUnsigned.replace(/^[-−+]/, '');
    const [whole = '0', fraction = '0'] = numberText.split('.');
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));

    if (!Number.isSafeInteger(cents)) {
      return [];
    }

    const start = match.index ?? 0;
    return [
      {
        cents,
        negative,
        start,
        end: start + raw.length,
      },
    ];
  });
}
export function parseDate(text: string): string | null {
  const match = text.match(DATE_PATTERN);
  if (!match) {
    return null;
  }

  const [, first, second, third] = match;
  const isIso = first.length === 4;
  const year = Number(isIso ? first : third);
  const month = Number(isIso ? second : second);
  const day = Number(isIso ? third : first);
  const normalizedYear = year < 100 ? 2000 + year : year;
  const date = new Date(Date.UTC(normalizedYear, month - 1, day));

  if (
    date.getUTCFullYear() !== normalizedYear ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(normalizedYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
    day,
  ).padStart(2, '0')}`;
}

export function findDate(lines: readonly NormalizedLine[]): ReceiptDraftField<string> {
  for (const line of lines) {
    const value = parseDate(line.text);
    if (value !== null) {
      return field(value, scaleConfidence(line.confidence, 0.98), line.index, line.text);
    }
  }
  return emptyField();
}

export function findSubtotalCents(lines: readonly NormalizedLine[]): number | null {
  for (const line of lines) {
    if (!SUBTOTAL_LABEL_PATTERN.test(line.text) || BARCODE_TOKEN_SEARCH_PATTERN.test(line.text)) {
      continue;
    }
    const tokens = parseMoneyTokens(line.text).filter(({ negative }) => !negative);
    if (tokens.length === 1) return tokens[0]?.cents ?? null;
  }
  return null;
}

export function findTotal(lines: readonly NormalizedLine[]): ReceiptDraftField<EuroCents> {
  const candidates: TotalCandidate[] = [];
  const subtotalCents = findSubtotalCents(lines);

  for (const line of lines) {
    if (SAVINGS_LINE_PATTERN.test(line.text)) continue;

    for (const label of TOTAL_LABELS) {
      const labelMatch = line.text.match(label.pattern);
      if (!labelMatch) continue;

      const tokens = parseMoneyTokens(line.text).filter(({ negative }) => !negative);
      const labelEnd = (labelMatch.index ?? 0) + labelMatch[0].length;
      const token =
        label.take === 'first'
          ? (tokens.find(({ start }) => start >= labelEnd) ?? tokens[0])
          : tokens.at(-1);
      if (!token) continue;

      candidates.push({ priority: label.priority, line, token });
    }
  }

  const candidate = candidates
    .filter(({ token }) => subtotalCents === null || token.cents <= subtotalCents)
    .sort((left, right) => left.priority - right.priority || left.line.index - right.line.index)
    .at(-1);
  if (!candidate) return emptyField();

  return field(
    assertEuroCents(candidate.token.cents),
    scaleConfidence(candidate.line.confidence, 0.98),
    candidate.line.index,
    candidate.line.text,
  );
}

function clearInconsistentObservedAmount<T>(source: ReceiptDraftField<T>): ReceiptDraftField<T> {
  return {
    ...source,
    value: null,
    confidence: null,
    needsReview: true,
  };
}

/**
 * Upper amount bound for a single article line.
 *
 * The printed item total can never exceed the subtotal. Without a readable
 * subtotal the paid total takes over, but only while no discount or coupon
 * line exists: those lower the paid total below the article sum, so the total
 * would reject correct article amounts. With such a line present we have no
 * reliable bound and keep every observed amount.
 */
export function amountCeilingCents(
  lines: readonly NormalizedLine[],
  subtotalCents: number | null,
  totalCents: number | null,
): number | null {
  if (subtotalCents !== null) return subtotalCents;
  if (totalCents === null) return null;
  return lines.some(({ text }) => SAVINGS_LINE_PATTERN.test(text)) ? null : totalCents;
}

export function filterAmountsAboveCeiling(
  items: readonly ReceiptDraftItem[],
  ceilingCents: number | null,
): readonly ReceiptDraftItem[] {
  if (ceilingCents === null) return items;

  return items.map((item) => ({
    ...item,
    lineTotalCents:
      item.lineTotalCents.value !== null && item.lineTotalCents.value > ceilingCents
        ? clearInconsistentObservedAmount(item.lineTotalCents)
        : item.lineTotalCents,
    unitPriceCents:
      item.unitPriceCents !== null &&
      item.unitPriceCents.value !== null &&
      item.unitPriceCents.value > ceilingCents
        ? clearInconsistentObservedAmount(item.unitPriceCents)
        : item.unitPriceCents,
    needsReview:
      item.needsReview ||
      (item.lineTotalCents.value !== null && item.lineTotalCents.value > ceilingCents) ||
      (item.unitPriceCents !== null &&
        item.unitPriceCents.value !== null &&
        item.unitPriceCents.value > ceilingCents),
  }));
}
export function classifyExcludedLine(text: string): ReceiptDraftExcludedLineReason | null {
  const lowerText = text.toLowerCase();
  const barcodeText = lowerText.replace(/[\s-]/g, '');
  if (/^(?:barcode|ean|gtin):?\d{8,14}$/.test(barcodeText) || /^\d{8,14}$/.test(barcodeText)) {
    return 'barcode';
  }
  if (/\b(?:unterschrift|signatur|signature)\b/.test(lowerText)) {
    return 'signature';
  }
  if (/\b(?:coupon|gutschein)\b/.test(lowerText)) {
    return 'coupon';
  }
  if (
    /\b(?:rabatt|nachlass|preisnachlass|discount|gespart|sie\s+haben\s+insgesamt)\b/.test(lowerText)
  ) {
    return 'discount';
  }
  if (/\b(?:pfand|deposit)\b/.test(lowerText)) {
    return 'deposit';
  }
  if (/\b(?:mwst|ust|mehrwertsteuer|umsatzsteuer|vat|steuer)\b/.test(lowerText)) {
    return 'tax';
  }
  if (TAX_RATE_ROW_PATTERN.test(text)) {
    return 'tax';
  }
  if (/\b(?:treuekarte|kundenkarte|bonus|punkte)\b/.test(lowerText)) {
    return 'loyalty';
  }
  if (
    /\b(?:ec|girocard|kreditkarte|visa|mastercard|barzahlung|zahlung|bezahlt|rückgeld|wechselgeld)\b/.test(
      lowerText,
    )
  ) {
    return 'payment';
  }
  return null;
}

export function isMetadataLine(text: string): boolean {
  return parseDate(text) !== null || ADDRESS_OR_RECEIPT_METADATA_PATTERN.test(text);
}

export function isItemSectionEndLine(text: string): boolean {
  return ITEM_SECTION_END_PATTERN.test(text) && !BARCODE_TOKEN_SEARCH_PATTERN.test(text);
}

export function isTaxCodeOnlyName(name: string): boolean {
  return TAX_CODE_ONLY_PATTERN.test(name.trim());
}
