import { useCallback, useEffect, useRef, useState } from 'react';

import { env } from '@/lib/config/env';
import {
  createEmptyBetaQualityMetrics,
  recordBetaQualityObservations,
} from '../domain/quality-metrics';
import { type ExperimentVariant, sanitizeQualitySnapshot } from '../domain/quality-snapshot';
import { appendQualityTestSnapshot } from '../services/quality-test-results';
import type {
  TextBetaPreview,
  TextBetaQualitySelection,
  TextBetaSelection,
  TextBetaStorage,
} from '../workflow/text-workflow';
import { createTextBetaQualityObservations } from '../workflow/text-workflow';

export type TestCaptureStatus = 'idle' | 'saving' | 'saved' | 'error';

export type UseNaturalLanguageAdditionTestCaptureInput = {
  preview: TextBetaPreview;
  variant: ExperimentVariant;
  storage: TextBetaStorage;
};

export type UseNaturalLanguageAdditionTestCaptureResult = {
  enabled: boolean;
  status: TestCaptureStatus;
  error: string | null;
  saveTestMeasurement: (selections: readonly TextBetaSelection[]) => Promise<void>;
};

function testToolsEnabled(): boolean {
  return (
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    (env.devTools || env.naturalLanguageAdditionTestTools)
  );
}

function findSelectedItems(
  preview: TextBetaPreview,
  selections: readonly TextBetaSelection[],
): readonly TextBetaQualitySelection[] {
  const selectedIds = new Set<string>();

  return selections.map((selection) => {
    if (selectedIds.has(selection.itemId)) {
      throw new Error(`Beta item selected twice: ${selection.itemId}`);
    }
    selectedIds.add(selection.itemId);

    const targetListId = selection.targetListId.trim();
    const previewItem = preview.items.find((item) => item.itemId === selection.itemId);
    const targetIsSuggested = previewItem?.routing.suggestions.some(
      (suggestion) => suggestion.listId === targetListId,
    );
    if (!previewItem || !targetListId || !targetIsSuggested) {
      throw new Error('Beta test annotations require a preview suggestion');
    }

    return { previewItem, targetListId };
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useNaturalLanguageAdditionTestCapture({
  preview,
  variant,
  storage,
}: UseNaturalLanguageAdditionTestCaptureInput): UseNaturalLanguageAdditionTestCaptureResult {
  const enabled = testToolsEnabled();
  const [status, setStatus] = useState<TestCaptureStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const statusRef = useRef<TestCaptureStatus>('idle');
  const previewResetKey = `${preview.session.id}:${preview.input.text}`;
  const previousPreviewResetKeyRef = useRef(previewResetKey);

  useEffect(() => {
    if (previousPreviewResetKeyRef.current === previewResetKey) return;
    previousPreviewResetKeyRef.current = previewResetKey;
    savingRef.current = false;
    statusRef.current = 'idle';
    setStatus('idle');
    setError(null);
  }, [previewResetKey]);

  const saveTestMeasurement = useCallback(
    async (selections: readonly TextBetaSelection[]): Promise<void> => {
      if (!enabled || savingRef.current || statusRef.current === 'saved') return;

      savingRef.current = true;
      statusRef.current = 'saving';
      setStatus('saving');
      setError(null);

      try {
        const state = await storage.load();
        if (state.session && state.session.id !== preview.session.id) {
          throw new Error('The Beta preview session is no longer active');
        }

        const selectedItems = findSelectedItems(preview, selections);
        const capturedAt = new Date().toISOString();
        const testState = {
          ...state,
          consent: { ...state.consent, qualityMetrics: 'granted' as const },
          qualityMetrics: createEmptyBetaQualityMetrics(),
        };
        const annotatedState = recordBetaQualityObservations(
          testState,
          createTextBetaQualityObservations(preview, selectedItems, capturedAt, 'test-quality'),
        );
        const payload = sanitizeQualitySnapshot({
          metrics: annotatedState.qualityMetrics,
          captureKind: 'maestro-preview-test',
          fixtureSetVersion: null,
          experimentVariant: variant,
          createdAt: capturedAt,
        });
        if (payload === null) throw new Error('Testmessung konnte nicht serialisiert werden');

        await appendQualityTestSnapshot(payload);
        statusRef.current = 'saved';
        setStatus('saved');
      } catch (captureError) {
        statusRef.current = 'error';
        setStatus('error');
        setError(errorMessage(captureError));
      } finally {
        savingRef.current = false;
      }
    },
    [enabled, preview, storage, variant],
  );

  return { enabled, status, error, saveTestMeasurement };
}
