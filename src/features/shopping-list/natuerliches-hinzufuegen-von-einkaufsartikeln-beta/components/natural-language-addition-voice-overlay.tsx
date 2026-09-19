import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { radius, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Surface, Txt } from '@/constants/ui';
import { debugLogEvent } from '@/lib/observability/debug-log';
import type { ExperimentVariant } from '../domain/speech-experiment';
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

function normalizeSpeechVolume(volume: number): number {
  if (!Number.isFinite(volume) || volume <= 0) return 0;
  return Math.min(1, volume / 6);
}

export type NaturalLanguageAdditionVoiceOverlayProps = {
  visible: boolean;
  onCancel: () => void;
  onTranscript: (input: NaturalLanguageAdditionInput) => void | Promise<void>;
  onFallback: (result: Exclude<SpeechInputResult, { status: 'transcript' }>) => void;
  speechAdapter?: SpeechRecognitionAdapter;
  locale?: string;
  variant?: ExperimentVariant;
};

export function NaturalLanguageAdditionVoiceOverlay({
  visible,
  onCancel,
  onTranscript,
  onFallback,
  speechAdapter = nativeSpeechRecognitionAdapter,
  locale = DEFAULT_SPEECH_LOCALE,
  variant = 'baseline',
}: NaturalLanguageAdditionVoiceOverlayProps) {
  const { colors } = useTheme();
  const [status, setStatus] = useState<VoiceOverlayStatus>('listening');
  const reducedMotion = useReducedMotion();
  const listeningIntensity = useSharedValue(0);
  const sessionRef = useRef<SpeechRecognitionSession | null>(null);
  const disposedRef = useRef(true);
  const listeningActiveRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  const onFallbackRef = useRef(onFallback);

  useEffect(() => {
    listeningActiveRef.current = visible && status === 'listening';
    if (!listeningActiveRef.current) {
      cancelAnimation(listeningIntensity);
      listeningIntensity.value = withTiming(0, { duration: 180 });
    }

    return () => {
      listeningActiveRef.current = false;
      cancelAnimation(listeningIntensity);
    };
  }, [listeningIntensity, status, visible]);

  onTranscriptRef.current = onTranscript;
  onFallbackRef.current = onFallback;

  const handleVolumeChange = (volume: number) => {
    if (!listeningActiveRef.current || reducedMotion) return;

    listeningIntensity.value = withSpring(normalizeSpeechVolume(volume), {
      damping: 20,
      stiffness: 120,
      mass: 0.8,
      overshootClamping: true,
    });
  };

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
      const session = speechAdapter.start({
        locale,
        variant,
        onVolumeChange: reducedMotion ? undefined : handleVolumeChange,
      });
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
    debugLogEvent('shopping-list.voice-session.finish.requested', {
      status,
      hasSession: Boolean(session),
    });
    if (!session || status !== 'listening') return;

    listeningActiveRef.current = false;
    cancelAnimation(listeningIntensity);
    listeningIntensity.value = withTiming(0, { duration: 180 });
    setStatus('processing');
    try {
      session.stop();
      debugLogEvent('shopping-list.voice-session.finish.stop-called');
    } catch (error) {
      sessionRef.current = null;
      fail(error);
    }
  };

  const micOrbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + listeningIntensity.value * 0.08 }],
  }));
  const micIconStyle = useAnimatedStyle(() => ({
    opacity: 0.84 + listeningIntensity.value * 0.16,
    transform: [{ scale: 1 + listeningIntensity.value * 0.1 }],
  }));
  const micPulseRingStyle = useAnimatedStyle(() => ({
    opacity: listeningIntensity.value * 0.48,
    transform: [{ scale: 1 + listeningIntensity.value * 0.42 }],
  }));

  useEffect(() => {
    if (!visible) return;

    disposedRef.current = false;
    setStatus('listening');
    debugLogEvent('shopping-list.voice-overlay.opened', { locale });

    return () => {
      disposedRef.current = true;
      if (sessionRef.current) {
        debugLogEvent('shopping-list.voice-session.unmounted-with-session');
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
          <View style={styles.micStage}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.micPulseRing,
                { borderColor: withAlpha(colors.accent, 0.5) },
                micPulseRingStyle,
              ]}
            />
            <Animated.View style={[styles.micOrb, { backgroundColor: colors.accent }, micOrbStyle]}>
              {status === 'processing' ? (
                <ActivityIndicator color={colors.backgroundElement} size="large" />
              ) : (
                <Animated.View style={micIconStyle}>
                  <Feather name="mic" size={34} color={colors.backgroundElement} />
                </Animated.View>
              )}
            </Animated.View>
          </View>
          <Txt variant="title" style={styles.centerText}>
            {status === 'processing' ? 'Ich verarbeite das …' : 'Ich höre zu'}
          </Txt>
          <Txt variant="body" tone="secondary" style={styles.centerText}>
            {status === 'processing'
              ? 'Die Artikelliste wird gerade vorbereitet.'
              : 'Nenne mehrere Einkaufsartikel. Wenn du fertig bist, tippe auf Fertig.'}
          </Txt>
          <Button
            title="Fertig"
            testID="Fertig"
            onPress={finishSession}
            disabled={status === 'processing'}
            full
          />
          <Button
            title="Abbrechen"
            testID="Abbrechen"
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
  },
  micStage: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.space.sm,
  },
  micPulseRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    borderWidth: theme.borderWidth.base,
  },
  centerText: {
    textAlign: 'center',
  },
}));
