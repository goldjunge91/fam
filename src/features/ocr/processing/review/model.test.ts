import { REWE_RECEIPT_LINES } from '../domain/fixtures/german-receipts';
import { parseGermanReceipt } from '../domain/parser';
import {
  addReceiptReviewItem,
  applyReceiptReviewState,
  createReceiptReviewSnapshot,
  createReceiptReviewState,
  getReceiptReviewValidationErrors,
  removeReceiptReviewItem,
  restoreReceiptReviewDraft,
  restoreReceiptReviewState,
  updateReceiptReviewItem,
  updateReceiptReviewState,
} from './model';

function draft() {
  return parseGermanReceipt(REWE_RECEIPT_LINES);
}

describe('receipt review model', () => {
  it('creates editable EUR text from a parsed draft', () => {
    const state = createReceiptReviewState(draft());

    expect(state).toMatchObject({
      market: 'REWE',
      purchaseDate: '2026-09-21',
      totalCents: '4,96',
    });
    expect(state.items[1]).toMatchObject({
      name: 'Äpfel Gala',
      quantity: '2',
      lineTotalCents: '2,98',
    });
  });

  it('applies manual corrections and clears review flags for corrected values', () => {
    const source = draft();
    const state = updateReceiptReviewState(
      updateReceiptReviewItem(createReceiptReviewState(source), 0, {
        name: 'Bio Milch',
        lineTotalCents: '1,39',
      }),
      { totalCents: '5,06' },
    );

    const corrected = applyReceiptReviewState(source, state);

    expect(corrected.totalCents).toMatchObject({
      value: 506,
      needsReview: false,
      evidence: 'manual',
    });
    expect(corrected.items[0]).toMatchObject({
      name: 'Bio Milch',
      lineTotalCents: { value: 139, needsReview: false, evidence: 'manual' },
    });
  });

  it('rejects invalid manual money and empty item names', () => {
    const state = createReceiptReviewState(draft());

    expect(() => applyReceiptReviewState(draft(), { ...state, totalCents: 'vier Euro' })).toThrow(
      'EUR amount',
    );
    expect(() =>
      applyReceiptReviewState(draft(), updateReceiptReviewItem(state, 0, { name: '   ' })),
    ).toThrow('Item name');
  });

  it.each(['2026-09-22', '22.09.2026', '22.09.26'])(
    'normalizes supported manual purchase-date input %s to ISO',
    (purchaseDate) => {
      const source = draft();
      const state = updateReceiptReviewState(createReceiptReviewState(source, 'store-1'), {
        purchaseDate,
      });

      const reviewed = applyReceiptReviewState(source, state);

      expect(reviewed.purchaseDate).toMatchObject({
        value: '2026-09-22',
        evidence: 'manual',
        needsReview: false,
      });
      expect(
        getReceiptReviewValidationErrors(reviewed, 'store-1', ['store-1']).map(({ code }) => code),
      ).not.toContain('date_invalid');
    },
  );

  it('keeps impossible manual purchase dates invalid', () => {
    const source = draft();
    const state = updateReceiptReviewState(createReceiptReviewState(source, 'store-1'), {
      purchaseDate: '31.02.2026',
    });

    const reviewed = applyReceiptReviewState(source, state);

    expect(reviewed.purchaseDate.value).toBe('31.02.2026');
    expect(
      getReceiptReviewValidationErrors(reviewed, 'store-1', ['store-1']).map(({ code }) => code),
    ).toContain('date_invalid');
  });

  it('adds and removes items without changing the identity of the remaining items', () => {
    const state = createReceiptReviewState(draft());
    const firstId = state.items[0]?.id;

    const withAdded = addReceiptReviewItem(state, {
      name: 'Brot',
      quantity: '1',
      lineTotalCents: '2,49',
    });
    const withoutFirst = removeReceiptReviewItem(withAdded, firstId ?? '');

    expect(withoutFirst.items.map((item) => item.id)).toEqual(
      withAdded.items.filter((item) => item.id !== firstId).map((item) => item.id),
    );
    expect(withoutFirst.items.find((item) => item.id === withAdded.items.at(-1)?.id)).toMatchObject(
      {
        name: 'Brot',
        quantity: '1',
        lineTotalCents: '2,49',
      },
    );
  });

  it('requires an explicitly selected existing store and valid required values', () => {
    const state = createReceiptReviewState(draft());

    expect(
      getReceiptReviewValidationErrors(
        applyReceiptReviewState(draft(), {
          ...state,
          market: '',
          purchaseDate: '',
          totalCents: '',
        }),
        null,
        ['store-1'],
      ).map(({ code }) => code),
    ).toEqual(['store_required', 'market_required', 'date_required', 'total_required']);

    expect(
      getReceiptReviewValidationErrors(draft(), 'foreign-store', ['store-1']).map(
        ({ code }) => code,
      ),
    ).toEqual(['store_invalid']);
  });

  it('keeps unknown native confidence unknown until the user edits the field', () => {
    const source = draft();
    const uncertain = {
      ...source,
      market: { ...source.market, confidence: null, needsReview: true },
    };

    const untouched = applyReceiptReviewState(uncertain, createReceiptReviewState(uncertain));
    expect(untouched.market.confidence).toBeNull();

    const manuallyCorrected = applyReceiptReviewState(
      uncertain,
      updateReceiptReviewState(createReceiptReviewState(uncertain), { market: 'EDEKA' }),
    );
    expect(manuallyCorrected.market).toMatchObject({ confidence: 1, evidence: 'manual' });
  });

  it('round-trips semantic evidence without persisting excluded OCR lines', () => {
    const source = draft();
    const state = updateReceiptReviewItem(createReceiptReviewState(source, 'store-1'), 0, {
      name: 'Bio Milch',
      lineTotalCents: '1,39',
    });

    const snapshot = createReceiptReviewSnapshot(source, state);
    const restoredSource = restoreReceiptReviewDraft(snapshot);
    const restoredState = restoreReceiptReviewState(snapshot);

    expect(restoredState).toEqual(state);
    expect(restoredSource.items[0]).toMatchObject({
      name: source.items[0]?.name,
      reviewId: state.items[0]?.id,
    });
    expect(restoredSource.market.evidence).toBe(source.market.evidence);
    expect(restoredSource.items[0]?.lineTotalCents).toMatchObject(
      source.items[0]?.lineTotalCents ?? {},
    );
    expect(restoredSource.items[0]?.evidence).toBe(source.items[0]?.evidence);
    expect(applyReceiptReviewState(restoredSource, restoredState).items[0]).toMatchObject({
      name: 'Bio Milch',
      lineTotalCents: { value: 139, evidence: 'manual' },
    });
    expect(JSON.stringify(snapshot)).not.toContain(source.excludedLines[0]?.evidence ?? '');
  });
});
