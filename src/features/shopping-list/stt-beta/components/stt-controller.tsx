import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useSession } from '@/features/auth/session-provider';
import { useFeatureAccess } from '@/features/settings/use-feature-access';
import { getDatabase } from '@/lib/db/client';
import { debugLogEvent } from '@/lib/observability/debug-log';
import type { Store } from '../../hooks/use-stores';
import {
  getNaturalLanguageAdditionBetaState,
  saveNaturalLanguageAdditionBetaState,
} from '../beta-storage';
import { setAutoAssign } from '../domain/auto-assign';
import { saveConfirmedBetaOutput } from '../integration/confirmed-output-adapter';
import { getNameCorrections, type NameCorrection, updateNameCorrection } from '../name-corrections';
import type { NaturalLanguageAdditionInput, SpeechInputResult } from '../types';
import {
  confirmTextBetaItems,
  correctBetaPreviewItem,
  createBetaPreview,
  type TextBetaPreview,
  type TextBetaSelection,
  type TextBetaStorage,
} from '../workflow/text-workflow';
import { NaturalLanguageAdditionVoiceOverlay } from './stt-overlay';
import { NaturalLanguageAdditionSwiftUIPreview } from './stt-ui-preview';

type NaturalLanguageAdditionControllerProps = {
  householdId: string | undefined;
  stores: readonly Store[];
};

export const NaturalLanguageAdditionController = memo(function NaturalLanguageAdditionController({
  householdId,
  stores,
}: NaturalLanguageAdditionControllerProps) {
  const { session } = useSession();
  const { isFeatureEnabled } = useFeatureAccess();
  const speechEnabled = isFeatureEnabled('shoppingStt');
  const userId = session?.user.id;
  const params = useLocalSearchParams<{ action?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [preview, setPreview] = useState<TextBetaPreview | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const voiceLaunchRef = useRef(false);
  const previewRequestIdRef = useRef(0);
  const previewStoreSignatureRef = useRef<string | null>(null);
  const confirmInFlightRef = useRef(false);
  const [nameCorrections, setNameCorrections] = useState<readonly NameCorrection[]>([]);
  const [correctionBusy, setCorrectionBusy] = useState(false);
  const activeUserRef = useRef(userId);
  activeUserRef.current = userId;
  const previewUserRef = useRef(userId);

  useEffect(() => {
    if (speechEnabled) return;

    previewRequestIdRef.current += 1;
    voiceLaunchRef.current = false;
    setVoiceOpen(false);
    setPreview(null);
    setPreviewVisible(false);
    if (params.action === 'voice') router.setParams({ action: undefined });
  }, [params.action, router.setParams, speechEnabled]);

  useEffect(() => {
    if (previewUserRef.current === userId) return;
    previewUserRef.current = userId;
    previewRequestIdRef.current += 1;
    setNameCorrections([]);
    setPreview(null);
    setPreviewVisible(false);
    setVoiceOpen(false);
    voiceLaunchRef.current = false;
  }, [userId]);

  const lists = useMemo(
    () => stores.map((store) => ({ listId: store.id, listName: store.name, knownBrands: [] })),
    [stores],
  );
  const listsSignature = useMemo(
    () => lists.map((list) => `${list.listId}:${list.listName}`).join('\u0001'),
    [lists],
  );
  const storage = useMemo<TextBetaStorage | null>(() => {
    if (!userId) return null;
    return {
      load: () => getNaturalLanguageAdditionBetaState(userId),
      save: (state) => saveNaturalLanguageAdditionBetaState(userId, state),
    };
  }, [userId]);

  const beginPreviewRequest = useCallback((): number => {
    previewRequestIdRef.current += 1;
    return previewRequestIdRef.current;
  }, []);

  function invalidatePreviewRequests() {
    previewRequestIdRef.current += 1;
  }

  const isCurrentPreviewRequest = useCallback(
    (requestId: number): boolean => {
      return previewRequestIdRef.current === requestId && activeUserRef.current === userId;
    },
    [userId],
  );

  const presentPreview = useCallback(
    (nextPreview: TextBetaPreview) => {
      previewStoreSignatureRef.current = listsSignature;
      voiceLaunchRef.current = false;
      setVoiceOpen(false);
      setPreview(nextPreview);
      setPreviewVisible(true);
    },
    [listsSignature],
  );

  useEffect(() => {
    if (!speechEnabled || params.action !== 'voice' || voiceLaunchRef.current) return;

    voiceLaunchRef.current = true;
    debugLogEvent('shopping-list.voice-action.received');
    setVoiceOpen(true);
    router.setParams({ action: undefined });
  }, [params.action, router.setParams, speechEnabled]);

  async function askToEnableAutoAssign(): Promise<void> {
    if (!storage) return;

    let currentState: Awaited<ReturnType<TextBetaStorage['load']>>;
    try {
      currentState = await storage.load();
    } catch {
      return;
    }
    if (currentState.autoAssign !== 'unset') return;

    await new Promise<void>((resolve) => {
      const savePreference = (value: 'on' | 'off') => {
        void storage
          .save(setAutoAssign(currentState, value))
          .catch(() => undefined)
          .finally(resolve);
      };

      Alert.alert(
        'Intelligente Zuordnung',
        'Du hast mehrere Artikel einzelnen Listen zugeordnet. Sollen bekannte Artikel künftig automatisch der passenden Liste zugeordnet werden? Du kannst das jederzeit in den Einstellungen ändern.',
        [
          { text: 'Später', style: 'cancel', onPress: () => savePreference('off') },
          { text: 'Aktivieren', onPress: () => savePreference('on') },
        ],
      );
    });
  }

  function finishSpeechError(message: string) {
    voiceLaunchRef.current = false;
    setVoiceOpen(false);
    Alert.alert('Spracheingabe fehlgeschlagen', message);
  }

  function handleVoiceFallback(result: Exclude<SpeechInputResult, { status: 'transcript' }>) {
    finishSpeechError(result.error);
  }

  function closeVoice() {
    invalidatePreviewRequests();
    voiceLaunchRef.current = false;
    setVoiceOpen(false);
    clearAction();
  }

  function clearAction() {
    if (params.action === 'voice') {
      router.setParams({ action: undefined });
    }
  }

  async function handleInput(input: NaturalLanguageAdditionInput) {
    if (!storage || !userId || lists.length === 0) {
      voiceLaunchRef.current = false;
      setVoiceOpen(false);
      Alert.alert(
        'Spracheingabe nicht verfügbar',
        'Lege zuerst einen Markt für die Einkaufsliste an.',
      );
      return;
    }

    const requestId = beginPreviewRequest();
    const previewStartedAt = performance.now();
    try {
      const [nextPreview, corrections] = await Promise.all([
        createBetaPreview({
          betaSessionId: Crypto.randomUUID(),
          startedAt: new Date().toISOString(),
          lists,
          storage,
          input,
        }),
        getNameCorrections(userId),
      ]);
      if (!isCurrentPreviewRequest(requestId)) return;
      setNameCorrections(corrections);
      debugLogEvent('shopping-list.voice-preview.ready', {
        itemCount: nextPreview.items.length,
        source: input.source,
        durationMs: Math.round(performance.now() - previewStartedAt),
        timestamp: Date.now(),
      });
      presentPreview(nextPreview);
    } catch (error) {
      if (!isCurrentPreviewRequest(requestId)) return;
      voiceLaunchRef.current = false;
      setVoiceOpen(false);
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Spracheingabe fehlgeschlagen', message);
    }
  }

  function dismissPreview() {
    invalidatePreviewRequests();
    setPreviewVisible(false);
    clearAction();
  }

  function requestPreviewClose() {
    if (confirmInFlightRef.current) return;
    dismissPreview();
  }

  function finishPreviewDismiss() {
    invalidatePreviewRequests();
    previewStoreSignatureRef.current = null;
    setPreview(null);
    clearAction();
  }

  async function handleEdit(text: string) {
    if (!preview || !storage || lists.length === 0 || confirmInFlightRef.current) return;

    const requestId = beginPreviewRequest();
    const currentPreview = preview;

    const input: NaturalLanguageAdditionInput =
      currentPreview.input.source === 'speech'
        ? {
            source: 'speech',
            text,
            locale: currentPreview.input.locale,
            onDevice: currentPreview.input.onDevice,
          }
        : { source: 'text', text, locale: null };

    try {
      const nextPreview = await createBetaPreview({
        betaSessionId: currentPreview.session.id,
        startedAt: currentPreview.session.startedAt,
        lists,
        storage,
        input,
      });
      if (!isCurrentPreviewRequest(requestId)) return;
      debugLogEvent('shopping-list.voice-preview.reparsed', {
        itemCount: nextPreview.items.length,
        source: input.source,
      });
      presentPreview(nextPreview);
    } catch (error) {
      if (!isCurrentPreviewRequest(requestId)) return;
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Artikel konnten nicht neu geprüft werden', message);
    }
  }

  async function handleNameCorrection(itemId: string, name: string, remember: boolean) {
    if (!preview || !storage || !userId || confirmInFlightRef.current) return;
    const entry = preview.items.find((item) => item.itemId === itemId);
    if (!entry) return;
    confirmInFlightRef.current = true;
    setCorrectionBusy(true);
    const requestId = beginPreviewRequest();
    try {
      const state = await storage.load();
      if (!isCurrentPreviewRequest(requestId)) return;
      const nextPreview = correctBetaPreviewItem({ preview, itemId, name, lists, state });
      if (remember) {
        const corrections = await updateNameCorrection(
          userId,
          entry.originalName ?? entry.item.name,
          name,
        );
        if (!isCurrentPreviewRequest(requestId)) return;
        setNameCorrections(corrections);
      }
      // Preserve the original list signature so changed markets still require review.
      setPreview(nextPreview);
    } catch (error) {
      if (isCurrentPreviewRequest(requestId)) {
        Alert.alert(
          'Korrektur fehlgeschlagen',
          error instanceof Error ? error.message : String(error),
        );
      }
    } finally {
      confirmInFlightRef.current = false;
      setCorrectionBusy(false);
    }
  }

  async function handleForgetCorrection(original: string) {
    if (!userId || confirmInFlightRef.current) return;
    confirmInFlightRef.current = true;
    setCorrectionBusy(true);
    const requestId = beginPreviewRequest();
    try {
      const corrections = await updateNameCorrection(userId, original, null);
      if (isCurrentPreviewRequest(requestId)) setNameCorrections(corrections);
    } catch (error) {
      if (isCurrentPreviewRequest(requestId)) {
        Alert.alert(
          'Löschen fehlgeschlagen',
          error instanceof Error ? error.message : String(error),
        );
      }
    } finally {
      confirmInFlightRef.current = false;
      setCorrectionBusy(false);
    }
  }

  async function handleConfirm(selections: readonly TextBetaSelection[]) {
    if (!preview || !storage || !householdId || confirmInFlightRef.current) return;

    if (previewStoreSignatureRef.current !== listsSignature) {
      const requestId = beginPreviewRequest();
      try {
        let refreshedPreview = await createBetaPreview({
          betaSessionId: preview.session.id,
          startedAt: preview.session.startedAt,
          lists,
          storage,
          input: preview.input,
        });
        if (!isCurrentPreviewRequest(requestId)) return;
        const state = await storage.load();
        if (!isCurrentPreviewRequest(requestId)) return;
        for (const entry of preview.items) {
          if (entry.originalName === undefined) continue;
          refreshedPreview = correctBetaPreviewItem({
            preview: refreshedPreview,
            itemId: entry.itemId,
            name: entry.item.name,
            lists,
            state,
          });
        }
        presentPreview(refreshedPreview);
        Alert.alert(
          'Einkaufslisten aktualisiert',
          'Die verfügbaren Märkte haben sich geändert. Bitte prüfe die Zuordnung erneut.',
        );
      } catch (error) {
        if (!isCurrentPreviewRequest(requestId)) return;
        const message = error instanceof Error ? error.message : String(error);
        Alert.alert('Artikel konnten nicht neu geprüft werden', message);
      }
      return;
    }

    confirmInFlightRef.current = true;
    const confirmationStartedAt = performance.now();
    try {
      const db = await getDatabase();
      const confirmationResult = await confirmTextBetaItems({
        preview,
        selections,
        availableTargetListIds: lists.map((list) => list.listId),
        storage,
        saveConfirmedOutput: (output) =>
          saveConfirmedBetaOutput({
            db,
            householdId,
            output,
            createItemId: () => Crypto.randomUUID(),
          }),
      });
      debugLogEvent('shopping-list.voice-confirmation.saved', {
        durationMs: Math.round(performance.now() - confirmationStartedAt),
      });
      dismissPreview();
      if (confirmationResult.shouldAskForAutoAssign) {
        void askToEnableAutoAssign();
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['shopping_list_items', householdId] }),
        queryClient.invalidateQueries({ queryKey: ['meal-plan-shopping-needs'] }),
        queryClient.invalidateQueries({ queryKey: ['recipe-shopping-needs'] }),
        queryClient.invalidateQueries({ queryKey: ['sync-status'] }),
      ]).catch(() => {
        debugLogEvent('shopping-list.natural-language-addition.cache-invalidation-failed', {
          hasError: true,
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Artikel konnten nicht hinzugefügt werden', message);
    } finally {
      confirmInFlightRef.current = false;
    }
  }

  return (
    <>
      <NaturalLanguageAdditionVoiceOverlay
        visible={voiceOpen}
        onCancel={closeVoice}
        onTranscript={handleInput}
        onFallback={handleVoiceFallback}
      />

      {preview && storage ? (
        <NaturalLanguageAdditionSwiftUIPreview
          visible={previewVisible}
          preview={preview}
          onRequestClose={requestPreviewClose}
          onDismiss={finishPreviewDismiss}
          onEditText={handleEdit}
          onConfirm={handleConfirm}
          nameCorrections={nameCorrections}
          correctionBusy={correctionBusy}
          onCorrectName={handleNameCorrection}
          onForgetCorrection={handleForgetCorrection}
        />
      ) : null}
    </>
  );
});
