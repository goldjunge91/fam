import { assertEuroCents, type EuroCents } from '@/features/ocr/authority/domain/types';
import type {
  ReceiptCaptureReviewFieldSnapshot,
  ReceiptCaptureReviewSnapshot,
} from '@/features/ocr/capture/domain/types';
import type { ReceiptDraft, ReceiptDraftField, ReceiptDraftItem } from '../domain/types';

const REVIEW_CONFIDENCE_THRESHOLD = 0.8;

export type ReceiptReviewStoreOption = {
  id: string;
  name: string;
};

export type ReceiptReviewItemState = {
  id: string;
  name: string;
  quantity: string;
  lineTotalCents: string;
  needsReview: boolean;
};

export type ReceiptReviewState = {
  market: string;
  purchaseDate: string;
  totalCents: string;
  storeId: string | null;
  marketNeedsReview: boolean;
  dateNeedsReview: boolean;
  totalNeedsReview: boolean;
  items: readonly ReceiptReviewItemState[];
};

export type ReceiptReviewStatePatch = Partial<
  Pick<ReceiptReviewState, 'market' | 'purchaseDate' | 'totalCents' | 'storeId'>
>;

export type ReceiptReviewValidationCode =
  | 'store_required'
  | 'store_invalid'
  | 'market_required'
  | 'date_required'
  | 'date_invalid'
  | 'total_required'
  | 'total_invalid'
  | 'items_required'
  | 'item_name_required';

export type ReceiptReviewValidationError = {
  code: ReceiptReviewValidationCode;
  itemId?: string;
};

function formatCents(value: EuroCents | null): string {
  if (value === null) return '';
  return `${Math.floor(value / 100)},${String(value % 100).padStart(2, '0')}`;
}

function formatQuantity(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',');
}

function parseMoney(value: string): EuroCents | null {
  const normalized = value.trim().replace(/€|EUR/gi, '').replace(/\s/g, '');
  if (normalized.length === 0) return null;

  const decimal = normalized.match(/^\d{1,3}(?:\.\d{3})*,\d{2}$/)
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized.replace(',', '.');
  const numeric = Number(decimal);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error('EUR amount must be a non-negative number.');
  }

  const cents = Math.round(numeric * 100);
  if (!Number.isSafeInteger(cents)) throw new Error('EUR amount is too large.');
  return assertEuroCents(cents);
}

function parseQuantity(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized.length === 0) return null;
  const quantity = Number(normalized);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Quantity must be positive.');
  }
  return quantity;
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

function manualField<T>(value: T, source: ReceiptDraftField<T>): ReceiptDraftField<T> {
  return {
    value,
    confidence: 1,
    sourceLineIndex: source.sourceLineIndex,
    evidence: 'manual',
    needsReview: false,
  };
}

function reviewedField<T>(
  source: ReceiptDraftField<T>,
  displayValue: string,
  parsedValue: T | null,
  formattedSource: string,
): ReceiptDraftField<T> {
  if (displayValue === formattedSource) return source;
  return parsedValue === null ? emptyField<T>() : manualField(parsedValue, source);
}

function reviewItemId(item: ReceiptDraftItem, index: number): string {
  const existingReviewId = (item as ReceiptDraftItem & { reviewId?: unknown }).reviewId;
  if (typeof existingReviewId === 'string' && existingReviewId.length > 0) {
    return existingReviewId;
  }
  return item.sourceLineIndex === null ? `item-${index}` : `line-${item.sourceLineIndex}`;
}

function stateItem(item: ReceiptDraftItem, index: number): ReceiptReviewItemState {
  return {
    id: reviewItemId(item, index),
    name: item.name,
    quantity: formatQuantity(item.quantity),
    lineTotalCents: formatCents(item.lineTotalCents.value),
    needsReview:
      item.needsReview || item.confidence === null || item.confidence < REVIEW_CONFIDENCE_THRESHOLD,
  };
}

export function createReceiptReviewState(
  draft: ReceiptDraft,
  storeId: string | null = null,
): ReceiptReviewState {
  return {
    market: draft.market.value ?? '',
    purchaseDate: draft.purchaseDate.value ?? '',
    totalCents: formatCents(draft.totalCents.value),
    storeId,
    marketNeedsReview:
      draft.market.needsReview ||
      draft.market.confidence === null ||
      draft.market.confidence < REVIEW_CONFIDENCE_THRESHOLD,
    dateNeedsReview:
      draft.purchaseDate.needsReview ||
      draft.purchaseDate.confidence === null ||
      draft.purchaseDate.confidence < REVIEW_CONFIDENCE_THRESHOLD,
    totalNeedsReview:
      draft.totalCents.needsReview ||
      draft.totalCents.confidence === null ||
      draft.totalCents.confidence < REVIEW_CONFIDENCE_THRESHOLD,
    items: draft.items.map(stateItem),
  };
}

function snapshotField<T extends string | number>(
  field: ReceiptDraftField<T>,
): ReceiptCaptureReviewFieldSnapshot<T> {
  return {
    value: field.value,
    confidence: field.confidence,
    sourceLineIndex: field.sourceLineIndex,
    evidence: field.evidence,
    needsReview: field.needsReview,
  };
}

/**
 * Produces the account-persisted review representation. Only structured
 * values and the current editable strings are retained; OCR evidence is not.
 */
export function createReceiptReviewSnapshot(
  source: ReceiptDraft,
  state: ReceiptReviewState,
): ReceiptCaptureReviewSnapshot {
  return {
    source: {
      market: snapshotField(source.market),
      purchaseDate: snapshotField(source.purchaseDate),
      totalCents: snapshotField(source.totalCents),
      items: source.items.map((item, index) => ({
        id: reviewItemId(item, index),
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        lineTotalCents: snapshotField(item.lineTotalCents),
        unitPriceCents: item.unitPriceCents ? snapshotField(item.unitPriceCents) : null,
        confidence: item.confidence,
        sourceLineIndex: item.sourceLineIndex,
        evidence: item.evidence,
        needsReview: item.needsReview,
      })),
    },
    state: {
      market: state.market,
      purchaseDate: state.purchaseDate,
      totalCents: state.totalCents,
      storeId: state.storeId,
      marketNeedsReview: state.marketNeedsReview,
      dateNeedsReview: state.dateNeedsReview,
      totalNeedsReview: state.totalNeedsReview,
      items: state.items.map((item) => ({ ...item })),
    },
  };
}

export function restoreReceiptReviewState(
  snapshot: ReceiptCaptureReviewSnapshot,
): ReceiptReviewState {
  return {
    market: snapshot.state.market,
    purchaseDate: snapshot.state.purchaseDate,
    totalCents: snapshot.state.totalCents,
    storeId: snapshot.state.storeId,
    marketNeedsReview: snapshot.state.marketNeedsReview,
    dateNeedsReview: snapshot.state.dateNeedsReview,
    totalNeedsReview: snapshot.state.totalNeedsReview,
    items: snapshot.state.items.map((item) => ({ ...item })),
  };
}

function restoredField<T extends string | number>(
  field: ReceiptCaptureReviewFieldSnapshot<T>,
): ReceiptDraftField<T> {
  return {
    value: field.value,
    confidence: field.confidence,
    sourceLineIndex: field.sourceLineIndex,
    evidence: field.evidence,
    needsReview: field.needsReview,
  };
}

function restoredEuroField(
  field: ReceiptCaptureReviewFieldSnapshot<number>,
): ReceiptDraftField<EuroCents> {
  return {
    ...field,
    value: field.value === null ? null : assertEuroCents(field.value),
  };
}

/** Rebuilds a semantic source draft from persisted review data without OCR text. */
export function restoreReceiptReviewDraft(snapshot: ReceiptCaptureReviewSnapshot): ReceiptDraft {
  const items = snapshot.source.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    lineTotalCents: restoredEuroField(item.lineTotalCents),
    unitPriceCents: item.unitPriceCents ? restoredEuroField(item.unitPriceCents) : null,
    confidence: item.confidence,
    sourceLineIndex: item.sourceLineIndex,
    evidence: item.evidence,
    needsReview: item.needsReview,
    reviewId: item.id,
  }));
  const restored = {
    currency: 'EUR' as const,
    market: restoredField<string>(snapshot.source.market),
    purchaseDate: restoredField<string>(snapshot.source.purchaseDate),
    totalCents: restoredEuroField(snapshot.source.totalCents),
    items,
    excludedLines: [],
    warnings: [],
  } satisfies ReceiptDraft;
  return { ...restored, warnings: warningsFor(restored) };
}

export function updateReceiptReviewState(
  state: ReceiptReviewState,
  patch: ReceiptReviewStatePatch,
): ReceiptReviewState {
  return { ...state, ...patch };
}

export function updateReceiptReviewItem(
  state: ReceiptReviewState,
  index: number,
  patch: Partial<ReceiptReviewItemState>,
): ReceiptReviewState {
  if (!Number.isSafeInteger(index) || index < 0 || index >= state.items.length) {
    throw new Error('Receipt review item index is invalid.');
  }

  return {
    ...state,
    items: state.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    ),
  };
}

export function addReceiptReviewItem(
  state: ReceiptReviewState,
  input: Partial<Omit<ReceiptReviewItemState, 'id' | 'needsReview'>> &
    Pick<Partial<ReceiptReviewItemState>, 'id' | 'needsReview'> = {},
): ReceiptReviewState {
  const ids = new Set(state.items.map((item) => item.id));
  let sequence = state.items.length + 1;
  let id = input.id ?? `manual-item-${sequence}`;
  while (ids.has(id)) {
    sequence += 1;
    id = `manual-item-${sequence}`;
  }

  return {
    ...state,
    items: [
      ...state.items,
      {
        id,
        name: input.name ?? '',
        quantity: input.quantity ?? '',
        lineTotalCents: input.lineTotalCents ?? '',
        needsReview: input.needsReview ?? true,
      },
    ],
  };
}

export function removeReceiptReviewItem(
  state: ReceiptReviewState,
  itemId: string,
): ReceiptReviewState {
  if (!state.items.some((item) => item.id === itemId)) {
    throw new Error('Receipt review item ID is invalid.');
  }
  return { ...state, items: state.items.filter((item) => item.id !== itemId) };
}

function reviewedItem(
  source: ReceiptDraftItem,
  state: ReceiptReviewItemState,
): ReceiptDraftItem & { reviewId: string } {
  const name = state.name.trim();
  if (name.length === 0) throw new Error('Item name is required.');

  const lineTotalCents = reviewedField(
    source.lineTotalCents,
    state.lineTotalCents,
    parseMoney(state.lineTotalCents),
    formatCents(source.lineTotalCents.value),
  );
  const nameChanged = name !== source.name;
  const quantity = parseQuantity(state.quantity);
  const quantityChanged = formatQuantity(source.quantity) !== state.quantity;
  const edited = nameChanged || quantityChanged || lineTotalCents.evidence === 'manual';

  return {
    ...source,
    name,
    quantity,
    lineTotalCents,
    confidence: edited ? 1 : source.confidence,
    needsReview: lineTotalCents.needsReview || (source.needsReview && !edited),
    reviewId: state.id,
  };
}

function warningsFor(draft: ReceiptDraft): ReceiptDraft['warnings'] {
  const warnings: ReceiptDraft['warnings'][number][] = [];
  if (draft.market.value === null) warnings.push('missing_market');
  if (draft.purchaseDate.value === null) warnings.push('missing_date');
  if (draft.totalCents.value === null) warnings.push('missing_total');
  if (draft.items.length === 0) warnings.push('no_items');
  return warnings;
}

function normalizeReceiptDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,4})([./-])(\d{1,2})\2(\d{1,4})$/);
  if (!match) return null;

  const [, first, , second, third] = match;
  const isIso = first.length === 4;
  if (!isIso && third.length !== 2 && third.length !== 4) return null;

  const year = Number(isIso ? first : third);
  const month = Number(second);
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

export function applyReceiptReviewState(
  source: ReceiptDraft,
  state: ReceiptReviewState,
): ReceiptDraft {
  const market =
    state.market.trim() === source.market.value
      ? source.market
      : state.market.trim().length === 0
        ? emptyField<string>()
        : manualField(state.market.trim(), source.market);
  const enteredPurchaseDate = state.purchaseDate.trim();
  const normalizedPurchaseDate = normalizeReceiptDate(enteredPurchaseDate);
  const purchaseDate =
    enteredPurchaseDate === source.purchaseDate.value
      ? source.purchaseDate
      : enteredPurchaseDate.length === 0
        ? emptyField<string>()
        : manualField(normalizedPurchaseDate ?? enteredPurchaseDate, source.purchaseDate);
  const totalCents = reviewedField(
    source.totalCents,
    state.totalCents,
    parseMoney(state.totalCents),
    formatCents(source.totalCents.value),
  );
  const sourceById = new Map(source.items.map((item, index) => [reviewItemId(item, index), item]));
  const reviewedItems = state.items.map((reviewItem) => {
    const existing = sourceById.get(reviewItem.id);
    if (existing) return reviewedItem(existing, reviewItem);
    return reviewedItem(
      {
        name: '',
        quantity: null,
        unit: null,
        lineTotalCents: emptyField<EuroCents>(),
        unitPriceCents: null,
        confidence: null,
        sourceLineIndex: -1,
        evidence: 'manual',
        needsReview: true,
      },
      reviewItem,
    );
  });
  const next = { ...source, market, purchaseDate, totalCents, items: reviewedItems };

  return { ...next, warnings: warningsFor(next) };
}

function isValidDate(value: string): boolean {
  return normalizeReceiptDate(value) === value;
}

export function getReceiptReviewValidationErrors(
  draft: ReceiptDraft,
  storeId: string | null,
  existingStoreIds: readonly string[],
): readonly ReceiptReviewValidationError[] {
  const errors: ReceiptReviewValidationError[] = [];
  if (!storeId) errors.push({ code: 'store_required' });
  else if (!existingStoreIds.includes(storeId)) errors.push({ code: 'store_invalid' });
  if (!draft.market.value?.trim()) errors.push({ code: 'market_required' });
  if (!draft.purchaseDate.value?.trim()) errors.push({ code: 'date_required' });
  else if (!isValidDate(draft.purchaseDate.value)) errors.push({ code: 'date_invalid' });
  if (draft.totalCents.value === null) errors.push({ code: 'total_required' });
  else if (!Number.isSafeInteger(draft.totalCents.value) || draft.totalCents.value < 0) {
    errors.push({ code: 'total_invalid' });
  }
  if (draft.items.length === 0) errors.push({ code: 'items_required' });
  for (const [index, item] of draft.items.entries()) {
    if (!item.name.trim()) {
      errors.push({ code: 'item_name_required', itemId: reviewItemId(item, index) });
    }
  }
  return errors;
}
