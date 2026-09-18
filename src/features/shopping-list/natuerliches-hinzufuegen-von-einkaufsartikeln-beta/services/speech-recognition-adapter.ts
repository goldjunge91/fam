import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionNativeEventMap,
  ExpoSpeechRecognitionOptions,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { debugLogEvent } from '@/lib/observability/debug-log';
import type { SpeechInputResult, SpeechInputSegment } from '../types';

export const DEFAULT_SPEECH_LOCALE = 'de-DE' as const;
export const RECOGNITION_STOP_TIMEOUT_MS = 3_000;

type SpeechRecognitionEventName = 'result' | 'error' | 'end' | 'volumechange';
type SpeechRecognitionListener =
  | ((event: ExpoSpeechRecognitionResultEvent) => void)
  | ((event: ExpoSpeechRecognitionErrorEvent) => void)
  | ((event: ExpoSpeechRecognitionNativeEventMap['volumechange']) => void)
  | (() => void);

type EventSubscription = {
  remove: () => void;
};

type SpeechPermissionResponse = {
  granted: boolean;
  status?: string;
  canAskAgain?: boolean;
};

export type SpeechRecognitionClient = {
  requestMicrophonePermissionsAsync: () => Promise<SpeechPermissionResponse>;
  isRecognitionAvailable: () => boolean;
  supportsOnDeviceRecognition: () => boolean;
  start: (options: ExpoSpeechRecognitionOptions) => void;
  stop: () => void;
  abort: () => void;
  addListener: (
    eventName: SpeechRecognitionEventName,
    listener: SpeechRecognitionListener,
  ) => EventSubscription;
};

export type SpeechRecognitionSession = {
  result: Promise<SpeechInputResult>;
  stop: () => void;
  cancel: () => void;
};

export type SpeechRecognitionStartOptions = {
  locale?: string;
  onVolumeChange?: (volume: number) => void;
};

export type SpeechRecognitionAdapter = {
  start: (options?: SpeechRecognitionStartOptions) => SpeechRecognitionSession;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function appendTranscriptChunk(current: string, chunk: string): string {
  const normalizedChunk = chunk.trim();
  if (!normalizedChunk) return current;
  if (!current) return normalizedChunk;
  if (/^\s/u.test(chunk) || /\s$/u.test(current)) return `${current}${chunk}`;
  if (/^[,.;!?]/u.test(normalizedChunk)) return `${current}${normalizedChunk}`;
  return `${current} ${normalizedChunk}`;
}

function fallback(
  status: Exclude<SpeechInputResult, { status: 'transcript' }>['status'],
  locale: string,
  error: string,
  errorCode?: string,
): SpeechInputResult {
  return {
    status,
    text: null,
    locale,
    onDevice: false,
    error,
    ...(errorCode ? { errorCode } : {}),
  };
}

function fallbackForNativeError(
  event: ExpoSpeechRecognitionErrorEvent,
  locale: string,
): SpeechInputResult {
  const errorCode = event.error || 'native-error';

  switch (errorCode) {
    case 'aborted':
      return fallback('cancelled', locale, event.message, errorCode);
    case 'not-allowed':
      return fallback('permission-denied', locale, event.message, errorCode);
    case 'audio-capture':
      return fallback(
        'error',
        locale,
        'Das Mikrofon konnte nicht initialisiert werden. Prüfe, ob keine andere App das Mikrofon verwendet.',
        errorCode,
      );
    case 'language-not-supported':
    case 'service-not-allowed':
      return fallback('capability-unavailable', locale, event.message, errorCode);
    default:
      return fallback('error', locale, event.message, errorCode);
  }
}

export function createSpeechRecognitionAdapter(
  client: SpeechRecognitionClient,
): SpeechRecognitionAdapter {
  // The beta's only supported speech contract is local iOS on-device speech.
  const requiresOnDeviceRecognition = true;

  return {
    start({ locale = DEFAULT_SPEECH_LOCALE, onVolumeChange } = {}) {
      let settled = false;
      let recognitionStarted = false;
      let stopRequested = false;
      let finalTranscript = '';
      let finalSegments: readonly SpeechInputSegment[] = [];
      let latestNativeErrorCode: string | null = null;
      let subscriptions: readonly EventSubscription[] = [];
      let stopTimeout: ReturnType<typeof setTimeout> | null = null;
      let resolveResult!: (result: SpeechInputResult) => void;

      const result = new Promise<SpeechInputResult>((resolve) => {
        resolveResult = resolve;
      });

      const cleanup = () => {
        if (stopTimeout !== null) {
          clearTimeout(stopTimeout);
          stopTimeout = null;
        }
        for (const subscription of subscriptions) subscription.remove();
        subscriptions = [];
      };

      const finish = (nextResult: SpeechInputResult) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolveResult(nextResult);
      };

      const transcriptResult = (): SpeechInputResult => ({
        status: 'transcript',
        text: finalTranscript.trim(),
        locale,
        onDevice: requiresOnDeviceRecognition,
        error: null,
        ...(finalSegments.length > 0 ? { segments: finalSegments } : {}),
      });

      const stop = () => {
        if (settled) return;
        if (!recognitionStarted) {
          stopRequested = true;
          return;
        }
        if (stopTimeout !== null) return;
        try {
          client.stop();
          if (!settled) {
            stopTimeout = setTimeout(() => {
              stopTimeout = null;
              if (settled) return;
              const timeoutResult = fallback(
                'error',
                locale,
                'Die Spracherkennung konnte nicht beendet werden. Bitte versuche es erneut.',
                'recognition-stop-timeout',
              );
              finish(timeoutResult);
              try {
                client.abort();
              } catch {
                // The timeout result remains deterministic for the caller.
              }
            }, RECOGNITION_STOP_TIMEOUT_MS);
          }
        } catch (error) {
          finish(fallback('error', locale, errorMessage(error)));
          try {
            client.abort();
          } catch {
            // The stop failure result is already deterministic for the caller.
          }
        }
      };

      const cancel = () => {
        if (settled) return;
        const shouldAbort = recognitionStarted;
        finish(fallback('cancelled', locale, 'Spracherkennung abgebrochen'));
        if (shouldAbort) {
          try {
            client.abort();
          } catch {
            // The cancellation result is already deterministic for the caller.
          }
        }
      };

      const session = { result, stop, cancel } satisfies SpeechRecognitionSession;

      let recognitionAvailable = false;
      let onDeviceAvailable = true;
      try {
        recognitionAvailable = client.isRecognitionAvailable();
        if (requiresOnDeviceRecognition) {
          onDeviceAvailable = client.supportsOnDeviceRecognition();
        }
      } catch (error) {
        finish(fallback('error', locale, errorMessage(error)));
        return session;
      }

      if (!recognitionAvailable || (requiresOnDeviceRecognition && !onDeviceAvailable)) {
        finish(
          fallback(
            'capability-unavailable',
            locale,
            !recognitionAvailable
              ? 'Spracherkennung nicht verfügbar'
              : 'On-Device-Spracherkennung nicht verfügbar',
          ),
        );
        return session;
      }

      debugLogEvent('shopping-list.voice-permission.requested', { locale });
      const permissionRequest = client.requestMicrophonePermissionsAsync();
      void permissionRequest
        .then((permission) => {
          if (settled) return;

          debugLogEvent('shopping-list.voice-permission.result', {
            granted: permission.granted,
            ...(permission.status ? { status: permission.status } : {}),
            ...(permission.canAskAgain !== undefined
              ? { canAskAgain: permission.canAskAgain }
              : {}),
          });

          if (!permission.granted) {
            finish(
              fallback(
                'permission-denied',
                locale,
                'Sprachberechtigung verweigert',
                'speech-permission-denied',
              ),
            );
            return;
          }

          if (stopRequested) {
            finish(fallback('cancelled', locale, 'Spracherkennung abgebrochen'));
            return;
          }

          try {
            subscriptions = [
              client.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
                const recognitionResult = event.results[0];
                if (!event.isFinal || !recognitionResult) return;

                finalTranscript = appendTranscriptChunk(
                  finalTranscript,
                  recognitionResult.transcript,
                );
                if (recognitionResult.segments.length) {
                  finalSegments = [
                    ...finalSegments,
                    ...recognitionResult.segments.map((segment) => ({
                      startTimeMillis: segment.startTimeMillis,
                      endTimeMillis: segment.endTimeMillis,
                      segment: segment.segment,
                      confidence: segment.confidence,
                    })),
                  ];
                }
              }),
              client.addListener('error', (event: ExpoSpeechRecognitionErrorEvent) => {
                latestNativeErrorCode = event.error;
                debugLogEvent('shopping-list.voice-session.native-error', {
                  ...(event.error ? { errorCode: event.error } : {}),
                  ...(event.code !== undefined ? { nativeCode: event.code } : {}),
                  hasMessage: Boolean(event.message),
                  ...(event.message ? { nativeMessage: event.message.slice(0, 160) } : {}),
                });
                finish(fallbackForNativeError(event, locale));
              }),
              ...(onVolumeChange
                ? [
                    client.addListener(
                      'volumechange',
                      (event: ExpoSpeechRecognitionNativeEventMap['volumechange']) => {
                        onVolumeChange(event.value);
                      },
                    ),
                  ]
                : []),
              client.addListener('end', () => {
                if (finalTranscript.trim()) {
                  finish(transcriptResult());
                  return;
                }
                finish(
                  fallback(
                    'error',
                    locale,
                    'Kein Transkript erhalten',
                    latestNativeErrorCode ?? 'recognition-ended-without-transcript',
                  ),
                );
              }),
            ];
            recognitionStarted = true;
            client.start({
              lang: locale,
              interimResults: true,
              maxAlternatives: 3,
              continuous: true,
              requiresOnDeviceRecognition,
              addsPunctuation: true,
              iosTaskHint: 'dictation',
              ...(onVolumeChange
                ? { volumeChangeEventOptions: { enabled: true, intervalMillis: 100 } }
                : {}),
            });
          } catch (error) {
            finish(fallback('error', locale, errorMessage(error), 'recognition-start-failed'));
          }
        })
        .catch((error: unknown) => {
          finish(fallback('error', locale, errorMessage(error), 'permission-request-failed'));
        });

      return session;
    },
  };
}
