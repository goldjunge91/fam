import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useSession } from '@/features/auth/session-provider';
import { getDatabase } from '@/lib/db/client';
import { debugLogEvent } from '@/lib/observability/debug-log';
import type { Store } from '../../hooks/use-stores';
import {
  getNaturalLanguageAdditionBetaState,
  saveNaturalLanguageAdditionBetaState,
} from '../beta-storage';
import { saveConfirmedBetaOutput } from '../integration/confirmed-output-adapter';
import type { NaturalLanguageAdditionInput, SpeechInputResult } from '../types';
import {
  confirmTextBetaItems,
  createBetaPreview,
  type TextBetaPreview,
  type TextBetaSelection,
  type TextBetaStorage,
} from '../workflow/text-workflow';
import { NaturalLanguageAdditionInputSheet } from './natural-language-addition-input-sheet';
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
  const [inputOpen, setInputOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [networkConsent, setNetworkConsent] = useState(false);
  const [preview, setPreview] = useState<TextBetaPreview | null>(null);
  const voiceLaunchRef = useRef(false);
  const previewLaunchRef = useRef(false);

  const lists = useMemo(
    () => stores.map((store) => ({ listId: store.id, listName: store.name, knownBrands: [] })),
    [stores],
  );
  const storage = useMemo<TextBetaStorage | null>(() => {
    if (!userId) return null;
    return {
      load: () => getNaturalLanguageAdditionBetaState(userId),
      save: (state) => saveNaturalLanguageAdditionBetaState(userId, state),
    };
  }, [userId]);

  useEffect(() => {
    if (params.action !== 'voice' || voiceLaunchRef.current) return;

    voiceLaunchRef.current = true;
    debugLogEvent('shopping-list.voice-action.received');
    setSpeechError(null);
    setVoiceOpen(true);
    router.setParams({ action: undefined });
  }, [params.action, router.setParams]);

  useEffect(() => {
    if (params.action !== 'preview' || previewLaunchRef.current) return;
    if (!storage || lists.length === 0) return;

    previewLaunchRef.current = true;
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
        debugLogEvent('shopping-list.preview-action.ready', {
          itemCount: nextPreview.items.length,
        });
        setInputOpen(false);
        setVoiceOpen(false);
        voiceLaunchRef.current = false;
        setPreview(nextPreview);
      })
      .catch((error) => {
        previewLaunchRef.current = false;
        const message = error instanceof Error ? error.message : String(error);
        debugLogEvent('shopping-list.preview-action.failed', { hasError: true });
        Alert.alert('Preview konnte nicht geöffnet werden', message);
      });
  }, [lists, params.action, router.setParams, storage]);

  async function requestNetworkConsent(): Promise<boolean> {
    if (!storage) return false;

    const currentState = await storage.load();
    if (currentState.consent.contentData === 'granted') {
      setNetworkConsent(true);
      return true;
    }

    return new Promise((resolve) => {
      Alert.alert(
        'Netzwerk-Spracherkennung',
        'Die native Spracherkennung kann deine Sprache an den Sprachdienst des Betriebssystems übertragen. Fam speichert kein Roh-Audio und keine vollständigen Transkripte. Möchtest du für die Beta fortfahren?',
        [
          { text: 'Abbrechen', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Zustimmen',
            onPress: () => {
              void storage
                .save({
                  ...currentState,
                  consent: { ...currentState.consent, contentData: 'granted' },
                })
                .then(() => {
                  setNetworkConsent(true);
                  resolve(true);
                })
                .catch(() => resolve(false));
            },
          },
        ],
      );
    });
  }

  function clearAction() {
    if (params.action === 'voice' || params.action === 'preview') {
      router.setParams({ action: undefined });
    }
  }

  function closeInput() {
    voiceLaunchRef.current = false;
    setInputOpen(false);
    setSpeechError(null);
    clearAction();
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

    try {
      const nextPreview = await createBetaPreview({
        betaSessionId: Crypto.randomUUID(),
        startedAt: new Date().toISOString(),
        lists,
        storage,
        input,
      });
      debugLogEvent('shopping-list.voice-preview.ready', {
        itemCount: nextPreview.items.length,
        source: input.source,
      });
      setVoiceOpen(false);
      setInputOpen(false);
      voiceLaunchRef.current = false;
      setPreview(nextPreview);
    } catch (error) {
      voiceLaunchRef.current = false;
      setVoiceOpen(false);
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Spracheingabe fehlgeschlagen', message);
    }
  }

  function handleVoiceFallback(result: Exclude<SpeechInputResult, { status: 'transcript' }>) {
    if (result.errorCode === 'network-recognition-consent-required') {
      voiceLaunchRef.current = false;
      setVoiceOpen(false);
      void requestNetworkConsent().then((granted) => {
        if (granted) {
          voiceLaunchRef.current = true;
          setSpeechError(null);
          setVoiceOpen(true);
          return;
        }

        setSpeechError(result.error);
        setInputOpen(true);
      });
      return;
    }

    voiceLaunchRef.current = false;
    setVoiceOpen(false);
    setSpeechError(result.error);
    setInputOpen(true);
  }

  function handleInputSpeechFallback(result: Exclude<SpeechInputResult, { status: 'transcript' }>) {
    if (result.errorCode === 'network-recognition-consent-required') {
      void requestNetworkConsent();
    }
  }

  function closeVoice() {
    voiceLaunchRef.current = false;
    setVoiceOpen(false);
    clearAction();
  }

  function closePreview() {
    previewLaunchRef.current = false;
    setPreview(null);
    clearAction();
  }

  async function handleEdit(text: string) {
    if (!preview || !storage || lists.length === 0) return;

    const input: NaturalLanguageAdditionInput =
      preview.input.source === 'speech'
        ? {
            source: 'speech',
            text,
            locale: preview.input.locale,
            onDevice: preview.input.onDevice,
          }
        : { source: 'text', text, locale: null };

    try {
      const nextPreview = await createBetaPreview({
        betaSessionId: preview.session.id,
        startedAt: preview.session.startedAt,
        lists,
        storage,
        input,
      });
      debugLogEvent('shopping-list.voice-preview.reparsed', {
        itemCount: nextPreview.items.length,
        source: input.source,
      });
      setPreview(nextPreview);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Artikel konnten nicht neu geprüft werden', message);
    }
  }

  async function handleConfirm(selections: readonly TextBetaSelection[]) {
    if (!preview || !storage || !householdId) return;

    try {
      const db = await getDatabase();
      await confirmTextBetaItems({
        preview,
        selections,
        storage,
        saveConfirmedOutput: (output) =>
          saveConfirmedBetaOutput({
            db,
            householdId,
            output,
            createItemId: () => Crypto.randomUUID(),
          }),
      });
      closePreview();
      await queryClient.invalidateQueries({ queryKey: ['shopping_list_items', householdId] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Artikel konnten nicht hinzugefügt werden', message);
    }
  }

  return (
    <>
      <NaturalLanguageAdditionInputSheet
        visible={inputOpen}
        onDismiss={closeInput}
        onSubmit={handleInput}
        errorMessage={speechError}
        networkRecognitionConsent={networkConsent}
        onSpeechFallback={handleInputSpeechFallback}
      />

      <NaturalLanguageAdditionVoiceOverlay
        visible={voiceOpen}
        onCancel={closeVoice}
        onTranscript={handleInput}
        onFallback={handleVoiceFallback}
        networkRecognitionConsent={networkConsent}
      />

      {preview ? (
        <NaturalLanguageAdditionSwiftUIPreview
          visible
          preview={preview}
          onDismiss={closePreview}
          onEditText={handleEdit}
          onConfirm={handleConfirm}
        />
      ) : null}
    </>
  );
});
