import { reconstructReceiptLines } from './layout';
import {
  assertEuroCents,
  type EuroCents,
  RECEIPT_DRAFT_REVIEW_CONFIDENCE,
  type ReceiptConfidence,
  type ReceiptDraft,
  type ReceiptDraftExcludedLine,
  type ReceiptDraftExcludedLineReason,
  type ReceiptDraftField,
  type ReceiptDraftItem,
  type ReceiptDraftWarning,
  type ReceiptOcrLine,
  type ReceiptOcrPage,
} from './types';

type ParserInput = string | readonly ReceiptOcrLine[] | readonly ReceiptOcrPage[];

type NormalizedLine = {
  index: number;
  text: string;
  confidence: ReceiptConfidence;
};

type MoneyToken = {
  cents: number;
  negative: boolean;
  start: number;
  end: number;
};

type ObservedLineTotal = {
  cents: number;
  confidence: ReceiptConfidence;
  evidence: string;
};

type TotalCandidate = {
  priority: number;
  line: NormalizedLine;
  token: MoneyToken;
};

const MONEY_PATTERN =
  /(?<![\d.])(?:€|EUR)?\s*[-−+]?(?:(?:\d{1,3}(?:\.\d{3})+,\d{2})|(?:\d+\s*[,.]\s*\d{2}))(?![\d.])/g;
const DATE_PATTERN = /\b(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})\b/;
const FINAL_TOTAL_PATTERN =
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

const MARKET_ALIASES = [
  { pattern: /\baldi\s*(?:süd|sued)\b/i, value: 'ALDI SÜD' },
  { pattern: /\baldi\s+nord\b/i, value: 'ALDI NORD' },
  { pattern: /\be{1,2}deka\b/i, value: 'EDEKA' },
  { pattern: /\bka[u\u00a0]?fland\b/i, value: 'KAUFLAND' },
  { pattern: /\blidl\b/i, value: 'LIDL' },
  { pattern: /\bnetto\b/i, value: 'NETTO' },
  { pattern: /\bpenny\b/i, value: 'PENNY' },
  { pattern: /\brewe\b/i, value: 'REWE' },
  { pattern: /\brossmann\b/i, value: 'ROSSMANN' },
  { pattern: /\bdm\b/i, value: 'dm' },
] as const;

const ADDRESS_OR_RECEIPT_METADATA_PATTERN =
  /(?:straße|str\.?|weg|platz|filiale|markt|frischecenter|tel\.?|telefon|www\.|http|bon(?:-?nr)?|beleg(?:-?nr)?|kasse|kd\s*nr|kunden(?:nummer|nr)|zwischensumme|subtotal|posten|duplikat|eur|öffnungszeiten|umtausch|rückzahlung|kassenbon|kartenkonto|steuerreferenz|filialfinder|ust\s*-?\s*id|gmbh|hamburg|wandsbeker)\b/i;

const BARCODE_TOKEN_PATTERN = /\b\d{8,14}\b/g;
const BARCODE_TOKEN_SEARCH_PATTERN = /\b\d{8,14}\b/;
const TAX_RATE_ROW_PATTERN = /^\s*(?:A|B|AW|BW)\s+\d{1,2}\s*%\b/i;
const TAX_CODE_ONLY_PATTERN = /^(?:A|B|AW|BW)(?:\s+\d{1,2}\s*%)?$/i;

function normalizeConfidence(value: ReceiptConfidence): ReceiptConfidence {
  if (value === null) {
    return null;
  }
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(1, value));
}

function scaleConfidence(value: ReceiptConfidence, factor: number): ReceiptConfidence {
  return value === null ? null : normalizeConfidence(value * factor);
}

function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitBarcodePrefixedLine(
  line: Omit<NormalizedLine, 'index'>,
): readonly Omit<NormalizedLine, 'index'>[] {
  const matches = [...line.text.matchAll(BARCODE_TOKEN_PATTERN)];
  if (matches.length < 2) {
    return [line];
  }

  const firstMatchIndex = matches[0]?.index;
  if (firstMatchIndex === undefined) {
    return [line];
  }

  const prefix = line.text.slice(0, firstMatchIndex);
  const quantityPrefix = prefix.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*$/i);
  const segments = matches.flatMap((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? line.text.length;
    const barcodeSegment = line.text.slice(start, end).trim();
    const text =
      index === 0 && quantityPrefix ? `${quantityPrefix[1]}X ${barcodeSegment}` : barcodeSegment;
    return text.length > 0 ? [{ text, confidence: line.confidence }] : [];
  });

  return segments.length > 0 ? segments : [line];
}

function normalizeInput(input: ParserInput): readonly NormalizedLine[] {
  const sourceLines =
    typeof input === 'string'
      ? input.split(/\r?\n/).map((text) => ({
          text: normalizeText(text),
          // Plain text has no native provider confidence. Keep it unknown instead
          // of presenting a non-OCR input as a certain recognition result.
          confidence: null,
        }))
      : reconstructReceiptLines(input).map((line) => ({
          text: normalizeText(line.text),
          confidence: normalizeConfidence(line.confidence),
        }));

  return sourceLines.flatMap(splitBarcodePrefixedLine).map((line, index) => ({ ...line, index }));
}

function emptyField<T>(): ReceiptDraftField<T> {
  return {
    value: null,
    confidence: null,
    sourceLineIndex: null,
    evidence: null,
    needsReview: true,
  };
}

function field<T>(
  value: T,
  confidence: ReceiptConfidence,
  sourceLineIndex: number,
  evidence: string,
): ReceiptDraftField<T> {
  const normalizedConfidence = normalizeConfidence(confidence);
  return {
    value,
    confidence: normalizedConfidence,
    sourceLineIndex,
    evidence,
    needsReview:
      normalizedConfidence === null || normalizedConfidence < RECEIPT_DRAFT_REVIEW_CONFIDENCE,
  };
}

function missingField<T>(line: NormalizedLine): ReceiptDraftField<T> {
  return {
    value: null,
    confidence: line.confidence,
    sourceLineIndex: line.index,
    evidence: line.text,
    needsReview: true,
  };
}

function parseMoneyTokens(text: string): readonly MoneyToken[] {
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

function parseDate(text: string): string | null {
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

function findDate(lines: readonly NormalizedLine[]): ReceiptDraftField<string> {
  for (const line of lines) {
    const value = parseDate(line.text);
    if (value !== null) {
      return field(value, scaleConfidence(line.confidence, 0.98), line.index, line.text);
    }
  }
  return emptyField();
}

function findSubtotalCents(lines: readonly NormalizedLine[]): number | null {
  for (const line of lines) {
    if (!SUBTOTAL_LABEL_PATTERN.test(line.text) || BARCODE_TOKEN_SEARCH_PATTERN.test(line.text)) {
      continue;
    }
    const tokens = parseMoneyTokens(line.text).filter(({ negative }) => !negative);
    if (tokens.length === 1) return tokens[0]?.cents ?? null;
  }
  return null;
}

function findTotal(lines: readonly NormalizedLine[]): ReceiptDraftField<EuroCents> {
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

function filterAmountsAboveSubtotal(
  items: readonly ReceiptDraftItem[],
  subtotalCents: number | null,
): readonly ReceiptDraftItem[] {
  if (subtotalCents === null) return items;

  return items.map((item) => ({
    ...item,
    lineTotalCents:
      item.lineTotalCents.value !== null && item.lineTotalCents.value > subtotalCents
        ? clearInconsistentObservedAmount(item.lineTotalCents)
        : item.lineTotalCents,
    unitPriceCents:
      item.unitPriceCents !== null &&
      item.unitPriceCents.value !== null &&
      item.unitPriceCents.value > subtotalCents
        ? clearInconsistentObservedAmount(item.unitPriceCents)
        : item.unitPriceCents,
    needsReview:
      item.needsReview ||
      (item.lineTotalCents.value !== null && item.lineTotalCents.value > subtotalCents) ||
      (item.unitPriceCents !== null &&
        item.unitPriceCents.value !== null &&
        item.unitPriceCents.value > subtotalCents),
  }));
}

function findMarket(lines: readonly NormalizedLine[]): ReceiptDraftField<string> {
  let itemSectionStarted = false;

  for (const line of lines) {
    if (!itemSectionStarted && isLikelyReceiptItemLine(line)) {
      itemSectionStarted = true;
    }
    if (itemSectionStarted) {
      continue;
    }

    const alias = MARKET_ALIASES.find(({ pattern }) => pattern.test(line.text));
    if (alias) {
      return field(alias.value, scaleConfidence(line.confidence, 0.98), line.index, line.text);
    }
  }

  return emptyField();
}

function classifyExcludedLine(text: string): ReceiptDraftExcludedLineReason | null {
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

function isMetadataLine(text: string): boolean {
  return parseDate(text) !== null || ADDRESS_OR_RECEIPT_METADATA_PATTERN.test(text);
}

function isItemSectionEndLine(text: string): boolean {
  return ITEM_SECTION_END_PATTERN.test(text) && !BARCODE_TOKEN_SEARCH_PATTERN.test(text);
}

function isTaxCodeOnlyName(name: string): boolean {
  return TAX_CODE_ONLY_PATTERN.test(name.trim());
}

function isKnownMarketLine(text: string): boolean {
  return MARKET_ALIASES.some(({ pattern }) => pattern.test(text));
}

function isLikelyReceiptItemLine(line: NormalizedLine): boolean {
  if (
    line.text.length === 0 ||
    FINAL_TOTAL_PATTERN.test(line.text) ||
    isMetadataLine(line.text) ||
    isKnownMarketLine(line.text) ||
    classifyExcludedLine(line.text) !== null
  ) {
    return false;
  }

  return parseItem(line) !== null;
}

function parseQuantityAndName(nameText: string): {
  name: string;
  quantity: number | null;
  unit: string | null;
} {
  const quantityMatch = nameText.match(/^(\d+(?:[.,]\d+)?)\s*[x×]\s*/i);
  const textAfterQuantity = quantityMatch
    ? nameText.slice(quantityMatch[0].length).trim()
    : nameText;
  const withoutCode = textAfterQuantity
    .replace(/^(?:(?:\*+\d{2,})|(?:\d{8,14}))(?=\s|$)\s*/u, '')
    .replace(/^\d{8,14}(?=\s|$)\s*/u, '')
    .trim();
  if (!quantityMatch) {
    return { name: withoutCode, quantity: null, unit: null };
  }

  const quantity = Number(quantityMatch[1].replace(',', '.'));
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { name: withoutCode, quantity: null, unit: null };
  }

  return {
    name: withoutCode,
    quantity,
    unit: 'Stück',
  };
}

function deriveQuantityFromPrices(unitPriceCents: number, lineTotalCents: number): number | null {
  if (unitPriceCents <= 0 || lineTotalCents <= 0) return null;

  const quantity = lineTotalCents / unitPriceCents;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const roundedQuantity = Number(quantity.toFixed(6));
  return Math.abs(unitPriceCents * roundedQuantity - lineTotalCents) < 0.001
    ? roundedQuantity
    : null;
}

function parseItem(
  line: NormalizedLine,
  observedLineTotal?: ObservedLineTotal,
): ReceiptDraftItem | null {
  const tokens = parseMoneyTokens(line.text);
  if (tokens.length === 0) {
    const { name, quantity, unit } = parseQuantityAndName(line.text);
    if (
      name.length === 0 ||
      !/\p{L}/u.test(name) ||
      isKnownMarketLine(name) ||
      isTaxCodeOnlyName(name)
    ) {
      return null;
    }

    const itemConfidence = scaleConfidence(line.confidence, 0.95);
    const lineTotalCents = observedLineTotal
      ? field(
          assertEuroCents(observedLineTotal.cents),
          scaleConfidence(
            observedLineTotal.confidence === null || line.confidence === null
              ? null
              : Math.min(observedLineTotal.confidence, line.confidence),
            0.95,
          ),
          line.index,
          `${line.text} ${observedLineTotal.evidence}`,
        )
      : missingField<EuroCents>(line);
    return {
      name,
      quantity,
      unit,
      lineTotalCents,
      unitPriceCents: null,
      confidence: itemConfidence,
      sourceLineIndex: line.index,
      evidence: line.text,
      needsReview: true,
    };
  }

  const finalToken = tokens.at(-1);
  if (!finalToken || finalToken.negative) {
    return null;
  }

  const firstToken = tokens[0];
  const nameText = line.text.slice(0, firstToken.start).trim();
  const parsedName = parseQuantityAndName(nameText);
  const trailingQuantityMatch = line.text
    .slice(firstToken.end, tokens.length > 1 ? finalToken.start : line.text.length)
    .match(/^\s*(?:€|EUR)?\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
  const trailingQuantity = trailingQuantityMatch
    ? Number(trailingQuantityMatch[1].replace(',', '.'))
    : null;
  const hasQuantityMarkerBeforeFinal =
    tokens.length > 1 &&
    /^\s*(?:€|EUR)?\s*[x×]\s*(?:[/|·•])?\s*$/i.test(
      line.text.slice(firstToken.end, finalToken.start),
    );
  const derivedQuantity = hasQuantityMarkerBeforeFinal
    ? deriveQuantityFromPrices(firstToken.cents, finalToken.cents)
    : null;
  const quantity =
    parsedName.quantity ??
    (trailingQuantity !== null && Number.isFinite(trailingQuantity) && trailingQuantity > 0
      ? trailingQuantity
      : derivedQuantity);
  const unit = quantity === null ? null : 'Stück';
  const name = parsedName.name;
  if (name.length === 0 || !/\p{L}/u.test(name) || isTaxCodeOnlyName(name)) {
    return null;
  }

  const itemConfidence = scaleConfidence(line.confidence, 0.95);
  const hasTrailingQuantity = trailingQuantity !== null && quantity === trailingQuantity;
  const hasSeparateUnitAndLineTotal = quantity !== null && tokens.length > 1;
  const lineTotalCents =
    hasTrailingQuantity && !hasSeparateUnitAndLineTotal
      ? missingField<EuroCents>(line)
      : field(assertEuroCents(finalToken.cents), itemConfidence, line.index, line.text);
  const unitPriceCents =
    quantity !== null && (tokens.length > 1 || hasTrailingQuantity)
      ? field(assertEuroCents(firstToken.cents), itemConfidence, line.index, line.text)
      : null;

  return {
    name,
    quantity,
    unit,
    lineTotalCents,
    unitPriceCents,
    confidence: itemConfidence,
    sourceLineIndex: line.index,
    evidence: line.text,
    needsReview:
      itemConfidence === null ||
      itemConfidence < RECEIPT_DRAFT_REVIEW_CONFIDENCE ||
      lineTotalCents.value === null,
  };
}

function isBarcodePrefixedItemLine(text: string): boolean {
  return /^(?:\d+(?:[.,]\d+)?\s*[x×]\s*)?\d{8,14}\b/iu.test(text.trim());
}

function parsePriceColumn(line: NormalizedLine): readonly MoneyToken[] | null {
  const tokens = parseMoneyTokens(line.text);
  if (tokens.length === 0 || tokens.some(({ negative }) => negative)) return null;

  let remainder = line.text;
  for (const token of [...tokens].reverse()) {
    remainder = `${remainder.slice(0, token.start)}${remainder.slice(token.end)}`;
  }

  const unsupportedText = remainder
    .replace(/\b(?:A|B|AW|BW)\b/gi, '')
    .replace(/[€\s|/,:;()[\]{}*_+-]/g, '');
  return unsupportedText.length === 0 ? tokens : null;
}

function separatedPriceAssignments(
  lines: readonly NormalizedLine[],
): ReadonlyMap<number, ObservedLineTotal> {
  const assignments = new Map<number, ObservedLineTotal>();

  let index = 0;
  while (index < lines.length) {
    if (!isBarcodePrefixedItemLine(lines[index]?.text ?? '')) {
      index += 1;
      continue;
    }

    const runStart = index;
    while (index < lines.length && isBarcodePrefixedItemLine(lines[index]?.text ?? '')) {
      index += 1;
    }
    const priceColumn = lines[index];
    const priceTokens = priceColumn ? parsePriceColumn(priceColumn) : null;
    const itemCount = index - runStart;
    if (itemCount < 2 || !priceColumn || !priceTokens || priceTokens.length !== itemCount) continue;

    const itemLines = lines.slice(runStart, index);
    const remainingTokens = [...priceTokens];
    const assignedTokens = new Map<number, MoneyToken>();
    for (const [offset, itemLine] of itemLines.entries()) {
      const quantity = parseQuantityAndName(itemLine.text).quantity;
      if (quantity === null || !Number.isInteger(quantity) || quantity <= 1) continue;

      const divisibleTokens = remainingTokens.filter((token) => token.cents % quantity === 0);
      if (divisibleTokens.length !== 1) continue;

      const [token] = divisibleTokens;
      if (!token) continue;
      assignedTokens.set(offset, token);
      remainingTokens.splice(remainingTokens.indexOf(token), 1);
    }

    for (const offset of itemLines.keys()) {
      if (assignedTokens.has(offset)) continue;
      const token = remainingTokens.shift();
      if (token) assignedTokens.set(offset, token);
    }

    for (const [offset, token] of assignedTokens) {
      const itemLine = lines[runStart + offset];
      if (!itemLine) continue;
      assignments.set(itemLine.index, {
        cents: token.cents,
        confidence:
          itemLine.confidence === null || priceColumn.confidence === null
            ? null
            : Math.min(itemLine.confidence, priceColumn.confidence),
        evidence: priceColumn.text.slice(token.start, token.end),
      });
    }
    index += 1;
  }

  return assignments;
}

function parseItems(lines: readonly NormalizedLine[]): {
  items: readonly ReceiptDraftItem[];
  excludedLines: readonly ReceiptDraftExcludedLine[];
} {
  const items: ReceiptDraftItem[] = [];
  const excludedLines: ReceiptDraftExcludedLine[] = [];
  const separatedPrices = separatedPriceAssignments(lines);
  let itemSectionOpen = true;

  for (const line of lines) {
    if (itemSectionOpen && items.length > 0 && isItemSectionEndLine(line.text)) {
      itemSectionOpen = false;
      continue;
    }
    if (!itemSectionOpen) {
      const reason = classifyExcludedLine(line.text);
      if (reason !== null) {
        excludedLines.push({
          sourceLineIndex: line.index,
          reason,
          confidence: line.confidence,
          evidence: line.text,
        });
      }
      continue;
    }

    if (
      line.text.length === 0 ||
      FINAL_TOTAL_PATTERN.test(line.text) ||
      isMetadataLine(line.text)
    ) {
      continue;
    }

    if (isKnownMarketLine(line.text)) {
      continue;
    }

    const reason = classifyExcludedLine(line.text);
    if (reason !== null) {
      excludedLines.push({
        sourceLineIndex: line.index,
        reason,
        confidence: line.confidence,
        evidence: line.text,
      });
      continue;
    }

    const item = parseItem(line, separatedPrices.get(line.index));
    if (item !== null) {
      items.push(item);
    }
  }

  return { items, excludedLines };
}

export function parseGermanReceipt(input: ParserInput): ReceiptDraft {
  const lines = normalizeInput(input);
  const market = findMarket(lines);
  const purchaseDate = findDate(lines);
  const totalCents = findTotal(lines);
  const subtotalCents = findSubtotalCents(lines);
  const parsedItems = parseItems(lines);
  const items = filterAmountsAboveSubtotal(parsedItems.items, subtotalCents);
  const { excludedLines } = parsedItems;
  const warnings: ReceiptDraftWarning[] = [];

  if (market.value === null) warnings.push('missing_market');
  if (purchaseDate.value === null) warnings.push('missing_date');
  if (totalCents.value === null) warnings.push('missing_total');
  if (items.length === 0) warnings.push('no_items');

  return {
    currency: 'EUR',
    market,
    purchaseDate,
    totalCents,
    items,
    excludedLines,
    warnings,
  };
}
