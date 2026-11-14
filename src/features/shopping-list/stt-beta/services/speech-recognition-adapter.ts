import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionNativeEventMap,
  ExpoSpeechRecognitionOptions,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { Platform } from 'react-native';
import { debugLogEvent } from '@/lib/observability/debug-log';
import type { SpeechInputResult } from '../types';
import { getDeviceSpeechLocale } from './speech-locale';

export const REQUIRES_ON_DEVICE_RECOGNITION = false;
export const DEFAULT_SPEECH_LOCALE = getDeviceSpeechLocale();
export const RECOGNITION_STOP_TIMEOUT_MS = 3_000;
export const CONTEXTUAL_STRING_LIST = ['Skyr', 'Passata', 'Kidneybohnen', 'Erythrit'];
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
  requestSpeechRecognizerPermissionsAsync: () => Promise<SpeechPermissionResponse>;
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
  continuous?: boolean;
};

export type SpeechRecognitionPreflightResult =
  | { status: 'ready' }
  | {
      status: 'capability-unavailable' | 'permission-denied' | 'error';
      error: string;
      errorCode?: string;
    };

export type SpeechRecognitionAdapter = {
  prepare?: (options?: { locale?: string }) => Promise<SpeechRecognitionPreflightResult>;
  start: (options?: SpeechRecognitionStartOptions) => SpeechRecognitionSession;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function speechTrace(event: string, details: Record<string, unknown> = {}): void {
  debugLogEvent(`shopping-list.voice-session.trace.${event}`, {
    timestamp: Date.now(),
    ...details,
  });
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
  // Network-backed recognition is allowed when the user grants iOS speech permission.
  const requiresOnDeviceRecognition = REQUIRES_ON_DEVICE_RECOGNITION;

  let permissionsPrepared = false;
  const prepare = async ({ locale = getDeviceSpeechLocale() }: { locale?: string } = {}) => {
    if (permissionsPrepared) return { status: 'ready' } as const;

    let recognitionAvailable = false;
    let onDeviceAvailable = true;
    try {
      recognitionAvailable = client.isRecognitionAvailable();
      if (requiresOnDeviceRecognition) {
        onDeviceAvailable = client.supportsOnDeviceRecognition();
      }
      speechTrace('capability.checked', { recognitionAvailable, onDeviceAvailable });
    } catch (error) {
      return { status: 'error' as const, error: errorMessage(error) };
    }

    if (!recognitionAvailable || (requiresOnDeviceRecognition && !onDeviceAvailable)) {
      return {
        status: 'capability-unavailable' as const,
        error: !recognitionAvailable
          ? 'Spracherkennung nicht verfügbar'
          : 'On-Device-Spracherkennung nicht verfügbar',
      };
    }

    try {
      debugLogEvent('shopping-list.voice-permission.requested', { locale });
      const permission = await client.requestMicrophonePermissionsAsync();
      debugLogEvent('shopping-list.voice-permission.result', {
        granted: permission.granted,
        ...(permission.status ? { status: permission.status } : {}),
        ...(permission.canAskAgain !== undefined ? { canAskAgain: permission.canAskAgain } : {}),
      });

      if (!permission.granted) {
        return {
          status: 'permission-denied' as const,
          error: 'Sprachberechtigung verweigert',
          errorCode: 'speech-permission-denied',
        };
      }

      if (!requiresOnDeviceRecognition && Platform.OS === 'ios') {
        const speechPermission = await client.requestSpeechRecognizerPermissionsAsync();
        if (!speechPermission.granted) {
          return {
            status: 'permission-denied' as const,
            error: 'Spracherkennung nicht freigegeben',
            errorCode: 'speech-recognition-permission-denied',
          };
        }
      }

      permissionsPrepared = true;
      return { status: 'ready' } as const;
    } catch (error) {
      return {
        status: 'error' as const,
        error: errorMessage(error),
        errorCode: 'permission-request-failed',
      };
    }
  };

  return {
    prepare,
    start({ locale = getDeviceSpeechLocale(), onVolumeChange, continuous = true } = {}) {
      let settled = false;
      let recognitionStarted = false;
      let stopRequested = false;
      let finalTranscript = '';
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
        if (settled) {
          speechTrace('finish.ignored', { status: nextResult.status, reason: 'already-settled' });
          return;
        }
        settled = true;
        cleanup();
        speechTrace('finished', {
          status: nextResult.status,
          ...(nextResult.status === 'transcript'
            ? {
                hasTranscript: Boolean(nextResult.text.trim()),
              }
            : {
                ...(nextResult.errorCode ? { errorCode: nextResult.errorCode } : {}),
              }),
        });
        resolveResult(nextResult);
      };

      const transcriptResult = (): SpeechInputResult => ({
        status: 'transcript',
        text: finalTranscript.trim(),
        locale,
        onDevice: requiresOnDeviceRecognition,
        error: null,
      });

      const stop = () => {
        speechTrace('stop.requested', {
          settled,
          recognitionStarted,
          stopRequested,
          stopPending: stopTimeout !== null,
        });
        if (settled) return;
        if (!recognitionStarted) {
          stopRequested = true;
          speechTrace('stop.deferred-before-native-start');
          return;
        }
        if (stopTimeout !== null) {
          speechTrace('stop.ignored', { reason: 'already-pending' });
          return;
        }
        try {
          speechTrace('native.stop.called');
          client.stop();
          speechTrace('native.stop.returned', { settled });
          if (!settled) {
            stopTimeout = setTimeout(() => {
              stopTimeout = null;
              if (settled) return;
              speechTrace('stop.timeout', { timeoutMs: RECOGNITION_STOP_TIMEOUT_MS });
              const timeoutResult = fallback(
                'error',
                locale,
                'Die Spracherkennung konnte nicht beendet werden. Bitte versuche es erneut.',
                'recognition-stop-timeout',
              );
              finish(timeoutResult);
              try {
                speechTrace('native.abort.called', { reason: 'stop-timeout' });
                client.abort();
              } catch {
                // The timeout result remains deterministic for the caller.
              }
            }, RECOGNITION_STOP_TIMEOUT_MS);
          }
        } catch (error) {
          finish(fallback('error', locale, errorMessage(error)));
          try {
            speechTrace('native.abort.called', { reason: 'stop-threw' });
            client.abort();
          } catch {
            // The stop failure result is already deterministic for the caller.
          }
        }
      };

      const cancel = () => {
        speechTrace('cancel.requested', { settled, recognitionStarted });
        if (settled) return;
        const shouldAbort = recognitionStarted;
        finish(fallback('cancelled', locale, 'Spracherkennung abgebrochen'));
        if (shouldAbort) {
          try {
            speechTrace('native.abort.called', { reason: 'cancelled' });
            client.abort();
          } catch {
            // The cancellation result is already deterministic for the caller.
          }
        }
      };

      const session = { result, stop, cancel } satisfies SpeechRecognitionSession;

      const permissionRequest = permissionsPrepared
        ? Promise.resolve({ status: 'ready' as const })
        : prepare({ locale });
      void permissionRequest
        .then((preflight) => {
          if (settled) return;

          if (preflight.status !== 'ready') {
            finish(fallback(preflight.status, locale, preflight.error, preflight.errorCode));
            return;
          }

          permissionsPrepared = false;
          if (stopRequested) {
            speechTrace('stop.observed-before-native-start');
            finish(fallback('cancelled', locale, 'Spracherkennung abgebrochen'));
            return;
          }

          try {
            subscriptions = [
              client.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
                const recognitionResult = event.results[0];
                if (!event.isFinal || !recognitionResult) return;

                speechTrace('native.result.final', {
                  hasTranscript: Boolean(recognitionResult.transcript.trim()),
                });

                finalTranscript = appendTranscriptChunk(
                  finalTranscript,
                  recognitionResult.transcript,
                );

                if (!continuous && finalTranscript.trim()) {
                  finish(transcriptResult());
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
                speechTrace('native.error.received', {
                  ...(event.error ? { errorCode: event.error } : {}),
                  ...(event.code !== undefined ? { nativeCode: event.code } : {}),
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
                speechTrace('native.end.received', {
                  hasTranscript: Boolean(finalTranscript.trim()),
                });
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
            speechTrace('native.start.called', { locale });
            client.start({
              lang: locale,
              contextualStrings: CONTEXTUAL_STRING_LIST,
              interimResults: false,
              maxAlternatives: 1,
              continuous,
              requiresOnDeviceRecognition,
              addsPunctuation: true,
              iosTaskHint: 'dictation',
              ...(onVolumeChange
                ? { volumeChangeEventOptions: { enabled: true, intervalMillis: 100 } }
                : {}),
            });
            speechTrace('native.start.returned');
          } catch (error) {
            speechTrace('native.start.threw');
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
