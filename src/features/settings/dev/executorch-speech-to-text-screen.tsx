import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  models,
  useSpeechToText,
  WHISPER_LANGUAGES,
  WHISPER_SAMPLE_RATE_HZ,
  type WhisperLanguage,
} from 'react-native-executorch';

import { Screen } from '@/components/layout/screen';
import { space } from '@/components/theme/index';
import { Card } from '@/components/ui/card';
import { Button, Txt } from '@/constants/ui';
import {
  getDeviceSpeechLocale,
  speechLocaleToLanguageCode,
} from '@/features/shopping-list/stt-beta/services/speech-locale';
import { combineSpeechTranscript } from '@/features/shopping-list/stt-beta/services/speech-transcript';
import { debugLog, debugLogEvent } from '@/lib/observability/debug-log';

import { useExecuTorchAudioRecorder } from './use-executorch-audio-recorder';

const MODEL = models.speechToText.WHISPER.TINY.DEFAULT;

export function ExecuTorchSpeechToTextScreen() {
  const speechLocale = getDeviceSpeechLocale();
  const [modelRequested, setModelRequested] = useState(false);
  const [committedText, setCommittedText] = useState('');
  const [nonCommittedText, setNonCommittedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recorder = useExecuTorchAudioRecorder();
  const streamTaskRef = useRef<Promise<void> | null>(null);
  const stt = useSpeechToText(MODEL, { preventLoad: !modelRequested });

  const stopStreaming = useCallback(async () => {
    await recorder.stopRecording();
    stt.streamStop?.();
  }, [recorder.stopRecording, stt.streamStop]);

  useEffect(() => {
    return () => {
      stt.streamStop?.();
      void recorder.stopRecording();
    };
  }, [recorder.stopRecording, stt.streamStop]);

  const startStreaming = async () => {
    if (recorder.isRecording || !stt.isReady || !stt.stream || !stt.streamInsert) {
      return;
    }

    setError(null);
    setCommittedText('');
    setNonCommittedText('');

    const languageCode = speechLocaleToLanguageCode(speechLocale);
    const whisperLanguage = WHISPER_LANGUAGES.includes(languageCode as WhisperLanguage)
      ? (languageCode as WhisperLanguage)
      : 'en';
    const textStream = stt.stream({ language: whisperLanguage });
    streamTaskRef.current = (async () => {
      try {
        for await (const update of textStream) {
          setCommittedText(update.committed);
          setNonCommittedText(update.nonCommitted);
          const transcript = combineSpeechTranscript(update.committed, update.nonCommitted);
          debugLog(`[SpeechRecognition:whisper] 🎙️ Transkript: ${transcript}`);
          debugLogEvent('shopping-list.voice-session.transcript-update', {
            provider: 'whisper',
            locale: speechLocale,
            hasTranscript: Boolean(transcript),
            isFinal: !update.nonCommitted.trim(),
            textLength: transcript.length,
          });
        }
      } catch (streamError) {
        setError(streamError instanceof Error ? streamError.message : String(streamError));
      } finally {
        streamTaskRef.current = null;
      }
    })();

    try {
      await recorder.startRecording(WHISPER_SAMPLE_RATE_HZ, (samples) => {
        stt.streamInsert?.(samples);
      });
    } catch (recordingError) {
      setError(recordingError instanceof Error ? recordingError.message : String(recordingError));
      await stopStreaming();
    }
  };

  const modelStatus = !modelRequested
    ? 'Nicht geladen'
    : stt.error
      ? `Fehler: ${stt.error.message}`
      : stt.isReady
        ? 'Bereit'
        : `Lade Modell: ${stt.downloadProgress.toFixed(0)} %`;

  return (
    <Screen
      title="ExecuTorch Speech-to-Text"
      subtitle={`Whisper Tiny · lokal auf dem Gerät · ${speechLocale}`}
      back={{ label: 'Entwickler', href: '/settings/dev' }}
      backStyle="icon">
      <Card title="Modell">
        <View style={{ gap: space.md }}>
          <Txt variant="body">{modelStatus}</Txt>
          {!modelRequested ? (
            <Button title="Whisper-Modell laden" onPress={() => setModelRequested(true)} full />
          ) : null}
        </View>
      </Card>

      <Card title="Transkript">
        <Txt variant="body">
          {combineSpeechTranscript(committedText, nonCommittedText) || 'Noch keine Sprache erkannt'}
        </Txt>
      </Card>

      <Card title="Mikrofon">
        <View style={{ gap: space.md }}>
          {error ? <Txt variant="body">{error}</Txt> : null}
          <Txt variant="body">
            Whisper verwendet den Gerätesprachcode „{speechLocaleToLanguageCode(speechLocale)}“.
          </Txt>
          <Button
            title={recorder.isRecording ? 'Aufnahme stoppen' : 'Aufnahme starten'}
            disabled={!stt.isReady}
            onPress={() => void (recorder.isRecording ? stopStreaming() : startStreaming())}
            full
          />
        </View>
      </Card>
    </Screen>
  );
}
