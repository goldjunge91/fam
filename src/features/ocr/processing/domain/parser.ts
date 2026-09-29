import {
  amountCeilingCents,
  filterAmountsAboveCeiling,
  findDate,
  findSubtotalCents,
  findTotal,
} from './parser/common';
import { normalizeInput, type ParserInput } from './parser/input';
import { isLikelyReceiptItemLine, parseItems } from './parser/items';
import { findMarket } from './parser/retailers';
import type { ReceiptDraft, ReceiptDraftWarning } from './types';

// 065. Builds a receipt draft from normalized lines, detected market, date, total, and items.
export function parseGermanReceipt(input: ParserInput): ReceiptDraft {
  const lines = normalizeInput(input);
  const firstItemLineIndex = lines.findIndex(isLikelyReceiptItemLine);
  const headerLines = firstItemLineIndex === -1 ? lines : lines.slice(0, firstItemLineIndex);
  const market = findMarket(headerLines);
  const purchaseDate = findDate(lines);
  const totalCents = findTotal(lines);
  const subtotalCents = findSubtotalCents(lines);
  const parsedItems = parseItems(lines, market.value);
  const ceilingCents = amountCeilingCents(lines, subtotalCents, totalCents.value);
  const items = filterAmountsAboveCeiling(parsedItems.items, ceilingCents);
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
