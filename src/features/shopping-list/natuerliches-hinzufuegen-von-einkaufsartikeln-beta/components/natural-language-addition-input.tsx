import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, TextField, Txt } from '@/constants/ui';
import {
  DEFAULT_SPEECH_LOCALE,
  type SpeechRecognitionAdapter,
  type SpeechRecognitionSession,
} from '../services/speech-recognition-adapter';
import type {
  NaturalLanguageAdditionInput as NaturalLanguageAdditionInputContract,
  SpeechInputResult,
} from '../types';

export type NaturalLanguageAdditionInputProps = {
  speechAdapter: SpeechRecognitionAdapter;
  onSubmit: (input: NaturalLanguageAdditionInputContract) => void;
  onSpeechFallback?: (result: Exclude<SpeechInputResult, { status: 'transcript' }>) => void;
  networkRecognitionConsent?: boolean;
  locale?: string;
};

export function NaturalLanguageAdditionInput({
  speechAdapter,
  onSubmit,
  onSpeechFallback,
  networkRecognitionConsent = false,
  locale = DEFAULT_SPEECH_LOCALE,
}: NaturalLanguageAdditionInputProps) {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const sessionRef = useRef<SpeechRecognitionSession | null>(null);

  useEffect(
    () => () => {
      sessionRef.current?.cancel();
      sessionRef.current = null;
    },
    [],
  );

  const submitText = () => {
    const nextText = text.trim();
    if (!nextText) return;
    onSubmit({ source: 'text', text: nextText, locale: null });
  };

  const handleSpeechResult = (session: SpeechRecognitionSession, result: SpeechInputResult) => {
    if (sessionRef.current !== session) return;
    sessionRef.current = null;
    setIsListening(false);

    if (result.status === 'transcript') {
      setSpeechError(null);
      onSubmit({
        source: 'speech',
        text: result.text,
        locale: result.locale,
        onDevice: result.onDevice,
        ...(result.segments ? { segments: result.segments } : {}),
      });
      return;
    }

    setSpeechError(result.error);
    onSpeechFallback?.(result);
  };

  const toggleSpeech = () => {
    const activeSession = sessionRef.current;
    if (activeSession) {
      activeSession.stop();
      return;
    }

    setSpeechError(null);
    try {
      const session = speechAdapter.start({ locale, networkRecognitionConsent });
      sessionRef.current = session;
      setIsListening(true);
      void session.result.then((result) => handleSpeechResult(session, result));
    } catch (error) {
      setIsListening(false);
      const message = error instanceof Error ? error.message : String(error);
      setSpeechError(message);
    }
  };

  return (
    <View style={styles.root}>
      <TextField
        label="Artikel hinzufügen"
        value={text}
        onChangeText={setText}
        placeholder="z. B. 3 Äpfel und Brot"
        onSubmitEditing={submitText}
        returnKeyType="done"
        accessibilityLabel="Artikel hinzufügen"
      />
      {isListening ? (
        <Txt variant="caption" tone="accent">
          Aufnahme läuft … tippe zum Stoppen.
        </Txt>
      ) : null}
      {speechError ? (
        <Txt variant="caption" tone="danger" accessibilityRole="alert">
          {speechError}
        </Txt>
      ) : null}
      <Button
        title={isListening ? 'Aufnahme stoppen' : 'Spracheingabe'}
        accessibilityLabel={isListening ? 'Aufnahme stoppen' : 'Spracheingabe'}
        icon={isListening ? 'square' : 'mic'}
        variant={isListening ? 'danger' : 'secondary'}
        flat
        onPress={toggleSpeech}
        full
      />
      <Button title="Artikel prüfen" onPress={submitText} full disabled={!text.trim()} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.space.sm,
  },
}));
