import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReceiptCapturePersistence } from '@/features/ocr/capture/api';
import { createReceiptCaptureDraft } from '@/features/ocr/capture/domain/actions';
import type { ReceiptCaptureDraft } from '@/features/ocr/capture/domain/types';
import { i18n } from '@/i18n';
import { REWE_RECEIPT_LINES } from '../domain/fixtures/german-receipts';
import { parseGermanReceipt } from '../domain/parser';
import type { ReceiptProcessingProgress, ReceiptProcessingResult } from '../workflow';
import { createReceiptItemIdsForReview } from '../workflow';
import { createReceiptReviewSnapshot, createReceiptReviewState } from './model';
import { ReceiptCaptureReviewFlow } from './receipt-capture-review-flow';

jest.mock('@/features/shopping-list/hooks/use-stores', () => ({
  useStores: () => ({
    data: [
      {
        id: 'store-1',
        household_id: 'household-1',
        name: 'REWE',
        color: '#000000',
        sort_order: 0,
        category_order: null,
      },
    ],
  }),
}));

const mockRetryReceiptCaptureUpload = jest.fn();
jest.mock('@/features/ocr/capture/api', () => ({
  ...jest.requireActual<typeof import('@/features/ocr/capture/api')>('@/features/ocr/capture/api'),
  retryReceiptCaptureUpload: (...args: unknown[]) => mockRetryReceiptCaptureUpload(...args),
}));

function captureDraft(source: 'camera' | 'gallery' = 'camera'): ReceiptCaptureDraft {
  return createReceiptCaptureDraft({
    id: 'capture-1',
    source,
    pages: [
      {
        id: 'page-1',
        localUri: 'file:///documents/receipt-captures/capture-1/page-1.jpg',
        mimeType: 'image/jpeg',
      },
    ],
    createdAt: '2026-09-21T10:00:00.000Z',
  });
}

function persistenceWith(draft: ReceiptCaptureDraft | null): {
  persistence: ReceiptCapturePersistence;
  phases: string[];
  discarded: jest.Mock;
  current: () => ReceiptCaptureDraft | null;
} {
  let current = draft;
  const phases: string[] = [];
  const discarded = jest.fn(async () => {
    current = null;
  });
  const persistence: ReceiptCapturePersistence = {
    load: async () => current,
    save: async (next) => {
      current = next;
    },
    appendPages: async () => {
      throw new Error('not used');
    },
    transition: async ({ phase, updatedAt }) => {
      phases.push(phase);
      if (!current) throw new Error('missing draft');
      current = { ...current, phase, updatedAt };
      return current;
    },
    fail: async ({ phase, failure, updatedAt }) => {
      if (!current) throw new Error('missing draft');
      current = { ...current, status: 'failed', phase, failure, updatedAt };
      return current;
    },
    retry: async () => {
      if (!current) throw new Error('missing draft');
      current = { ...current, status: 'pending', failure: null };
      return current;
    },
    discard: discarded,
  };
  return { persistence, phases, discarded, current: () => current };
}

describe('ReceiptCaptureReviewFlow persistence', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('startet den Direkteinstieg aus der Kamera ohne Zwischenbildschirm', async () => {
    const state = persistenceWith(null);
    const capture = jest.fn().mockResolvedValue({ kind: 'captured', draft: captureDraft() });

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={jest.fn()}
        persistence={state.persistence}
        capture={capture}
        processCapture={jest.fn()}
        captureIdFactory={() => 'capture-1'}
        initialCapture={{ source: 'camera' }}
      />,
    );

    // Kein Chooser: der Capture laeuft sofort, danach wartet der Flow auf die
    // Bestaetigung "Bon verarbeiten".
    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: 'Bon verarbeiten' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Fotografieren' })).not.toBeOnTheScreen();
  });

  it('startet den Direkteinstieg aus der Galerie und verarbeitet sofort', async () => {
    const state = persistenceWith(null);
    const capture = jest.fn().mockResolvedValue({ kind: 'captured', draft: captureDraft() });
    const processCapture = jest.fn(async () => ({
      kind: 'success' as const,
      captureId: 'capture-1',
      draft: parseGermanReceipt(REWE_RECEIPT_LINES),
    }));

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={jest.fn()}
        persistence={state.persistence}
        capture={capture}
        processCapture={processCapture}
        captureIdFactory={() => 'capture-1'}
        initialCapture={{ source: 'gallery' }}
      />,
    );

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(processCapture).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('radio', { name: 'REWE' })).toBeOnTheScreen();
  });

  it('resumes a pending draft and records processing/review phases', async () => {
    const state = persistenceWith(captureDraft('gallery'));
    const processCapture = jest.fn(async () => ({
      kind: 'success' as const,
      captureId: 'capture-1',
      draft: parseGermanReceipt(REWE_RECEIPT_LINES),
    }));

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={jest.fn()}
        persistence={state.persistence}
        processCapture={processCapture}
      />,
    );

    expect(await screen.findByRole('radio', { name: 'REWE' })).toBeOnTheScreen();
    expect(state.phases).toEqual(['processing', 'needs_review']);
    expect(processCapture).toHaveBeenCalledTimes(1);
  });

  it('startet nach Schliessen und erneutem Oeffnen wieder einen Capture', async () => {
    const state = persistenceWith(null);
    const capture = jest.fn().mockResolvedValue({ kind: 'captured', draft: captureDraft() });

    function flowElement(visible: boolean) {
      return (
        <ReceiptCaptureReviewFlow
          visible={visible}
          householdId="household-1"
          createdBy="user-1"
          onDismiss={jest.fn()}
          persistence={state.persistence}
          capture={capture}
          processCapture={jest.fn()}
          captureIdFactory={() => 'capture-1'}
          initialCapture={{ source: 'camera' }}
        />
      );
    }

    const { rerender } = await render(flowElement(true));
    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));

    await rerender(flowElement(false));
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull());

    await rerender(flowElement(true));
    await waitFor(() => expect(capture).toHaveBeenCalledTimes(2));
  });

  it('bietet nach Relaunch einen Kamera-Entwurf mit Verarbeiten-Aktion an', async () => {
    const state = persistenceWith(captureDraft('camera'));
    const processCapture = jest.fn(async () => ({
      kind: 'success' as const,
      captureId: 'capture-1',
      draft: parseGermanReceipt(REWE_RECEIPT_LINES),
    }));

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={jest.fn()}
        persistence={state.persistence}
        processCapture={processCapture}
      />,
    );

    expect(
      await screen.findByRole('button', { name: i18n.t('ocr.review.process') }),
    ).toBeOnTheScreen();
    expect(processCapture).not.toHaveBeenCalled();

    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: i18n.t('ocr.review.process') }));

    expect(await screen.findByRole('radio', { name: 'REWE' })).toBeOnTheScreen();
    expect(state.phases).toEqual(['processing', 'needs_review']);
  });

  it('discards the local draft when review is explicitly cancelled', async () => {
    const state = persistenceWith(captureDraft('gallery'));
    const onDismiss = jest.fn();

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={onDismiss}
        persistence={state.persistence}
        processCapture={async () => ({
          kind: 'success' as const,
          captureId: 'capture-1',
          draft: parseGermanReceipt(REWE_RECEIPT_LINES),
        })}
      />,
    );

    await screen.findByRole('radio', { name: 'REWE' });
    await userEvent.setup().press(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(state.discarded).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not resurrect a draft when cancellation finishes during OCR', async () => {
    const state = persistenceWith(captureDraft('gallery'));
    let resolveProcessing!: (result: ReceiptProcessingResult) => void;
    const processCapture = jest.fn(
      () =>
        new Promise<ReceiptProcessingResult>((resolve) => {
          resolveProcessing = resolve;
        }),
    );
    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={jest.fn()}
        persistence={state.persistence}
        processCapture={processCapture}
      />,
    );

    expect(await screen.findByText(i18n.t('ocr.review.processing'))).toBeOnTheScreen();

    await userEvent.setup().press(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(state.discarded).toHaveBeenCalledTimes(1);
    resolveProcessing({
      kind: 'success',
      captureId: 'capture-1',
      draft: parseGermanReceipt(REWE_RECEIPT_LINES),
    });

    await waitFor(() => expect(state.current()).toBeNull());
  });

  it('shows the native preparation stage reported by processing', async () => {
    const state = persistenceWith(captureDraft('gallery'));
    let resolveProcessing!: (result: ReceiptProcessingResult) => void;
    const processCapture = jest.fn(
      ({ onProgress }: { onProgress?: (progress: ReceiptProcessingProgress) => void }) => {
        onProgress?.({ phase: 'preparing', progress: 0.5 });
        return new Promise<ReceiptProcessingResult>((resolve) => {
          resolveProcessing = resolve;
        });
      },
    );

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={jest.fn()}
        persistence={state.persistence}
        processCapture={processCapture}
      />,
    );

    expect(await screen.findByText(i18n.t('ocr.review.preparing'))).toBeOnTheScreen();
    expect(screen.getByTestId('receipt-processing-animation')).toBeOnTheScreen();
    resolveProcessing({
      kind: 'success',
      captureId: 'capture-1',
      draft: parseGermanReceipt(REWE_RECEIPT_LINES),
    });
    expect(await screen.findByRole('radio', { name: 'REWE' })).toBeOnTheScreen();
  });

  it('resumes a persisted review without running native OCR again', async () => {
    const source = parseGermanReceipt(REWE_RECEIPT_LINES);
    const persisted = {
      ...captureDraft(),
      phase: 'needs_review' as const,
      review: createReceiptReviewSnapshot(source, createReceiptReviewState(source, 'store-1')),
    };
    const state = persistenceWith(persisted);
    const processCapture = jest.fn();

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={jest.fn()}
        persistence={state.persistence}
        processCapture={processCapture}
      />,
    );

    expect(await screen.findByRole('radio', { name: 'REWE' })).toBeOnTheScreen();
    expect(processCapture).not.toHaveBeenCalled();
  });

  it('persists in-progress review edits before confirmation', async () => {
    const source = parseGermanReceipt(REWE_RECEIPT_LINES);
    const persisted = {
      ...captureDraft(),
      phase: 'needs_review' as const,
      review: createReceiptReviewSnapshot(source, createReceiptReviewState(source, 'store-1')),
    };
    const state = persistenceWith(persisted);
    const user = userEvent.setup();

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={jest.fn()}
        persistence={state.persistence}
        processCapture={jest.fn()}
      />,
    );
    const market = await screen.findByLabelText('Markt');
    await user.clear(market);
    await user.type(market, 'Mein REWE');

    expect(state.current()?.review?.state).toMatchObject({
      market: 'Mein REWE',
      storeId: 'store-1',
    });
  });

  it('retries processing from the persisted local pages after an OCR failure', async () => {
    const state = persistenceWith(captureDraft('gallery'));
    const processCapture = jest
      .fn()
      .mockResolvedValueOnce({
        kind: 'failed' as const,
        captureId: 'capture-1',
        failure: { code: 'OCR_UNAVAILABLE', message: 'OCR unavailable.', pageIndex: 0 },
      })
      .mockResolvedValueOnce({
        kind: 'success' as const,
        captureId: 'capture-1',
        draft: parseGermanReceipt(REWE_RECEIPT_LINES),
      });

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={jest.fn()}
        persistence={state.persistence}
        processCapture={processCapture}
      />,
    );

    const user = userEvent.setup();
    await user.press(await screen.findByRole('button', { name: 'Erneut versuchen' }));

    expect(processCapture).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('radio', { name: 'REWE' })).toBeOnTheScreen();
  });

  it('startet den Direkteinstieg aus dem Live-Scanner ohne Chooser und ohne Picker', async () => {
    const state = persistenceWith(null);
    const liveAsset = {
      uri: 'file:///cache/expo-camera/shot.jpg',
      mimeType: 'image/jpeg' as const,
      width: 2_400,
      height: 1_800,
    };
    const capture = jest.fn().mockResolvedValue({ kind: 'captured', draft: captureDraft() });
    const processCapture = jest.fn(async () => ({
      kind: 'success' as const,
      captureId: 'capture-1',
      draft: parseGermanReceipt(REWE_RECEIPT_LINES),
    }));

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={jest.fn()}
        persistence={state.persistence}
        capture={capture}
        processCapture={processCapture}
        captureIdFactory={() => 'capture-1'}
        initialCapture={{ source: 'camera', sourceAsset: liveAsset }}
      />,
    );

    await waitFor(() =>
      expect(capture).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'camera', sourceAsset: liveAsset }),
        expect.objectContaining({ persistence: state.persistence }),
      ),
    );
    // Die Seiten sind in der Live-Ansicht bereits gesammelt und bestaetigt:
    // der Flow verarbeitet sie direkt, ohne weitere Zwischenbestaetigung.
    await waitFor(() => expect(processCapture).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('radio', { name: 'REWE' })).toBeOnTheScreen();
  });

  it('lets camera users append another page before processing', async () => {
    const state = persistenceWith(null);
    const first = captureDraft();
    const second = {
      ...first,
      pages: [
        ...first.pages,
        {
          id: 'page-2',
          localUri: 'file:///documents/receipt-captures/capture-1/page-2.jpg',
          mimeType: 'image/jpeg',
          byteSize: null,
        },
      ],
    };
    const capture = jest
      .fn()
      .mockResolvedValueOnce({ kind: 'captured', draft: first })
      .mockResolvedValueOnce({ kind: 'captured', draft: second });
    const processCapture = jest.fn(async () => ({
      kind: 'success' as const,
      captureId: 'capture-1',
      draft: parseGermanReceipt(REWE_RECEIPT_LINES),
    }));
    const user = userEvent.setup();

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={jest.fn()}
        persistence={state.persistence}
        capture={capture}
        processCapture={processCapture}
        captureIdFactory={() => 'capture-1'}
        initialCapture={{ source: 'camera' }}
      />,
    );
    await user.press(await screen.findByRole('button', { name: 'Weitere Seite fotografieren' }));
    await user.press(await screen.findByRole('button', { name: 'Bon verarbeiten' }));

    expect(capture).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ captureId: 'capture-1', appendToExisting: true }),
      expect.objectContaining({
        persistence: state.persistence,
        waitForParentSync: expect.any(Function),
      }),
    );
    expect(processCapture).toHaveBeenCalledWith({
      capture: expect.objectContaining({ pages: second.pages }),
      provider: 'apple-vision',
      onProgress: expect.any(Function),
    });
  });

  it('turns a rejected native capture into a visible retryable error', async () => {
    const state = persistenceWith(null);
    const capture = jest
      .fn()
      .mockRejectedValueOnce(new Error('Cannot find native module ExpoImageManipulator'))
      .mockResolvedValueOnce({ kind: 'captured', draft: captureDraft() });
    const user = userEvent.setup();

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={jest.fn()}
        persistence={state.persistence}
        capture={capture}
        processCapture={jest.fn()}
        initialCapture={{ source: 'camera' }}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot find native module ExpoImageManipulator',
    );
    await user.press(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(
      await screen.findByRole('button', { name: 'Weitere Seite fotografieren' }),
    ).toBeOnTheScreen();
  });

  it('persists authority save failures and retries from the restored review', async () => {
    const source = parseGermanReceipt(REWE_RECEIPT_LINES);
    const persisted = {
      ...captureDraft(),
      phase: 'needs_review' as const,
      review: createReceiptReviewSnapshot(source, createReceiptReviewState(source, 'store-1')),
    };
    const state = persistenceWith(persisted);
    const finalize = jest.fn().mockRejectedValue(new Error('authority offline'));

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={jest.fn()}
        persistence={state.persistence}
        processCapture={jest.fn()}
        finalize={finalize}
      />,
    );
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Kassenbon speichern' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('authority offline');
    expect(state.current()).toMatchObject({
      status: 'failed',
      phase: 'saving',
      failure: { code: 'authority_save_failed' },
    });
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Speichern erneut versuchen' }));
    expect(finalize).toHaveBeenCalledTimes(2);
  });

  it('dismisses after local save while retaining image upload work', async () => {
    const source = parseGermanReceipt(REWE_RECEIPT_LINES);
    const persisted = {
      ...captureDraft(),
      phase: 'needs_review' as const,
      review: createReceiptReviewSnapshot(source, createReceiptReviewState(source, 'store-1')),
    };
    const state = persistenceWith(persisted);
    const pendingDraft = {
      ...captureDraft(),
      status: 'failed' as const,
      phase: 'saving' as const,
      failure: {
        code: 'receipt_asset_storage_upload_failed',
        message: 'Der Kassenbon ist noch nicht synchronisiert.',
        phase: 'saving' as const,
      },
    };
    const finalize = jest.fn().mockResolvedValue({
      kind: 'saved_with_pending_assets' as const,
      receiptId: 'capture-1',
      itemIds: ['item-1'],
      assets: {
        kind: 'failed' as const,
        message: pendingDraft.failure.message,
        draft: pendingDraft,
      },
    });

    const onDismiss = jest.fn();
    const onSaved = jest.fn();
    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={onDismiss}
        onSaved={onSaved}
        persistence={state.persistence}
        processCapture={jest.fn()}
        finalize={finalize}
      />,
    );

    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Kassenbon speichern' }));

    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(await state.persistence.load()).toMatchObject({
      status: 'failed',
      failure: { code: 'receipt_asset_storage_upload_failed' },
    });
  });

  it('closes after the local receipt save and keeps pending images for background retry', async () => {
    const source = parseGermanReceipt(REWE_RECEIPT_LINES);
    const persisted = {
      ...captureDraft(),
      phase: 'needs_review' as const,
      review: createReceiptReviewSnapshot(source, createReceiptReviewState(source, 'store-1')),
    };
    const state = persistenceWith(persisted);
    const onDismiss = jest.fn();
    const onSaved = jest.fn();
    const pendingDraft = {
      ...captureDraft(),
      status: 'failed' as const,
      phase: 'saving' as const,
      failure: {
        code: 'receipt_asset_pending_sync',
        message: 'Receipt images are queued until the receipt sync completes.',
        phase: 'saving' as const,
      },
    };
    const finalize = jest.fn(async (_input, dependencies) => {
      if (dependencies?.deferAssetUpload !== true) {
        throw new Error('Asset upload must be deferred until sync completes.');
      }
      return {
        kind: 'saved_with_pending_assets' as const,
        receiptId: 'capture-1',
        itemIds: ['item-1'],
        assets: {
          kind: 'failed' as const,
          message: pendingDraft.failure.message,
          draft: pendingDraft,
        },
      };
    });

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={onDismiss}
        onSaved={onSaved}
        persistence={state.persistence}
        processCapture={jest.fn()}
        finalize={finalize}
      />,
    );

    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Kassenbon speichern' }));

    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(state.current()).toMatchObject({
      status: 'failed',
      phase: 'saving',
      failure: { code: 'receipt_asset_pending_sync' },
    });
    expect(screen.queryByText('Kassenbon wird gespeichert')).not.toBeOnTheScreen();
  });

  it('schliesst das Modal nach einem erfolgreich gespeicherten Bon', async () => {
    const source = parseGermanReceipt(REWE_RECEIPT_LINES);
    const persisted = {
      ...captureDraft(),
      phase: 'needs_review' as const,
      review: createReceiptReviewSnapshot(source, createReceiptReviewState(source, 'store-1')),
    };
    const state = persistenceWith(persisted);
    const onDismiss = jest.fn();
    const onSaved = jest.fn();
    const uploadedDraft = {
      ...captureDraft(),
      status: 'uploaded' as const,
      phase: 'saved' as const,
    };
    const finalize = jest.fn().mockResolvedValue({
      kind: 'saved' as const,
      receiptId: 'capture-1',
      itemIds: ['item-1'],
      assets: { kind: 'uploaded' as const, draft: uploadedDraft },
    });

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={onDismiss}
        onSaved={onSaved}
        persistence={state.persistence}
        processCapture={jest.fn()}
        finalize={finalize}
      />,
    );

    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Kassenbon speichern' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(state.discarded).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Kassenbon speichern' })).not.toBeOnTheScreen();
  });

  it('ruft nach Resume-Retry auch ohne Arbeitsspeicher-Ergebnis onSaved auf', async () => {
    const source = parseGermanReceipt(REWE_RECEIPT_LINES);
    const pendingDraft = {
      ...captureDraft(),
      householdId: 'household-1',
      status: 'failed' as const,
      phase: 'saving' as const,
      failure: {
        code: 'receipt_asset_pending_sync',
        message: 'Receipt images are queued until the receipt sync completes.',
        phase: 'saving' as const,
      },
      review: createReceiptReviewSnapshot(source, createReceiptReviewState(source, 'store-1')),
    };
    const state = persistenceWith(pendingDraft);
    const uploadedDraft = {
      ...pendingDraft,
      status: 'uploaded' as const,
      failure: null,
    };
    mockRetryReceiptCaptureUpload.mockResolvedValue({ draft: uploadedDraft });
    const onDismiss = jest.fn();
    const onSaved = jest.fn();

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={onDismiss}
        onSaved={onSaved}
        persistence={state.persistence}
        processCapture={jest.fn()}
      />,
    );

    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Bilder erneut hochladen' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSaved).toHaveBeenCalledWith({
      kind: 'saved',
      receiptId: 'capture-1',
      itemIds: createReceiptItemIdsForReview('capture-1', pendingDraft.review),
      assets: { kind: 'uploaded', draft: uploadedDraft },
    });
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(state.discarded).toHaveBeenCalledTimes(1);
    expect(state.current()).toBeNull();
  });

  it('schliesst das Modal auch dann, wenn das lokale Aufraeumen fehlschlaegt', async () => {
    // Der Bon ist zu diesem Zeitpunkt bereits in Authority + Outbox gespeichert.
    // Ein Fehler beim Loeschen der lokalen Temp-Dateien darf das Modal deshalb
    // nicht offen halten; sonst wirkt der Speichervorgang wie haengend.
    const source = parseGermanReceipt(REWE_RECEIPT_LINES);
    const persisted = {
      ...captureDraft(),
      phase: 'needs_review' as const,
      review: createReceiptReviewSnapshot(source, createReceiptReviewState(source, 'store-1')),
    };
    const state = persistenceWith(persisted);
    state.discarded.mockRejectedValue(new Error('Datei konnte nicht geloescht werden.'));
    const onDismiss = jest.fn();
    const finalize = jest.fn().mockResolvedValue({
      kind: 'saved' as const,
      receiptId: 'capture-1',
      itemIds: ['item-1'],
      assets: { kind: 'skipped' as const },
    });

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={onDismiss}
        persistence={state.persistence}
        processCapture={jest.fn()}
        finalize={finalize}
      />,
    );

    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Kassenbon speichern' }));

    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Kassenbon speichern' })).not.toBeOnTheScreen();
  });

  it('schliesst das Modal, wenn das Aufraeumen nach dem Speichern dauerhaft haengt', async () => {
    // Der Discard laeuft auf dem Geraet ueber den Dateisystem-Adapter. Ein
    // haengender Aufraeumschritt darf das Schliessen nicht blockieren; der Bon
    // liegt zu diesem Zeitpunkt bereits in Authority und Outbox.
    const source = parseGermanReceipt(REWE_RECEIPT_LINES);
    const persisted = {
      ...captureDraft(),
      phase: 'needs_review' as const,
      review: createReceiptReviewSnapshot(source, createReceiptReviewState(source, 'store-1')),
    };
    const state = persistenceWith(persisted);
    state.discarded.mockImplementation(() => new Promise<void>(() => {}));
    const onDismiss = jest.fn();
    const finalize = jest.fn().mockResolvedValue({
      kind: 'saved' as const,
      receiptId: 'capture-1',
      itemIds: ['item-1'],
      assets: { kind: 'skipped' as const },
    });

    await render(
      <ReceiptCaptureReviewFlow
        visible
        householdId="household-1"
        createdBy="user-1"
        onDismiss={onDismiss}
        persistence={state.persistence}
        processCapture={jest.fn()}
        finalize={finalize}
      />,
    );

    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Kassenbon speichern' }));

    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Kassenbon speichern' })).not.toBeOnTheScreen();
  });
});
