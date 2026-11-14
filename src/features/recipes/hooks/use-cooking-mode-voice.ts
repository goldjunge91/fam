import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DEFAULT_SPEECH_LOCALE,
  type SpeechRecognitionAdapter,
  type SpeechRecognitionSession,
} from '@/features/shopping-list/stt-beta/services/speech-recognition-adapter';
import { parseCookingVoiceCommand } from '../domain/cooking-voice-commands';
import type { MentionableIngredient } from '../domain/ingredient-mentions';

export type CookingModeVoiceStatus =
  | 'ready'
  | 'reading'
  | 'listening'
  | 'processing'
  | 'paused'
  | 'denied'
  | 'unavailable'
  | 'error';

export type CookingModeVoiceSpeechOptions = {
  language: string;
  onStart?: () => void;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: Error) => void;
};

export type CookingModeVoiceSpeech = {
  speak: (text: string, options: CookingModeVoiceSpeechOptions) => void;
  stop: () => Promise<void> | void;
};

const defaultAdapter: SpeechRecognitionAdapter = {
  prepare: (options) => {
    const { nativeSpeechRecognitionAdapter } =
      require('@/features/shopping-list/stt-beta/services/native-speech-recognition') as typeof import('@/features/shopping-list/stt-beta/services/native-speech-recognition');
    return (
      nativeSpeechRecognitionAdapter.prepare?.(options) ??
      Promise.resolve({ status: 'ready' as const })
    );
  },
  start: (options) => {
    const { nativeSpeechRecognitionAdapter } =
      require('@/features/shopping-list/stt-beta/services/native-speech-recognition') as typeof import('@/features/shopping-list/stt-beta/services/native-speech-recognition');
    return nativeSpeechRecognitionAdapter.start(options);
  },
};

const defaultSpeech: CookingModeVoiceSpeech = {
  speak: (text, options) => Speech.speak(text, options),
  stop: () => Speech.stop(),
};

export type UseCookingModeVoiceOptions = {
  stepId: string;
  currentStepText: string;
  stepIngredients: readonly MentionableIngredient[];
  locale?: string;
  adapter?: SpeechRecognitionAdapter;
  speech?: CookingModeVoiceSpeech;
  onNextStep?: () => void;
  onPreviousStep?: () => boolean | undefined;
  onStartTimer?: (durationSeconds?: number) => void;
  onPauseHandsFree?: (pause: () => void) => void;
  onFinish?: () => void;
};

export type CookingModeVoice = {
  status: CookingModeVoiceStatus;
  transcript: string | null;
  error: string | null;
  handsFreeEnabled: boolean;
  readStep: () => void;
  readIngredients: () => void;
  stopReading: () => void;
  startListening: () => void;
  stopListening: () => void;
  startHandsFree: () => void;
  pauseHandsFree: () => void;
  resumeHandsFree: () => void;
  endHandsFree: () => void;
  onNextStep: () => void;
  onPreviousStep: () => void;
  onStartTimer: () => void;
  onFinish: () => void;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ingredientSpeechText(ingredients: readonly MentionableIngredient[]): string {
  if (ingredients.length === 0) return 'Für diesen Schritt sind keine Zutaten verknüpft.';

  return `Zutaten für diesen Schritt: ${ingredients
    .map((ingredient) => {
      const quantity = Number.isFinite(ingredient.quantity) && ingredient.quantity > 0;
      return quantity
        ? `${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`
        : ingredient.name;
    })
    .join(', ')}.`;
}

function statusForResult(status: string): CookingModeVoiceStatus {
  if (status === 'permission-denied') return 'denied';
  if (status === 'capability-unavailable') return 'unavailable';
  if (status === 'cancelled') return 'ready';
  return 'error';
}

/**
 * Owns speech only for the guided Plus tree. It never starts recognition or TTS during setup.
 */
export function useCookingModeVoice({
  stepId,
  currentStepText,
  stepIngredients,
  locale = DEFAULT_SPEECH_LOCALE,
  adapter = defaultAdapter,
  speech = defaultSpeech,
  onNextStep,
  onPreviousStep,
  onStartTimer,
  onPauseHandsFree,
  onFinish,
}: UseCookingModeVoiceOptions): CookingModeVoice {
  const optionsRef = useRef({
    currentStepText,
    stepIngredients,
    locale,
    onNextStep,
    onPreviousStep,
    onStartTimer,
    onPauseHandsFree,
    onFinish,
  });
  optionsRef.current = {
    currentStepText,
    stepIngredients,
    locale,
    onNextStep,
    onPreviousStep,
    onStartTimer,
    onPauseHandsFree,
    onFinish,
  };

  const adapterRef = useRef(adapter);
  const speechRef = useRef(speech);
  adapterRef.current = adapter;
  speechRef.current = speech;

  const sessionRef = useRef<SpeechRecognitionSession | null>(null);
  const generationRef = useRef(0);
  const speechActiveRef = useRef(false);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const handsFreeEnabledRef = useRef(false);
  const handsFreePausedRef = useRef(false);
  const startHandsFreeListeningRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<CookingModeVoiceStatus>('ready');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handsFreeEnabled, setHandsFreeEnabled] = useState(false);

  const setSafeStatus = useCallback((nextStatus: CookingModeVoiceStatus) => {
    if (mountedRef.current) setStatus(nextStatus);
  }, []);

  const clearProcessingTimeout = useCallback(() => {
    if (processingTimeoutRef.current !== null) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
  }, []);

  const cancelSession = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) return;
    try {
      session.cancel();
    } catch {
      // A cleanup must not block touch navigation or unmounting.
    }
  }, []);

  const stopSpeech = useCallback((): Promise<void> => {
    speechActiveRef.current = false;
    try {
      return Promise.resolve(speechRef.current.stop()).catch(() => undefined);
    } catch {
      return Promise.resolve();
    }
  }, []);

  const invalidateVoice = useCallback(() => {
    generationRef.current += 1;
    clearProcessingTimeout();
    cancelSession();
  }, [cancelSession, clearProcessingTimeout]);

  const disableHandsFree = useCallback(() => {
    handsFreeEnabledRef.current = false;
    handsFreePausedRef.current = false;
    if (mountedRef.current) setHandsFreeEnabled(false);
  }, []);

  const finishVoice = useCallback(
    (nextStatus: CookingModeVoiceStatus = 'ready', preserveHandsFree = false) => {
      invalidateVoice();
      void stopSpeech();
      if (!preserveHandsFree) disableHandsFree();
      setSafeStatus(nextStatus);
    },
    [disableHandsFree, invalidateVoice, setSafeStatus, stopSpeech],
  );

  const speakText = useCallback(
    (text: string, resumeHandsFree = false) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        setSafeStatus('error');
        if (mountedRef.current) setError('Für diesen Schritt ist kein Vorlesetext verfügbar.');
        return;
      }

      invalidateVoice();
      const generation = generationRef.current;
      const shouldResumeHandsFree =
        resumeHandsFree && handsFreeEnabledRef.current && !handsFreePausedRef.current;
      setError(null);
      setSafeStatus('reading');
      speechActiveRef.current = true;
      void stopSpeech().then(() => {
        if (!mountedRef.current || generation !== generationRef.current) return;
        try {
          speechActiveRef.current = true;
          speechRef.current.speak(trimmedText, {
            language: optionsRef.current.locale,
            onStart: () => {
              speechActiveRef.current = true;
              if (generation !== generationRef.current) return;
              setSafeStatus('reading');
            },
            onDone: () => {
              speechActiveRef.current = false;
              if (generation !== generationRef.current) return;
              if (processingTimeoutRef.current !== null) return;
              if (shouldResumeHandsFree && handsFreeEnabledRef.current) {
                startHandsFreeListeningRef.current?.();
                return;
              }
              setSafeStatus(sessionRef.current ? 'listening' : 'ready');
            },
            onStopped: () => {
              speechActiveRef.current = false;
              if (generation !== generationRef.current) return;
              if (processingTimeoutRef.current !== null) return;
              if (shouldResumeHandsFree && handsFreeEnabledRef.current) {
                startHandsFreeListeningRef.current?.();
                return;
              }
              setSafeStatus(sessionRef.current ? 'listening' : 'ready');
            },
            onError: (speechError) => {
              speechActiveRef.current = false;
              if (generation !== generationRef.current) return;
              if (mountedRef.current) setError(errorMessage(speechError));
              disableHandsFree();
              setSafeStatus('error');
            },
          });
        } catch (speechError) {
          speechActiveRef.current = false;
          if (mountedRef.current) setError(errorMessage(speechError));
          disableHandsFree();
          setSafeStatus('error');
        }
      });
    },
    [disableHandsFree, invalidateVoice, setSafeStatus, stopSpeech],
  );

  const readStep = useCallback(() => {
    speakText(
      optionsRef.current.currentStepText,
      handsFreeEnabledRef.current && !handsFreePausedRef.current,
    );
  }, [speakText]);

  const readIngredients = useCallback(() => {
    speakText(
      ingredientSpeechText(optionsRef.current.stepIngredients),
      handsFreeEnabledRef.current && !handsFreePausedRef.current,
    );
  }, [speakText]);

  const pauseHandsFree = useCallback(() => {
    if (!handsFreeEnabledRef.current) return;
    handsFreePausedRef.current = true;
    invalidateVoice();
    void stopSpeech();
    setError(null);
    setSafeStatus('paused');
  }, [invalidateVoice, setSafeStatus, stopSpeech]);

  const startHandsFree = useCallback(() => {
    if (!stepId) {
      setError('Für Hands-free ist kein Zubereitungsschritt verfügbar.');
      setSafeStatus('error');
      return;
    }
    handsFreeEnabledRef.current = true;
    handsFreePausedRef.current = false;
    setHandsFreeEnabled(true);
    setError(null);
    invalidateVoice();
    const generation = generationRef.current;
    setSafeStatus('processing');
    void (
      adapterRef.current.prepare?.({ locale: optionsRef.current.locale }) ??
      Promise.resolve({ status: 'ready' as const })
    )
      .then((preflight) => {
        if (!mountedRef.current || generation !== generationRef.current) return;
        if (preflight.status !== 'ready') {
          if (mountedRef.current) setError(preflight.error);
          disableHandsFree();
          setSafeStatus(statusForResult(preflight.status));
          return;
        }
        readStep();
      })
      .catch((preflightError: unknown) => {
        if (!mountedRef.current || generation !== generationRef.current) return;
        if (mountedRef.current) setError(errorMessage(preflightError));
        disableHandsFree();
        setSafeStatus('error');
      });
  }, [disableHandsFree, invalidateVoice, readStep, setSafeStatus, stepId]);

  const resumeHandsFree = useCallback(() => {
    if (!handsFreeEnabledRef.current || !handsFreePausedRef.current) return;
    handsFreePausedRef.current = false;
    setError(null);
    readStep();
  }, [readStep]);

  const endHandsFree = useCallback(() => {
    finishVoice('ready');
    setError(null);
  }, [finishVoice]);

  const stopReading = useCallback(() => {
    finishVoice('ready');
    setError(null);
  }, [finishVoice]);

  const handlePreviousStep = useCallback(() => {
    const continueHandsFree = handsFreeEnabledRef.current && !handsFreePausedRef.current;
    finishVoice('ready', continueHandsFree);
    const moved = optionsRef.current.onPreviousStep?.();
    if (moved !== true && continueHandsFree) {
      speakText(optionsRef.current.currentStepText, true);
    }
  }, [finishVoice, speakText]);

  const executeCommand = useCallback(
    (command: ReturnType<typeof parseCookingVoiceCommand>) => {
      if (!command) {
        if (mountedRef.current)
          setError('Befehl nicht erkannt. Touch-Navigation bleibt verfügbar.');
        finishVoice('error');
        return;
      }

      const continueHandsFree = handsFreeEnabledRef.current && !handsFreePausedRef.current;
      switch (command.kind) {
        case 'next':
          finishVoice('ready', continueHandsFree);
          optionsRef.current.onNextStep?.();
          return;
        case 'previous':
          handlePreviousStep();
          return;
        case 'repeat':
          readStep();
          return;
        case 'read-ingredients':
          readIngredients();
          return;
        case 'start-timer':
          finishVoice('ready', continueHandsFree);
          optionsRef.current.onStartTimer?.(command.durationSeconds);
          if (continueHandsFree) startHandsFreeListeningRef.current?.();
          return;
        case 'stop-reading':
          stopReading();
          return;
        case 'pause': {
          const pause = () => pauseHandsFree();
          const coordinatePause = optionsRef.current.onPauseHandsFree;
          if (coordinatePause) coordinatePause(pause);
          else pause();
          return;
        }
        case 'finish':
          finishVoice();
          optionsRef.current.onFinish?.();
          return;
      }
    },
    [finishVoice, handlePreviousStep, pauseHandsFree, readIngredients, readStep, stopReading],
  );

  const consumeSession = useCallback(
    async (session: SpeechRecognitionSession, generation: number) => {
      const result = await session.result;
      if (
        !mountedRef.current ||
        generation !== generationRef.current ||
        sessionRef.current !== session
      )
        return;

      sessionRef.current = null;
      if (result.status === 'transcript' && result.text) {
        setTranscript(result.text);
        setSafeStatus('processing');
        clearProcessingTimeout();
        const command = parseCookingVoiceCommand(result.text);
        processingTimeoutRef.current = setTimeout(() => {
          processingTimeoutRef.current = null;
          if (!mountedRef.current || generation !== generationRef.current) return;
          executeCommand(command);
        }, 0);
        return;
      }

      if (result.status === 'cancelled') {
        setSafeStatus('ready');
        return;
      }

      if (mountedRef.current) setError(result.error ?? 'Spracherkennung fehlgeschlagen.');
      disableHandsFree();
      setSafeStatus(statusForResult(result.status));
    },
    [clearProcessingTimeout, disableHandsFree, executeCommand, setSafeStatus],
  );

  const startListeningInternal = useCallback(
    (fromHandsFree: boolean) => {
      if (fromHandsFree && (!handsFreeEnabledRef.current || handsFreePausedRef.current)) return;

      // Manual touch can still interrupt TTS for the existing stop-reading command.
      const keepSpeechActive = speechActiveRef.current && !fromHandsFree;
      if (keepSpeechActive) {
        clearProcessingTimeout();
        cancelSession();
      } else {
        invalidateVoice();
      }
      const generation = generationRef.current;
      setError(null);
      setSafeStatus('listening');
      const stopBeforeListening = keepSpeechActive ? Promise.resolve() : stopSpeech();
      void stopBeforeListening.then(() => {
        if (!mountedRef.current || generation !== generationRef.current) return;
        try {
          const session = adapterRef.current.start({
            locale: optionsRef.current.locale,
            continuous: false,
          });
          sessionRef.current = session;
          void consumeSession(session, generation).catch((recognitionError: unknown) => {
            if (generation !== generationRef.current || !mountedRef.current) return;
            if (mountedRef.current) setError(errorMessage(recognitionError));
            disableHandsFree();
            setSafeStatus('error');
          });
        } catch (recognitionError) {
          if (mountedRef.current) setError(errorMessage(recognitionError));
          if (fromHandsFree) disableHandsFree();
          setSafeStatus('error');
        }
      });
    },
    [
      cancelSession,
      clearProcessingTimeout,
      consumeSession,
      disableHandsFree,
      invalidateVoice,
      setSafeStatus,
      stopSpeech,
    ],
  );

  startHandsFreeListeningRef.current = () => startListeningInternal(true);

  const startListening = useCallback(() => {
    startListeningInternal(false);
  }, [startListeningInternal]);

  const stopListening = useCallback(() => {
    const session = sessionRef.current;
    if (!session) {
      clearProcessingTimeout();
      setSafeStatus(speechActiveRef.current ? 'reading' : 'ready');
      return;
    }
    try {
      setSafeStatus('processing');
      session.stop();
    } catch (recognitionError) {
      if (mountedRef.current) setError(errorMessage(recognitionError));
      setSafeStatus('error');
    }
  }, [clearProcessingTimeout, setSafeStatus]);

  const handleNextStep = useCallback(() => {
    finishVoice('ready', handsFreeEnabledRef.current);
    optionsRef.current.onNextStep?.();
  }, [finishVoice]);

  const handleStartTimer = useCallback(() => {
    optionsRef.current.onStartTimer?.();
  }, []);

  const handleFinish = useCallback(() => {
    finishVoice();
    optionsRef.current.onFinish?.();
  }, [finishVoice]);

  useEffect(() => {
    mountedRef.current = true;
    setStatus(stepId ? 'ready' : 'error');
    setError(null);
    setTranscript(null);
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      clearProcessingTimeout();
      cancelSession();
      void stopSpeech();
    };
  }, [cancelSession, clearProcessingTimeout, stepId, stopSpeech]);

  useEffect(() => {
    if (!stepId || !handsFreeEnabledRef.current || handsFreePausedRef.current) return;
    speakText(optionsRef.current.currentStepText, true);
  }, [speakText, stepId]);

  return {
    status,
    transcript,
    error,
    handsFreeEnabled,
    readStep,
    readIngredients,
    stopReading,
    startListening,
    stopListening,
    startHandsFree,
    pauseHandsFree,
    resumeHandsFree,
    endHandsFree,
    onNextStep: handleNextStep,
    onPreviousStep: handlePreviousStep,
    onStartTimer: handleStartTimer,
    onFinish: handleFinish,
  };
}
