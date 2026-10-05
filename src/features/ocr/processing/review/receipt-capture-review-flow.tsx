import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { useDevSettingsStore } from '@/constants/dev-settings';
import { Button, Surface, Txt } from '@/constants/ui';
import {
  captureReceipt,
  createReceiptCapturePersistence,
  isReceiptAssetUploadFailureCode,
  type ReceiptCaptureApiDependencies,
  type ReceiptCapturePersistence,
  type ReceiptCaptureResult,
  retryReceiptCaptureUpload,
  uploadReceiptCapture,
} from '@/features/ocr/capture/api';
import type { ReceiptPickerAsset } from '@/features/ocr/capture/capture/contracts';
import type {
  ReceiptCaptureDraft,
  ReceiptCaptureSource,
} from '@/features/ocr/capture/domain/types';
import { useStores } from '@/features/shopping-list/hooks/use-stores';
import { debugLogEvent } from '@/lib/observability/debug-log';
import { triggerHouseholdSyncAfterOutboxMutation } from '@/lib/sync/sync-runner';
import type { ReceiptDraft } from '../domain/types';
import { isGoogleMlKitAvailable, type ReceiptOcrProvider } from '../native';
import {
  type FinalizeReceiptResult,
  finalizeReceiptReview,
  processReceiptCapture,
  type ReceiptProcessingProgress,
  type ReceiptProcessingResult,
} from '../workflow';
import {
  applyReceiptReviewState,
  createReceiptReviewSnapshot,
  createReceiptReviewState,
  type ReceiptReviewState,
  type ReceiptReviewStoreOption,
  restoreReceiptReviewDraft,
  restoreReceiptReviewState,
} from './model';
import { ReceiptProcessingIndicator } from './receipt-processing-indicator';
import { ReceiptReviewModal } from './receipt-review-modal';

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.background,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.space.xl,
  },
  content: {
    gap: theme.space.md,
  },
}));

type ReceiptCaptureReviewFlowProps = {
  visible: boolean;
  householdId: string;
  createdBy: string;
  onDismiss: () => void;
  /**
   * Direkteinstieg aus dem Live-Scanner: ueberspringt den Chooser und startet
   * die angegebene Quelle sofort. Ein `sourceAsset` ist der bereits
   * aufgenommene Live-Schuss und laeuft ohne Picker durch die Pipeline.
   */
  initialCapture?: {
    source: ReceiptCaptureSource;
    sourceAsset?: ReceiptPickerAsset;
    sourceAssets?: readonly ReceiptPickerAsset[];
  };
  onSaved?: (result: FinalizeReceiptResult) => void;
  capture?: (
    input: Parameters<typeof captureReceipt>[0],
    dependencies?: ReceiptCaptureApiDependencies,
  ) => Promise<ReceiptCaptureResult>;
  processCapture?: (
    input: Parameters<typeof processReceiptCapture>[0],
  ) => Promise<ReceiptProcessingResult>;
  finalize?: typeof finalizeReceiptReview;
  captureIdFactory?: () => string;
  persistence?: ReceiptCapturePersistence;
};

type FlowPhase = 'choose' | 'captured' | 'processing' | 'review' | 'saving' | 'error';

/**
 * Kassenbon-OCR laeuft auf iOS ueber ML Kit (Default, siehe `dev-settings`).
 * Apple Vision bleibt der Fallback, sobald das native Modul fehlt; die
 * Dev-Einstellung waehlt zwischen beiden Anbietern.
 */
export function resolveReceiptOcrProvider(
  platform: string,
  mlKitAvailable: boolean,
  configured: ReceiptOcrProvider,
): ReceiptOcrProvider {
  if (platform !== 'ios' || !mlKitAvailable) return 'apple-vision';
  return configured;
}
type ProcessingStage = ReceiptProcessingProgress['phase'];

function newCaptureId(): string {
  try {
    const crypto = require('expo-crypto') as typeof import('expo-crypto');
    return crypto.randomUUID();
  } catch {
    return `capture-${Date.now()}`;
  }
}

export function ReceiptCaptureReviewFlow({
  visible,
  householdId,
  createdBy,
  onDismiss,
  onSaved,
  capture = captureReceipt,
  processCapture = processReceiptCapture,
  finalize = finalizeReceiptReview,
  captureIdFactory = newCaptureId,
  persistence: persistenceOverride,
  initialCapture,
}: ReceiptCaptureReviewFlowProps) {
  const { t } = useTranslation();
  const receiptOcrProvider = useDevSettingsStore((state) => state.receiptOcrProvider);
  const mlKitAvailable = Platform.OS === 'ios' && isGoogleMlKitAvailable();
  const { data: householdStores = [] } = useStores(householdId);
  const stores = useMemo<readonly ReceiptReviewStoreOption[]>(
    () => householdStores.map(({ id, name }) => ({ id, name })),
    [householdStores],
  );
  const persistence = useMemo(
    () => persistenceOverride ?? createReceiptCapturePersistence(createdBy),
    [createdBy, persistenceOverride],
  );
  const [phase, setPhase] = useState<FlowPhase>('choose');
  const [captureDraft, setCaptureDraft] = useState<ReceiptCaptureDraft | null>(null);
  const [reviewDraft, setReviewDraft] = useState<ReceiptDraft | null>(null);
  const [pendingSave, setPendingSave] = useState<Extract<
    FinalizeReceiptResult,
    { kind: 'saved_with_pending_assets' }
  > | null>(null);
  const [pendingReceiptId, setPendingReceiptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<ReceiptReviewState | null>(null);
  const [saveRetryAvailable, setSaveRetryAvailable] = useState(false);
  const [captureRetry, setCaptureRetry] = useState<ReceiptCaptureSource | 'append' | null>(null);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('reading');
  const reviewSaveQueue = useRef(Promise.resolve());
  const discardRequestedRef = useRef(false);
  const lifecycleGenerationRef = useRef(0);

  const nowIso = useCallback(() => new Date().toISOString(), []);
  const waitForParentSync = useCallback(
    async ({ householdId }: { householdId: string; receiptId: string }) => {
      const result = await triggerHouseholdSyncAfterOutboxMutation([householdId]);
      if (!result) throw new Error('Receipt parent sync did not complete.');
    },
    [],
  );
  const isLifecycleCurrent = useCallback(
    (generation: number) =>
      generation === lifecycleGenerationRef.current && !discardRequestedRef.current,
    [],
  );

  useEffect(() => {
    debugLogEvent('receipt.capture.flow.mounted', {
      has_household: Boolean(householdId),
      has_created_by: Boolean(createdBy),
    });
    return () => {
      debugLogEvent('receipt.capture.flow.unmounted');
    };
  }, [createdBy, householdId]);

  useEffect(() => {
    debugLogEvent('receipt.capture.flow.phase_changed', {
      phase,
      visible,
      has_capture_draft: Boolean(captureDraft),
      has_review_draft: Boolean(reviewDraft),
    });
  }, [captureDraft, phase, reviewDraft, visible]);

  const dismissWithCleanup = useCallback(async () => {
    discardRequestedRef.current = true;
    lifecycleGenerationRef.current += 1;
    await persistence.discard();
    setCaptureDraft(null);
    setPendingSave(null);
    setPendingReceiptId(null);
    setReviewState(null);
    setSaveRetryAvailable(false);
    setCaptureRetry(null);
    onDismiss();
  }, [onDismiss, persistence]);

  const dismissKeepingPendingUpload = useCallback(() => {
    discardRequestedRef.current = true;
    lifecycleGenerationRef.current += 1;
    setCaptureDraft(null);
    setReviewDraft(null);
    setPendingSave(null);
    setPendingReceiptId(null);
    setReviewState(null);
    setSaveRetryAvailable(false);
    setCaptureRetry(null);
    onDismiss();
  }, [onDismiss]);

  const runProcessing = useCallback(
    async (nextCapture: ReceiptCaptureDraft) => {
      const generation = lifecycleGenerationRef.current;
      if (!isLifecycleCurrent(generation)) return;
      setCaptureDraft(nextCapture);
      setReviewState(null);
      setSaveRetryAvailable(false);
      setPhase('processing');
      setProcessingStage('reading');
      try {
        await persistence.save(nextCapture);
        if (!isLifecycleCurrent(generation)) return;
        const processingCapture = await persistence.transition({
          phase: 'processing',
          updatedAt: nowIso(),
        });
        if (!isLifecycleCurrent(generation)) return;
        setCaptureDraft(processingCapture);
        let processed: ReceiptProcessingResult;
        try {
          processed = await processCapture({
            capture: processingCapture,
            provider: resolveReceiptOcrProvider(Platform.OS, mlKitAvailable, receiptOcrProvider),
            onProgress: (progress) => {
              if (isLifecycleCurrent(generation)) setProcessingStage(progress.phase);
            },
          });
        } catch (processingError: unknown) {
          if (!isLifecycleCurrent(generation)) return;
          const failure = {
            code: 'RECEIPT_PROCESSING_FAILED',
            message:
              processingError instanceof Error ? processingError.message : t('ocr.review.error'),
          };
          const failed = await persistence.fail({
            phase: 'processing',
            failure,
            updatedAt: nowIso(),
          });
          if (!isLifecycleCurrent(generation)) return;
          setCaptureDraft(failed);
          setError(failure.message);
          setPhase('error');
          return;
        }
        if (!isLifecycleCurrent(generation)) return;
        if (processed.kind === 'failed') {
          const failed = await persistence.fail({
            phase: 'processing',
            failure: { code: processed.failure.code, message: processed.failure.message },
            updatedAt: nowIso(),
          });
          if (!isLifecycleCurrent(generation)) return;
          setCaptureDraft(failed);
          setError(processed.failure.message);
          setPhase('error');
          return;
        }
        const nextReviewState = createReceiptReviewState(processed.draft);
        const reviewedCapture = {
          ...processingCapture,
          review: createReceiptReviewSnapshot(processed.draft, nextReviewState),
        };
        await persistence.save(reviewedCapture);
        if (!isLifecycleCurrent(generation)) return;
        const needsReviewCapture = await persistence.transition({
          phase: 'needs_review',
          updatedAt: nowIso(),
        });
        if (!isLifecycleCurrent(generation)) return;
        setCaptureDraft(needsReviewCapture);
        setReviewDraft(processed.draft);
        setReviewState(nextReviewState);
        setPhase('review');
      } catch (processingError: unknown) {
        if (!isLifecycleCurrent(generation)) return;
        throw processingError;
      }
    },
    [
      isLifecycleCurrent,
      mlKitAvailable,
      nowIso,
      persistence,
      processCapture,
      receiptOcrProvider,
      t,
    ],
  );

  const persistReviewState = useCallback(
    (nextState: ReceiptReviewState) => {
      const generation = lifecycleGenerationRef.current;
      setReviewState(nextState);
      if (!captureDraft || !reviewDraft) return;
      const nextCapture = {
        ...captureDraft,
        review: createReceiptReviewSnapshot(reviewDraft, nextState),
      };
      setCaptureDraft(nextCapture);
      reviewSaveQueue.current = reviewSaveQueue.current
        .then(() => {
          if (discardRequestedRef.current || generation !== lifecycleGenerationRef.current) {
            return;
          }
          return persistence.save(nextCapture);
        })
        .catch((persistenceError: unknown) => {
          setError(
            persistenceError instanceof Error
              ? persistenceError.message
              : t('ocr.review.persistenceFailed'),
          );
          setPhase('error');
        });
    },
    [captureDraft, persistence, reviewDraft, t],
  );

  useEffect(() => {
    debugLogEvent('receipt.capture.flow.visibility_changed', {
      visible,
      has_household: Boolean(householdId),
      has_created_by: Boolean(createdBy),
    });
  }, [createdBy, householdId, visible]);

  useEffect(() => {
    if (!visible) return;
    // Synchron beim Oeffnen zuruecksetzen: `onDismiss` setzt das Flag, und ein
    // asynchrones Zuruecksetzen nach `persistence.load()` liess jeden zweiten
    // Aufruf an `isLifecycleCurrent` scheitern (Modal oeffnete nicht mehr).
    discardRequestedRef.current = false;
    let active = true;
    const resumeGeneration = lifecycleGenerationRef.current;

    async function resume() {
      debugLogEvent('receipt.capture.resume.started');
      setPhase('choose');
      setCaptureDraft(null);
      setReviewDraft(null);
      setPendingSave(null);
      setPendingReceiptId(null);
      setReviewState(null);
      setSaveRetryAvailable(false);
      setCaptureRetry(null);
      setError(null);
      const persisted = await persistence.load();
      if (!active || resumeGeneration !== lifecycleGenerationRef.current) return;
      debugLogEvent('receipt.capture.resume.loaded', {
        has_persisted_capture: Boolean(persisted),
        persisted_phase: persisted?.phase ?? 'none',
        persisted_status: persisted?.status ?? 'none',
        has_review_snapshot: Boolean(persisted?.review),
      });
      if (!active || !persisted) return;
      if (persisted.status === 'uploaded' || persisted.phase === 'saved') {
        debugLogEvent('receipt.capture.resume.branch', { branch: 'completed_discard' });
        await persistence.discard();
        return;
      }
      if (persisted.review && persisted.phase === 'needs_review') {
        debugLogEvent('receipt.capture.resume.branch', { branch: 'review' });
        const resumedDraft = restoreReceiptReviewDraft(persisted.review);
        const resumedState = restoreReceiptReviewState(persisted.review);
        setCaptureDraft(persisted);
        setReviewDraft(resumedDraft);
        setReviewState(resumedState);
        setPhase('review');
        return;
      }
      if (persisted.review && persisted.phase === 'saving') {
        debugLogEvent('receipt.capture.resume.branch', { branch: 'saving' });
        const resumedDraft = restoreReceiptReviewDraft(persisted.review);
        const resumedState = restoreReceiptReviewState(persisted.review);
        let retryable = persisted;
        if (persisted.status === 'pending') {
          retryable = await persistence.fail({
            phase: 'saving',
            failure: {
              code: 'authority_save_interrupted',
              message: t('ocr.review.saveInterrupted'),
            },
            updatedAt: nowIso(),
          });
        }
        setCaptureDraft(retryable);
        setReviewDraft(resumedDraft);
        setReviewState(resumedState);
        if (retryable.failure && isReceiptAssetUploadFailureCode(retryable.failure.code)) {
          setPendingReceiptId(retryable.id);
          setError(retryable.failure.message);
        } else {
          setSaveRetryAvailable(true);
          setError(retryable.failure?.message ?? t('ocr.review.saveInterrupted'));
        }
        setPhase('error');
        return;
      }
      if (persisted.phase === 'needs_review' || persisted.phase === 'saving') {
        debugLogEvent('receipt.capture.resume.branch', { branch: 'missing_review_snapshot' });
        if (persisted.status === 'failed') await persistence.retry(nowIso());
        const retryable = await persistence.fail({
          phase: 'processing',
          failure: {
            code: 'review_snapshot_missing',
            message: t('ocr.review.error'),
          },
          updatedAt: nowIso(),
        });
        setCaptureDraft(retryable);
        setError(retryable.failure?.message ?? t('ocr.review.error'));
        setPhase('error');
        return;
      }
      if (persisted.status === 'failed') {
        debugLogEvent('receipt.capture.resume.branch', { branch: 'failed_capture' });
        setCaptureDraft(persisted);
        setError(persisted.failure?.message ?? t('ocr.review.error'));
        setPhase('error');
        return;
      }
      if (persisted.source === 'camera' && persisted.phase === 'normalized') {
        debugLogEvent('receipt.capture.resume.branch', { branch: 'captured_camera' });
        setCaptureDraft(persisted);
        setPhase('captured');
        return;
      }
      if (!active) return;
      debugLogEvent('receipt.capture.resume.branch', { branch: 'process_persisted_capture' });
      await runProcessing(persisted);
    }

    void resume().catch((resumeError: unknown) => {
      if (!active || resumeGeneration !== lifecycleGenerationRef.current) return;
      debugLogEvent('receipt.capture.resume.failed', {
        error_type: resumeError instanceof Error ? resumeError.name : typeof resumeError,
      });
      setError(resumeError instanceof Error ? resumeError.message : t('ocr.review.error'));
      setPhase('error');
    });
    return () => {
      active = false;
    };
  }, [nowIso, persistence, runProcessing, t, visible]);

  async function startCapture(
    source: ReceiptCaptureSource,
    sourceAsset?: ReceiptPickerAsset,
    sourceAssets?: readonly ReceiptPickerAsset[],
  ) {
    const generation = lifecycleGenerationRef.current;
    if (!isLifecycleCurrent(generation)) return;
    const hasLivePages = Boolean(sourceAssets?.length || sourceAsset);
    debugLogEvent('receipt.capture.picker_requested', { source, live_asset: hasLivePages });
    setError(null);
    setCaptureRetry(null);
    try {
      const result = await capture(
        { captureId: captureIdFactory(), source, sourceAsset, sourceAssets },
        { persistence },
      );
      if (!isLifecycleCurrent(generation)) return;
      debugLogEvent('receipt.capture.picker_result', { source, result_kind: result.kind });
      if (result.kind === 'captured') {
        setCaptureDraft(result.draft);
        // Live-Aufnahmen sind in der Vorschau bereits gesammelt und bestaetigt;
        // die Galerieauswahl bringt ihre Seiten ebenfalls fertig mit. Nur der
        // Einzel-Systemkamera-Schuss wartet noch auf die Bestaetigung.
        if (hasLivePages || source === 'gallery') await runProcessing(result.draft);
        else setPhase('captured');
        return;
      }
      if (result.kind === 'cancelled') {
        setPhase('choose');
        return;
      }
      setError(
        result.kind === 'permission_denied' ? t('ocr.review.error') : result.failure.message,
      );
      setCaptureRetry(source);
      setPhase('error');
    } catch (captureError: unknown) {
      debugLogEvent('receipt.capture.picker_failed', {
        source,
        error_type: captureError instanceof Error ? captureError.name : typeof captureError,
      });
      setError(captureError instanceof Error ? captureError.message : t('ocr.review.error'));
      setCaptureRetry(source);
      setPhase('error');
    }
  }

  // Direkteinstieg aus dem Live-Scanner: laeuft genau einmal pro sichtbarem
  // Fenster, nachdem der Resume-Effekt den Zustand zurueckgesetzt hat.
  // Merkt sich das zuletzt gestartete Direkteinstiegs-Objekt. Der Aufrufer
  // haelt es in seinem State, damit seine Identitaet stabil bleibt; so startet
  // jeder Oeffnungsvorgang genau einmal, auch wenn React das Schliessen und
  // Wiederoeffnen in einem Commit buendelt.
  const startedInitialCaptureRef = useRef<unknown>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: startCapture darf nur einmal pro Direkteinstieg starten, nicht bei jedem Render.
  useEffect(() => {
    if (!visible || !initialCapture) return;
    if (startedInitialCaptureRef.current === initialCapture) return;
    startedInitialCaptureRef.current = initialCapture;
    debugLogEvent('receipt.capture.initial_capture.started', {
      source: initialCapture.source,
      has_live_asset: Boolean(initialCapture.sourceAsset || initialCapture.sourceAssets?.length),
    });
    void startCapture(
      initialCapture.source,
      initialCapture.sourceAsset,
      initialCapture.sourceAssets,
    );
  }, [initialCapture, visible]);

  async function appendCameraPage() {
    const generation = lifecycleGenerationRef.current;
    if (!isLifecycleCurrent(generation)) return;
    if (!captureDraft) return;
    debugLogEvent('receipt.capture.button_pressed', { button: 'append_page' });
    debugLogEvent('receipt.capture.append_picker_requested', { source: 'camera' });
    setError(null);
    setCaptureRetry(null);
    try {
      const draftForAppend =
        captureDraft.status === 'failed' ? await persistence.retry(nowIso()) : captureDraft;
      const result = await capture(
        { captureId: draftForAppend.id, source: 'camera', appendToExisting: true },
        { persistence, waitForParentSync },
      );
      if (!isLifecycleCurrent(generation)) return;
      debugLogEvent('receipt.capture.append_picker_result', {
        source: 'camera',
        result_kind: result.kind,
      });
      if (result.kind === 'captured') {
        setCaptureDraft(result.draft);
        setPhase('captured');
        return;
      }
      if (result.kind === 'cancelled') {
        setPhase('captured');
        return;
      }
      setError(
        result.kind === 'permission_denied' ? t('ocr.review.error') : result.failure.message,
      );
      const failed = await persistence.fail({
        phase: draftForAppend.phase,
        failure: {
          code: result.kind === 'permission_denied' ? 'permission_denied' : result.failure.code,
          message:
            result.kind === 'permission_denied' ? t('ocr.review.error') : result.failure.message,
        },
        updatedAt: nowIso(),
      });
      setCaptureDraft(failed);
      setCaptureRetry('append');
      setPhase('error');
    } catch (captureError: unknown) {
      debugLogEvent('receipt.capture.append_picker_failed', {
        source: 'camera',
        error_type: captureError instanceof Error ? captureError.name : typeof captureError,
      });
      const message = captureError instanceof Error ? captureError.message : t('ocr.review.error');
      const failed = await persistence.fail({
        phase: captureDraft.phase,
        failure: { code: 'capture_failed', message },
        updatedAt: nowIso(),
      });
      setCaptureDraft(failed);
      setError(message);
      setCaptureRetry('append');
      setPhase('error');
    }
  }

  async function processCapturedPages() {
    if (!captureDraft) return;
    debugLogEvent('receipt.capture.button_pressed', { button: 'process' });
    await runProcessing(captureDraft);
  }

  async function confirmDraft(
    nextDraft: ReceiptDraft,
    storeId: string,
    nextReviewState: ReceiptReviewState,
    captureForSave: ReceiptCaptureDraft | null = captureDraft,
  ) {
    if (!captureForSave) return;
    const generation = lifecycleGenerationRef.current;
    if (!isLifecycleCurrent(generation)) return;
    setPhase('saving');
    try {
      const reviewedCapture = {
        ...captureForSave,
        review: createReceiptReviewSnapshot(reviewDraft ?? nextDraft, nextReviewState),
      };
      await persistence.save(reviewedCapture);
      if (!isLifecycleCurrent(generation)) return;
      const savingCapture = {
        ...(await persistence.transition({ phase: 'saving', updatedAt: nowIso() })),
        householdId,
      };
      await persistence.save(savingCapture);
      if (!isLifecycleCurrent(generation)) return;
      setCaptureDraft(savingCapture);
      const result = await finalize(
        {
          capture: savingCapture,
          draft: nextDraft,
          householdId,
          createdBy,
          storeId,
          existingStoreIds: stores.map(({ id }) => id),
        },
        {
          uploadAssets: (input) =>
            uploadReceiptCapture(
              {
                draft: input.capture,
                householdId: input.householdId,
                receiptId: input.receiptId,
                createdBy: input.createdBy,
              },
              { persistence, waitForParentSync },
            ),
          deferAssetUpload: true,
        },
      );
      if (!isLifecycleCurrent(generation)) return;
      if (result.kind === 'saved_with_pending_assets') {
        await persistence.save(result.assets.draft);
        if (!isLifecycleCurrent(generation)) return;
        setCaptureDraft(result.assets.draft);
        setPendingSave(result);
        setPendingReceiptId(result.receiptId);
        setError(result.assets.message);
        dismissKeepingPendingUpload();
        return;
      }
      await persistence.transition({ phase: 'saved', updatedAt: nowIso() });
      if (!isLifecycleCurrent(generation)) return;
      onSaved?.(result);
      await dismissWithCleanup();
    } catch (nextError: unknown) {
      if (!isLifecycleCurrent(generation)) return;
      const message = nextError instanceof Error ? nextError.message : t('ocr.review.error');
      let persistenceFailure: string | null = null;
      try {
        const failed = await persistence.fail({
          phase: 'saving',
          failure: { code: 'authority_save_failed', message },
          updatedAt: nowIso(),
        });
        setCaptureDraft(failed);
      } catch (failurePersistenceError: unknown) {
        persistenceFailure =
          failurePersistenceError instanceof Error
            ? failurePersistenceError.message
            : t('ocr.review.persistenceFailed');
      }
      setSaveRetryAvailable(true);
      setError(persistenceFailure ? `${message} ${persistenceFailure}` : message);
      setPhase('error');
    }
  }

  async function retryProcessing() {
    const persisted = await persistence.load();
    if (!persisted) {
      setPhase('choose');
      return;
    }
    const pending = persisted.status === 'failed' ? await persistence.retry(nowIso()) : persisted;
    setCaptureDraft(pending);
    setError(null);
    await runProcessing(pending);
  }

  async function retryCaptureStep() {
    const retry = captureRetry;
    setCaptureRetry(null);
    if (retry === 'append') {
      await appendCameraPage();
      return;
    }
    if (retry) {
      await startCapture(retry);
      return;
    }
    if (captureDraft?.review && captureDraft.phase === 'needs_review') {
      setPhase('review');
      return;
    }
    if (captureDraft?.status === 'failed' && captureDraft.phase === 'normalized') {
      const pending = await persistence.retry(nowIso());
      setCaptureDraft(pending);
      setPhase('captured');
      return;
    }
    setPhase(captureDraft ? 'captured' : 'choose');
  }

  async function retryAuthoritySave() {
    const persisted = await persistence.load();
    if (!persisted?.review) {
      setError(t('ocr.review.error'));
      setPhase('error');
      return;
    }
    const pending = persisted.status === 'failed' ? await persistence.retry(nowIso()) : persisted;
    const source = restoreReceiptReviewDraft(persisted.review);
    const state = restoreReceiptReviewState(persisted.review);
    if (!state.storeId) {
      setCaptureDraft(pending);
      setReviewDraft(source);
      setReviewState(state);
      setSaveRetryAvailable(false);
      setPhase('review');
      return;
    }
    const reviewed = applyReceiptReviewState(source, state);
    setCaptureDraft(pending);
    setReviewDraft(source);
    setReviewState(state);
    setSaveRetryAvailable(false);
    await confirmDraft(reviewed, state.storeId, state, pending);
  }

  async function retryPendingAssets() {
    const generation = lifecycleGenerationRef.current;
    debugLogEvent('receipt.capture.asset_upload.retry_button_pressed', {
      has_capture_draft: Boolean(captureDraft),
      has_receipt_id: Boolean(pendingReceiptId),
      capture_status: captureDraft?.status ?? 'none',
      capture_phase: captureDraft?.phase ?? 'none',
    });
    if (!isLifecycleCurrent(generation)) return;
    if (!captureDraft || !pendingReceiptId) {
      debugLogEvent('receipt.capture.asset_upload.retry_blocked', {
        reason: 'missing_retry_state',
      });
      setError(t('ocr.review.assetUploadFailed'));
      setPhase('error');
      return;
    }
    setPhase('saving');
    let result: Awaited<ReturnType<typeof retryReceiptCaptureUpload>>;
    try {
      debugLogEvent('receipt.capture.asset_upload.retry_started', {
        page_count: captureDraft.pages.length,
      });
      result = await retryReceiptCaptureUpload(
        {
          draft: captureDraft,
          householdId: captureDraft.householdId ?? householdId,
          receiptId: pendingReceiptId,
          createdBy,
        },
        { persistence, waitForParentSync },
      );
    } catch (retryError: unknown) {
      const message = retryError instanceof Error ? retryError.message : t('ocr.review.error');
      debugLogEvent('receipt.capture.asset_upload.retry_failed', {
        error_type: retryError instanceof Error ? retryError.name : typeof retryError,
        error_message: message,
      });
      if (!isLifecycleCurrent(generation)) return;
      setError(message);
      setPhase('error');
      return;
    }
    if (!isLifecycleCurrent(generation)) return;
    if (result.draft.status !== 'uploaded') {
      debugLogEvent('receipt.capture.asset_upload.retry_pending', {
        error_code: result.draft.failure?.code ?? 'upload_failed',
        error_message: result.draft.failure?.message ?? t('ocr.review.assetUploadFailed'),
      });
      setCaptureDraft(result.draft);
      setError(result.draft.failure?.message ?? t('ocr.review.assetUploadFailed'));
      setPhase('error');
      return;
    }
    debugLogEvent('receipt.capture.asset_upload.retry_completed', {
      page_count: result.draft.pages.length,
    });
    await persistence.transition({ phase: 'saved', updatedAt: nowIso() });
    if (!isLifecycleCurrent(generation)) return;
    if (pendingSave) {
      onSaved?.({
        kind: 'saved',
        receiptId: pendingSave.receiptId,
        itemIds: pendingSave.itemIds,
        assets: { kind: 'uploaded', draft: result.draft },
      });
    }
    await dismissWithCleanup();
  }

  const content = (
    <Surface style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.content}>
          {phase === 'captured' ? (
            <>
              <Txt variant="heading" weight="700">
                {t('ocr.review.captureReady')}
              </Txt>
              <Button title={t('ocr.review.process')} onPress={() => void processCapturedPages()} />
              <Button
                title={t('ocr.review.addPage')}
                variant="secondary"
                onPress={() => void appendCameraPage()}
              />
              <Button
                title={t('ocr.review.cancel')}
                variant="link"
                onPress={() => {
                  debugLogEvent('receipt.capture.button_pressed', { button: 'cancel_captured' });
                  void dismissWithCleanup();
                }}
              />
            </>
          ) : null}
          {phase === 'processing' ? (
            <>
              <ReceiptProcessingIndicator
                label={
                  processingStage === 'preparing'
                    ? t('ocr.review.preparing')
                    : t('ocr.review.processing')
                }
              />
              <Txt variant="heading" weight="700">
                {processingStage === 'preparing'
                  ? t('ocr.review.preparing')
                  : t('ocr.review.processing')}
              </Txt>
              <Button
                title={t('ocr.review.cancel')}
                variant="link"
                onPress={() => {
                  debugLogEvent('receipt.capture.button_pressed', { button: 'cancel_processing' });
                  void dismissWithCleanup();
                }}
              />
            </>
          ) : null}
          {phase === 'saving' ? (
            <Txt variant="heading" weight="700">
              {t('ocr.review.saving')}
            </Txt>
          ) : null}
          {phase === 'error' ? (
            <>
              <Txt variant="heading" weight="700">
                {pendingReceiptId
                  ? t('ocr.review.assetUploadFailed')
                  : saveRetryAvailable
                    ? t('ocr.review.saveInterrupted')
                    : t('ocr.review.error')}
              </Txt>
              <Txt variant="body" tone="danger" accessibilityRole="alert">
                {error}
              </Txt>
              <Button
                title={
                  pendingReceiptId
                    ? t('ocr.review.retryUpload')
                    : saveRetryAvailable
                      ? t('ocr.review.retrySave')
                      : t('ocr.review.retry')
                }
                onPress={() => {
                  const button = pendingReceiptId
                    ? 'retry_upload'
                    : saveRetryAvailable
                      ? 'retry_save'
                      : captureRetry
                        ? 'retry_capture'
                        : captureDraft?.phase === 'processing'
                          ? 'retry_processing'
                          : 'retry_capture';
                  debugLogEvent('receipt.capture.button_pressed', { button });
                  if (pendingReceiptId) void retryPendingAssets();
                  else if (saveRetryAvailable) void retryAuthoritySave();
                  else if (captureRetry) void retryCaptureStep();
                  else if (captureDraft?.phase === 'processing') void retryProcessing();
                  else void retryCaptureStep();
                }}
              />
              <Button
                title={t('ocr.review.cancel')}
                variant="link"
                onPress={() => {
                  debugLogEvent('receipt.capture.button_pressed', { button: 'cancel_error' });
                  void dismissWithCleanup();
                }}
              />
            </>
          ) : null}
        </View>
      </SafeAreaView>
    </Surface>
  );

  const modalContent =
    phase === 'review' && reviewDraft ? (
      <ReceiptReviewModal
        embedded
        visible={visible}
        draft={reviewDraft}
        stores={stores}
        initialState={reviewState ?? undefined}
        onCancel={() => void dismissWithCleanup()}
        onStateChange={persistReviewState}
        onConfirm={(nextDraft, storeId, nextState) =>
          void confirmDraft(nextDraft, storeId, nextState)
        }
      />
    ) : (
      content
    );

  if (process.env.NODE_ENV === 'test') return visible ? modalContent : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={process.env.EXPO_OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={() => void dismissWithCleanup()}>
      {modalContent}
    </Modal>
  );
}
