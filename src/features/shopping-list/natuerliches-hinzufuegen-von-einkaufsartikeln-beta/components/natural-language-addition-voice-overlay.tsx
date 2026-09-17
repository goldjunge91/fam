import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { radius, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Surface, Txt } from '@/constants/ui';
import { debugLogEvent } from '@/lib/observability/debug-log';
import { nativeSpeechRecognitionAdapter } from '../services/native-speech-recognition';
import {
  DEFAULT_SPEECH_LOCALE,
  type SpeechRecognitionAdapter,
  type SpeechRecognitionSession,
} from '../services/speech-recognition-adapter';
import type { NaturalLanguageAdditionInput, SpeechInputResult, SpeechInputSegment } from '../types';

type VoiceOverlayStatus = 'listening' | 'processing';

function largestSegmentGapMs(segments: readonly SpeechInputSegment[] | undefined): number | null {
  if (!segments || segments.length < 2) return null;

  let largestGap = 0;
  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1];
    const current = segments[index];
    if (!previous || !current) continue;
    largestGap = Math.max(largestGap, current.startTimeMillis - previous.endTimeMillis);
  }
  return largestGap;
}

export type NaturalLanguageAdditionVoiceOverlayProps = {
  visible: boolean;
  onCancel: () => void;
  onTranscript: (input: NaturalLanguageAdditionInput) => void | Promise<void>;
  onFallback: (result: Exclude<SpeechInputResult, { status: 'transcript' }>) => void;
  speechAdapter?: SpeechRecognitionAdapter;
  networkRecognitionConsent?: boolean;
  locale?: string;
};

export function NaturalLanguageAdditionVoiceOverlay({
  visible,
  onCancel,
  onTranscript,
  onFallback,
  speechAdapter = nativeSpeechRecognitionAdapter,
  networkRecognitionConsent = false,
  locale = DEFAULT_SPEECH_LOCALE,
}: NaturalLanguageAdditionVoiceOverlayProps) {
  const { colors } = useTheme();
  const [status, setStatus] = useState<VoiceOverlayStatus>('listening');
  const sessionRef = useRef<SpeechRecognitionSession | null>(null);
  const disposedRef = useRef(true);
  const onTranscriptRef = useRef(onTranscript);
  const onFallbackRef = useRef(onFallback);

  onTranscriptRef.current = onTranscript;
  onFallbackRef.current = onFallback;

  const fail = (error: unknown) => {
    if (disposedRef.current) return;
    const message = error instanceof Error ? error.message : String(error);
    setStatus('listening');
    onFallbackRef.current({
      status: 'error',
      text: null,
      locale,
      onDevice: false,
      error: message,
      errorCode: 'voice-session-failed',
    });
  };

  const startSession = () => {
    if (!visible || disposedRef.current || sessionRef.current) return;

    try {
      debugLogEvent('shopping-list.voice-session.starting', { locale });
      const session = speechAdapter.start({ locale, networkRecognitionConsent });
      sessionRef.current = session;
      void session.result
        .then(async (result) => {
          if (disposedRef.current || sessionRef.current !== session) return;
          sessionRef.current = null;
          debugLogEvent('shopping-list.voice-session.result', {
            status: result.status,
            ...(result.status === 'transcript'
              ? {
                  segmentCount: result.segments?.length ?? 0,
                  largestPauseMs: largestSegmentGapMs(result.segments),
                }
              : {}),
            ...(result.status !== 'transcript' && result.errorCode
              ? { errorCode: result.errorCode }
              : {}),
          });

          if (result.status !== 'transcript') {
            setStatus('listening');
            onFallbackRef.current(result);
            return;
          }

          setStatus('processing');
          try {
            await onTranscriptRef.current({
              source: 'speech',
              text: result.text,
              locale: result.locale,
              onDevice: result.onDevice,
              ...(result.segments ? { segments: result.segments } : {}),
            });
          } catch (error) {
            debugLogEvent('shopping-list.voice-preview.failed', { hasError: Boolean(error) });
            fail(error);
          }
        })
        .catch((error: unknown) => {
          debugLogEvent('shopping-list.voice-session.failed', { hasError: Boolean(error) });
          fail(error);
        });
    } catch (error) {
      debugLogEvent('shopping-list.voice-session.failed', { hasError: Boolean(error) });
      fail(error);
    }
  };

  const finishSession = () => {
    const session = sessionRef.current;
    if (!session || status !== 'listening') return;

    setStatus('processing');
    try {
      session.stop();
    } catch (error) {
      sessionRef.current = null;
      fail(error);
    }
  };

  useEffect(() => {
    if (!visible) return;

    disposedRef.current = false;
    setStatus('listening');
    debugLogEvent('shopping-list.voice-overlay.opened', { locale });

    return () => {
      disposedRef.current = true;
      if (sessionRef.current) {
        sessionRef.current.cancel();
        sessionRef.current = null;
      }
    };
  }, [locale, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      onShow={startSession}
      accessibilityViewIsModal>
      <View style={[styles.overlay, { backgroundColor: withAlpha(colors.shadowCard, 0.42) }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={status === 'listening' ? onCancel : undefined}
          accessibilityRole="button"
          accessibilityLabel="Spracheingabe schließen"
        />
        <Surface tone="surface" style={styles.panel}>
          <View style={[styles.micOrb, { backgroundColor: colors.accent }]}>
            {status === 'processing' ? (
              <ActivityIndicator color={colors.backgroundElement} size="large" />
            ) : (
              <Feather name="mic" size={34} color={colors.backgroundElement} />
            )}
          </View>
          <Txt variant="title" style={styles.centerText}>
            {status === 'processing' ? 'Ich verarbeite das …' : 'Ich höre zu'}
          </Txt>
          <Txt variant="body" tone="secondary" style={styles.centerText}>
            {status === 'processing'
              ? 'Die Artikelliste wird gerade vorbereitet.'
              : 'Nenne mehrere Einkaufsartikel. Wenn du fertig bist, tippe auf Fertig.'}
          </Txt>
          <Button title="Fertig" onPress={finishSession} disabled={status === 'processing'} full />
          <Button
            title="Abbrechen"
            variant="secondary"
            onPress={onCancel}
            disabled={status === 'processing'}
            full
          />
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: space.lg,
  },
  panel: {
    alignItems: 'center',
    gap: theme.space.md,
    padding: theme.space.xl,
    paddingBottom: theme.space.xxl,
    borderRadius: radius.xl,
    boxShadow: `0 12px 32px ${withAlpha(theme.shadowCard, 0.24)}`,
  },
  micOrb: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.space.sm,
  },
  centerText: {
    textAlign: 'center',
  },
}));
