import { render, screen } from '@testing-library/react-native';
import type { ReceiptCapturePersistence } from '@/features/ocr/capture/api';
import { createReceiptCaptureDraft } from '@/features/ocr/capture/domain/actions';
import type { ReceiptCaptureDraft } from '@/features/ocr/capture/domain/types';
import { i18n } from '@/i18n';
import { REWE_RECEIPT_LINES } from '../domain/fixtures/german-receipts';
import { parseGermanReceipt } from '../domain/parser';
import { createReceiptReviewSnapshot, createReceiptReviewState } from './model';
import { ReceiptCaptureReviewFlow } from './receipt-capture-review-flow';

jest.mock('@/features/shopping-list/hooks/use-stores', () => ({
  useStores: () => ({
    data: [{ id: 'store-1', name: 'REWE' }],
  }),
}));

jest.mock('./receipt-review-modal', () => {
  const { Text } = require('react-native');

  return {
    ReceiptReviewModal: ({ embedded }: { embedded?: boolean }) => (
      <Text>{embedded ? 'review-embedded' : 'review-modal'}</Text>
    ),
  };
});

function persistedReview(): ReceiptCaptureDraft {
  const source = parseGermanReceipt(REWE_RECEIPT_LINES);
  const draft = createReceiptCaptureDraft({
    id: 'capture-1',
    source: 'gallery',
    pages: [
      {
        id: 'page-1',
        localUri: 'file:///documents/receipt-captures/capture-1/page-1.jpg',
        mimeType: 'image/jpeg',
      },
    ],
    createdAt: '2026-09-21T10:00:00.000Z',
  });

  return {
    ...draft,
    phase: 'needs_review',
    review: createReceiptReviewSnapshot(source, createReceiptReviewState(source, 'store-1')),
  };
}

function persistenceWithReview(): ReceiptCapturePersistence {
  let current: ReceiptCaptureDraft | null = persistedReview();

  return {
    load: async () => current,
    save: async (next) => {
      current = next;
    },
    appendPages: async () => {
      throw new Error('not used');
    },
    transition: async ({ phase, updatedAt }) => {
      if (!current) throw new Error('missing draft');
      current = { ...current, phase, updatedAt };
      return current;
    },
    fail: async ({ phase, failure, updatedAt }) => {
      if (!current) throw new Error('missing draft');
      current = { ...current, phase, failure, status: 'failed', updatedAt };
      return current;
    },
    retry: async () => {
      if (!current) throw new Error('missing draft');
      current = { ...current, failure: null, status: 'pending' };
      return current;
    },
    discard: async () => {
      current = null;
    },
  };
}

describe('ReceiptCaptureReviewFlow modal host', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('renders a resumed review inside the existing flow modal host', async () => {
    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={jest.fn()}
        persistence={persistenceWithReview()}
      />,
    );

    expect(await screen.findByText('review-embedded')).toBeOnTheScreen();
    expect(screen.queryByText('review-modal')).not.toBeOnTheScreen();
  });
});
