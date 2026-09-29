import {
  assertEuroCents,
  type EuroCents,
  RECEIPT_DRAFT_REVIEW_CONFIDENCE,
  type ReceiptDraftExcludedLine,
  type ReceiptDraftItem,
} from '../types';
import {
  classifyExcludedLine,
  FINAL_TOTAL_PATTERN,
  findSubtotalCents,
  isItemSectionEndLine,
  isMetadataLine,
  isTaxCodeOnlyName,
  parseMoneyTokens,
} from './common';
import {
  field,
  type MoneyToken,
  missingField,
  type NormalizedLine,
  type ObservedLineTotal,
  scaleConfidence,
} from './input';
import { isKnownMarketLine, normalizeRossmannArtifacts } from './retailers';

// 102. Checks whether a normalized line can produce an item instead of metadata or an exclusion.
export function isLikelyReceiptItemLine(line: NormalizedLine): boolean {
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

// 118. Extracts a leading quantity and removes barcode prefixes from the item name.
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
    .replace(/^(?:\*+\d{2,}\s+)?\d{8,14}(?=\s|$)\s*|^\*+\d{2,}(?=\s|$)\s*/u, '')
    .trim();
  const quantity = quantityMatch ? Number(quantityMatch[1].replace(',', '.')) : null;
  if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) {
    return { name: withoutCode, quantity: null, unit: null };
  }

  return {
    name: withoutCode,
    quantity,
    unit: 'Stück',
  };
}

// 119. Recovers item name and quantity when OCR has truncated a printed unit price.
function parseNameWithTruncatedUnitPrice(
  text: string,
): ReturnType<typeof parseQuantityAndName> & { priceReview?: boolean } {
  const partial = text.match(
    /^(.*?)\s+(?:\d[\d\s.,]*|[.,]\d{1,2})\s*(?:€|EUR)\s*[x×]\s*(\d+(?:[.,]\d+)?)(?:\s+\d+[,.]\s*\d?)?\s*$/iu,
  );
  const parsed = parseQuantityAndName(partial?.[1] ?? text);
  if (!partial) return parsed;
  const observedQuantity = Number(partial[2].replace(',', '.'));
  if (!Number.isFinite(observedQuantity) || observedQuantity <= 0) return parsed;
  const quantity = parsed.quantity ?? observedQuantity;
  return Object.assign({}, parsed, { quantity, unit: 'Stück', priceReview: true });
}

// 120. Derives a quantity only when the unit and line prices divide consistently.
function deriveQuantityFromPrices(unitPriceCents: number, lineTotalCents: number): number | null {
  if (unitPriceCents <= 0 || lineTotalCents <= 0) return null;

  const quantity = lineTotalCents / unitPriceCents;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const roundedQuantity = Number(quantity.toFixed(6));
  return Math.abs(unitPriceCents * roundedQuantity - lineTotalCents) < 0.001
    ? roundedQuantity
    : null;
}

// 121. Builds one item from observed line text and optional separate price evidence.
function parseItem(
  line: NormalizedLine,
  observedLineTotal?: ObservedLineTotal,
  subtotalCents: number | null = null,
  market: string | null = null,
): ReceiptDraftItem | null {
  const tokens =
    market === 'ROSSMANN'
      ? normalizeRossmannArtifacts(line, parseMoneyTokens(line.text), subtotalCents)
      : parseMoneyTokens(line.text);
  if (tokens.length === 0) {
    const { name, quantity, unit } = parseNameWithTruncatedUnitPrice(line.text);
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
  const normalizedNameText =
    market === 'ROSSMANN' && subtotalCents !== null && isBarcodePrefixedItemLine(line.text)
      ? nameText.replace(/\s+C0\.\s*$/iu, '').trim()
      : nameText;
  const parsedName = parseNameWithTruncatedUnitPrice(normalizedNameText);
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
  const textBetweenMoneyTokens = line.text.slice(firstToken.end, finalToken.start);
  const hasUnparsedCurrencyFragment = /(?:€|EUR)\s*\d{1,3}\b/iu.test(textBetweenMoneyTokens);
  const hasSplitQuantityTotal =
    observedLineTotal === undefined &&
    parsedName.quantity !== null &&
    (tokens.length > 2 || hasUnparsedCurrencyFragment) &&
    finalToken.cents < firstToken.cents &&
    (tokens.length <= 2 || tokens.slice(1, -1).some((token) => token.cents >= firstToken.cents));
  const derivedLineTotalValue = firstToken.cents * (parsedName.quantity ?? 0);
  const derivedLineTotalCents =
    hasSplitQuantityTotal && Number.isSafeInteger(derivedLineTotalValue)
      ? assertEuroCents(derivedLineTotalValue)
      : null;
  const lineTotalCents =
    hasTrailingQuantity && !hasSeparateUnitAndLineTotal
      ? missingField<EuroCents>(line)
      : observedLineTotal
        ? field(
            assertEuroCents(observedLineTotal.cents),
            observedLineTotal.confidence,
            line.index,
            `${line.text} ${observedLineTotal.evidence}`,
          )
        : derivedLineTotalCents !== null
          ? {
              ...field(
                derivedLineTotalCents,
                scaleConfidence(itemConfidence, 0.85),
                line.index,
                line.text,
              ),
              needsReview: true,
            }
          : field(assertEuroCents(finalToken.cents), itemConfidence, line.index, line.text);
  const unitPriceCents =
    quantity !== null && (tokens.length > 1 || hasTrailingQuantity)
      ? field(assertEuroCents(firstToken.cents), itemConfidence, line.index, line.text)
      : null;

  const repairedLineTotalCents = finalToken.repaired
    ? { ...lineTotalCents, needsReview: true }
    : lineTotalCents;

  return {
    name,
    quantity,
    unit,
    lineTotalCents: repairedLineTotalCents,
    unitPriceCents,
    confidence: itemConfidence,
    sourceLineIndex: line.index,
    evidence: line.text,
    needsReview:
      itemConfidence === null ||
      itemConfidence < RECEIPT_DRAFT_REVIEW_CONFIDENCE ||
      lineTotalCents.value === null ||
      parsedName.priceReview === true,
  };
}

// 122. Identifies item lines that begin with an optional quantity and barcode.
function isBarcodePrefixedItemLine(text: string): boolean {
  return /^(?:\d+(?:[.,]\d+)?\s*[x×]\s*)?\d{8,14}\b/iu.test(text.trim());
}

// 123. Accepts a separated price row only when no unsupported text remains.
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

// 124. Matches a standalone price row to an adjacent run of barcode item lines.
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

// 125. Parses the item section and records recognized non-item lines with their evidence.
export function parseItems(
  lines: readonly NormalizedLine[],
  market: string | null,
): {
  items: readonly ReceiptDraftItem[];
  excludedLines: readonly ReceiptDraftExcludedLine[];
} {
  const items: ReceiptDraftItem[] = [];
  const excludedLines: ReceiptDraftExcludedLine[] = [];
  const separatedPrices = separatedPriceAssignments(lines);
  const subtotalCents = findSubtotalCents(lines);
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

    const item = parseItem(line, separatedPrices.get(line.index), subtotalCents, market);
    if (item !== null) {
      items.push(item);
    }
  }

  return { items, excludedLines };
}
