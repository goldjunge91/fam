import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useSession } from '@/features/auth/session-provider';
import { getDatabase } from '@/lib/db/client';
import { debugLogEvent } from '@/lib/observability/debug-log';
import type { Store } from '../../hooks/use-stores';
import {
  getNaturalLanguageAdditionBetaState,
  saveNaturalLanguageAdditionBetaState,
} from '../beta-storage';
import { setBetaConsent } from '../domain/consent';
import { saveConfirmedBetaOutput } from '../integration/confirmed-output-adapter';
import type { NaturalLanguageAdditionInput, SpeechInputResult } from '../types';
import {
  confirmTextBetaItems,
  createBetaPreview,
  type TextBetaPreview,
  type TextBetaSelection,
  type TextBetaStorage,
} from '../workflow/text-workflow';
import { NaturalLanguageAdditionSwiftUIPreview } from './natural-language-addition-swift-ui-preview';
import { NaturalLanguageAdditionVoiceOverlay } from './natural-language-addition-voice-overlay';

type NaturalLanguageAdditionControllerProps = {
  householdId: string | undefined;
  stores: readonly Store[];
};

export const NaturalLanguageAdditionController = memo(function NaturalLanguageAdditionController({
  householdId,
  stores,
}: NaturalLanguageAdditionControllerProps) {
  const { session } = useSession();
  const userId = session?.user.id;
  const params = useLocalSearchParams<{ action?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [preview, setPreview] = useState<TextBetaPreview | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const voiceLaunchRef = useRef(false);
  const previewLaunchRef = useRef(false);
  const previewRequestIdRef = useRef(0);
  const previewStoreSignatureRef = useRef<string | null>(null);
  const confirmInFlightRef = useRef(false);

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

  const isCurrentPreviewRequest = useCallback((requestId: number): boolean => {
    return previewRequestIdRef.current === requestId;
  }, []);

  const presentPreview = useCallback(
    (nextPreview: TextBetaPreview) => {
      previewStoreSignatureRef.current = listsSignature;
      setVoiceOpen(false);
      voiceLaunchRef.current = false;
      setPreview(nextPreview);
      setPreviewVisible(true);
    },
    [listsSignature],
  );

  useEffect(() => {
    if (params.action !== 'voice' || voiceLaunchRef.current) return;

    voiceLaunchRef.current = true;
    debugLogEvent('shopping-list.voice-action.received');
    setVoiceOpen(true);
    router.setParams({ action: undefined });
  }, [params.action, router.setParams]);

  useEffect(() => {
    if (params.action !== 'preview' || previewLaunchRef.current) return;
    if (!storage || lists.length === 0) return;

    previewLaunchRef.current = true;
    const requestId = beginPreviewRequest();
    debugLogEvent('shopping-list.preview-action.received');
    router.setParams({ action: undefined });

    void createBetaPreview({
      betaSessionId: Crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      lists,
      storage,
      input: {
        source: 'text',
        text: 'Kuchen, Eier und Milch',
        locale: null,
      },
    })
      .then((nextPreview) => {
        if (!isCurrentPreviewRequest(requestId)) return;
        debugLogEvent('shopping-list.preview-action.ready', {
          itemCount: nextPreview.items.length,
        });
        presentPreview(nextPreview);
      })
      .catch((error) => {
        if (!isCurrentPreviewRequest(requestId)) return;
        previewLaunchRef.current = false;
        const message = error instanceof Error ? error.message : String(error);
        debugLogEvent('shopping-list.preview-action.failed', { hasError: true });
        Alert.alert('Preview konnte nicht geöffnet werden', message);
      });
  }, [
    beginPreviewRequest,
    isCurrentPreviewRequest,
    lists,
    params.action,
    presentPreview,
    router.setParams,
    storage,
  ]);

  async function requestAutomaticApplicationConsent(): Promise<void> {
    if (!storage) return;

    let currentState: Awaited<ReturnType<TextBetaStorage['load']>>;
    try {
      currentState = await storage.load();
    } catch {
      return;
    }
    if (currentState.consent.automaticApplication !== 'undecided') return;

    await new Promise<void>((resolve) => {
      const saveConsent = (value: 'granted' | 'revoked') => {
        void storage
          .save(setBetaConsent(currentState, 'automaticApplication', value))
          .catch(() => undefined)
          .finally(resolve);
      };

      Alert.alert(
        'Automatische Zuordnung',
        'Du hast mehrere Zuordnungen einzeln bestätigt. Sollen eindeutige bekannte Zuordnungen künftig automatisch angewendet werden? Du kannst diese Entscheidung in den Einstellungen ändern.',
        [
          { text: 'Nicht jetzt', style: 'cancel', onPress: () => saveConsent('revoked') },
          { text: 'Erlauben', onPress: () => saveConsent('granted') },
        ],
      );
    });
  }

  function finishSpeechError(message: string) {
    voiceLaunchRef.current = false;
    setVoiceOpen(false);
    Alert.alert('Spracheingabe fehlgeschlagen', message);
  }

  function clearAction() {
    if (params.action === 'voice' || params.action === 'preview') {
      router.setParams({ action: undefined });
    }
  }

  async function handleInput(input: NaturalLanguageAdditionInput) {
    if (!storage || lists.length === 0) {
      voiceLaunchRef.current = false;
      setVoiceOpen(false);
      Alert.alert(
        'Spracheingabe nicht verfügbar',
        'Lege zuerst einen Markt für die Einkaufsliste an.',
      );
      return;
    }

    const requestId = beginPreviewRequest();
    try {
      const nextPreview = await createBetaPreview({
        betaSessionId: Crypto.randomUUID(),
        startedAt: new Date().toISOString(),
        lists,
        storage,
        input,
      });
      if (!isCurrentPreviewRequest(requestId)) return;
      debugLogEvent('shopping-list.voice-preview.ready', {
        itemCount: nextPreview.items.length,
        source: input.source,
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

  function handleVoiceFallback(result: Exclude<SpeechInputResult, { status: 'transcript' }>) {
    finishSpeechError(result.error);
  }

  function closeVoice() {
    invalidatePreviewRequests();
    voiceLaunchRef.current = false;
    setVoiceOpen(false);
    clearAction();
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
    previewLaunchRef.current = false;
    previewStoreSignatureRef.current = null;
    setPreview(null);
    clearAction();
  }

  async function handleEdit(text: string) {
    if (!preview || !storage || lists.length === 0) return;

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

  async function handleConfirm(selections: readonly TextBetaSelection[]) {
    if (!preview || !storage || !householdId || confirmInFlightRef.current) return;

    if (previewStoreSignatureRef.current !== listsSignature) {
      const requestId = beginPreviewRequest();
      try {
        const refreshedPreview = await createBetaPreview({
          betaSessionId: preview.session.id,
          startedAt: preview.session.startedAt,
          lists,
          storage,
          input: preview.input,
        });
        if (!isCurrentPreviewRequest(requestId)) return;
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
      dismissPreview();
      if (confirmationResult.shouldAskForAutomaticApplication) {
        void requestAutomaticApplicationConsent();
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

      {preview ? (
        <NaturalLanguageAdditionSwiftUIPreview
          visible={previewVisible}
          preview={preview}
          onRequestClose={requestPreviewClose}
          onDismiss={finishPreviewDismiss}
          onEditText={handleEdit}
          onConfirm={handleConfirm}
        />
      ) : null}
    </>
  );
});
