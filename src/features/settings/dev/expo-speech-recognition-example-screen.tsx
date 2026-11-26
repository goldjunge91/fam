import { Redirect } from 'expo-router';
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionOptions,
} from 'expo-speech-recognition';
import {
  ExpoSpeechRecognitionModule,
  SpeechRecognizerErrorAndroid,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { space } from '@/components/theme/index';
import { ContentCard } from '@/components/ui/content-card';
import { Button, Txt } from '@/constants/ui';
import { useDevToolsAccess } from '@/hooks/use-dev-tools-access';
import { debugLog } from '@/lib/observability/debug-log';

const INITIAL_SETTINGS: ExpoSpeechRecognitionOptions = {
  lang: 'de-DE',
  interimResults: true,
  maxAlternatives: 3,
  continuous: true,
  requiresOnDeviceRecognition: false,
  addsPunctuation: true,
  contextualStrings: ['expo-speech-recognition', 'Carlsen', 'Ian Nepomniachtchi', 'Praggnanandhaa'],
  volumeChangeEventOptions: {
    enabled: false,
    intervalMillis: 300,
  },
};

type RecognitionStatus = 'idle' | 'starting' | 'recognizing';

export function ExpoSpeechRecognitionExampleScreen() {
  const { t } = useTranslation();
  const hasAccess = useDevToolsAccess();
  const [error, setError] = useState<ExpoSpeechRecognitionErrorEvent | null>(null);
  const transcriptTallyRef = useRef('');
  const [transcription, setTranscription] = useState('');
  const [status, setStatus] = useState<RecognitionStatus>('idle');
  const [settings] = useState<ExpoSpeechRecognitionOptions>(INITIAL_SETTINGS);

  useSpeechRecognitionEvent('result', (event) => {
    debugLog('[expo-example:event]: result', {
      isFinal: event.isFinal,
      transcripts: event.results.map((result) => result.transcript),
    });

    const transcript = event.results[0]?.transcript || '';

    if (event.isFinal) {
      transcriptTallyRef.current += transcript;
      setTranscription(transcriptTallyRef.current);
    } else {
      setTranscription(transcriptTallyRef.current + transcript);
    }
  });

  useSpeechRecognitionEvent('start', () => {
    transcriptTallyRef.current = '';
    setTranscription('');
    setStatus('recognizing');
  });

  useSpeechRecognitionEvent('end', () => {
    debugLog('[expo-example:event]: end');
    setStatus('idle');
  });

  useSpeechRecognitionEvent('audiostart', (event) => {
    debugLog('[expo-example:event]: audiostart', event);
  });

  useSpeechRecognitionEvent('audioend', (event) => {
    debugLog('[expo-example:event]: audioend', event);
  });

  useSpeechRecognitionEvent('error', (event) => {
    debugLog(
      '[expo-example:event]: error',
      event.error,
      event.message,
      event.code ? `code: ${event.code}` : '',
    );

    switch (event.code) {
      case SpeechRecognizerErrorAndroid.ERROR_NETWORK_TIMEOUT:
      case SpeechRecognizerErrorAndroid.ERROR_TOO_MANY_REQUESTS:
      case -1:
        break;
    }

    setError(event);
    setStatus('idle');
  });

  useSpeechRecognitionEvent('nomatch', () => {
    debugLog('[expo-example:event]: nomatch');
  });

  useSpeechRecognitionEvent('languagedetection', (event) => {
    debugLog('[expo-example:event]: languagedetection', event);
  });

  const startListening = async () => {
    if (status !== 'idle') return;

    transcriptTallyRef.current = '';
    setTranscription('');
    setError(null);
    setStatus('starting');

    const microphonePermissions =
      await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
    debugLog('Microphone permissions', microphonePermissions);
    if (!microphonePermissions.granted) {
      setError({ error: 'not-allowed', message: t('dev.speech.permissionDenied') });
      setStatus('idle');
      return;
    }

    if (!settings.requiresOnDeviceRecognition && Platform.OS === 'ios') {
      const speechRecognizerPermissions =
        await ExpoSpeechRecognitionModule.requestSpeechRecognizerPermissionsAsync();
      debugLog('Speech recognizer permissions', speechRecognizerPermissions);
      if (!speechRecognizerPermissions.granted) {
        setError({
          error: 'not-allowed',
          message: speechRecognizerPermissions.restricted
            ? t('dev.speech.restricted')
            : t('dev.speech.permissionDenied'),
        });
        setStatus('idle');
        return;
      }
    }

    debugLog(settings);
    ExpoSpeechRecognitionModule.start(settings);
  };

  if (!hasAccess) {
    return <Redirect href="/settings" />;
  }

  return (
    <Screen
      title={t('dev.speech.title')}
      subtitle={t('dev.speech.subtitle')}
      back={{ label: t('dev.tools.title'), href: '/settings/dev' }}
      backStyle="icon">
      <ContentCard title={t('dev.speech.error')}>
        <Txt variant="body">{error ? JSON.stringify(error) : t('dev.speech.noErrors')}</Txt>
      </ContentCard>

      <ContentCard title={t('dev.speech.status')}>
        <Txt variant="body">{status}</Txt>
        <Txt variant="body">{transcription || t('dev.speech.noTranscript')}</Txt>
      </ContentCard>

      <ContentCard title={t('dev.speech.officialStart')}>
        <View style={{ gap: space.md }}>
          {status === 'idle' ? (
            <Button title={t('dev.speech.start')} onPress={() => void startListening()} full />
          ) : (
            <View style={{ gap: space.md }}>
              <Button
                title={t('dev.speech.stop')}
                disabled={status !== 'recognizing'}
                onPress={() => ExpoSpeechRecognitionModule.stop()}
                full
              />
              <Button
                title={t('dev.speech.abort')}
                variant="secondary"
                disabled={status !== 'recognizing'}
                onPress={() => ExpoSpeechRecognitionModule.abort()}
                full
              />
            </View>
          )}
        </View>
      </ContentCard>
    </Screen>
  );
}
