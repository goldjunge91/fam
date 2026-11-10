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
  onPreviousStep?: () => void;
  onStartTimer?: () => void;
  onFinish?: () => void;
};

export type CookingModeVoice = {
  status: CookingModeVoiceStatus;
  transcript: string | null;
  error: string | null;
  readStep: () => void;
  readIngredients: () => void;
  stopReading: () => void;
  startListening: () => void;
  stopListening: () => void;
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
  onFinish,
}: UseCookingModeVoiceOptions): CookingModeVoice {
  const optionsRef = useRef({
    currentStepText,
    stepIngredients,
    locale,
    onNextStep,
    onPreviousStep,
    onStartTimer,
    onFinish,
  });
  optionsRef.current = {
    currentStepText,
    stepIngredients,
    locale,
    onNextStep,
    onPreviousStep,
    onStartTimer,
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
  const [status, setStatus] = useState<CookingModeVoiceStatus>('ready');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const finishVoice = useCallback(
    (nextStatus: CookingModeVoiceStatus = 'ready') => {
      invalidateVoice();
      void stopSpeech();
      setSafeStatus(nextStatus);
    },
    [invalidateVoice, setSafeStatus, stopSpeech],
  );

  const speakText = useCallback(
    (text: string) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        setSafeStatus('error');
        if (mountedRef.current) setError('Für diesen Schritt ist kein Vorlesetext verfügbar.');
        return;
      }

      invalidateVoice();
      const generation = generationRef.current;
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
              setSafeStatus(sessionRef.current ? 'listening' : 'reading');
            },
            onDone: () => {
              speechActiveRef.current = false;
              if (generation !== generationRef.current) return;
              if (processingTimeoutRef.current !== null) return;
              setSafeStatus(sessionRef.current ? 'listening' : 'ready');
            },
            onStopped: () => {
              speechActiveRef.current = false;
              if (generation !== generationRef.current) return;
              if (processingTimeoutRef.current !== null) return;
              setSafeStatus(sessionRef.current ? 'listening' : 'ready');
            },
            onError: (speechError) => {
              speechActiveRef.current = false;
              if (generation !== generationRef.current) return;
              if (mountedRef.current) setError(errorMessage(speechError));
              setSafeStatus('error');
            },
          });
        } catch (speechError) {
          speechActiveRef.current = false;
          if (mountedRef.current) setError(errorMessage(speechError));
          setSafeStatus('error');
        }
      });
    },
    [invalidateVoice, setSafeStatus, stopSpeech],
  );

  const readStep = useCallback(() => {
    speakText(optionsRef.current.currentStepText);
  }, [speakText]);

  const readIngredients = useCallback(() => {
    speakText(ingredientSpeechText(optionsRef.current.stepIngredients));
  }, [speakText]);

  const stopReading = useCallback(() => {
    finishVoice('ready');
    setError(null);
  }, [finishVoice]);

  const executeCommand = useCallback(
    (command: ReturnType<typeof parseCookingVoiceCommand>) => {
      if (!command) {
        if (mountedRef.current)
          setError('Befehl nicht erkannt. Touch-Navigation bleibt verfügbar.');
        setSafeStatus('error');
        return;
      }

      switch (command) {
        case 'next':
          finishVoice();
          optionsRef.current.onNextStep?.();
          return;
        case 'previous':
          finishVoice();
          optionsRef.current.onPreviousStep?.();
          return;
        case 'repeat':
          readStep();
          return;
        case 'read-ingredients':
          readIngredients();
          return;
        case 'start-timer':
          finishVoice();
          optionsRef.current.onStartTimer?.();
          return;
        case 'stop-reading':
          stopReading();
          return;
        case 'finish':
          finishVoice();
          optionsRef.current.onFinish?.();
          return;
      }
    },
    [finishVoice, readIngredients, readStep, setSafeStatus, stopReading],
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
      setSafeStatus(statusForResult(result.status));
    },
    [clearProcessingTimeout, executeCommand, setSafeStatus],
  );

  const startListening = useCallback(() => {
    // A user can explicitly start an interrupt listener while TTS is running so
    // "Vorlesen stoppen" remains a real voice command without auto-starting recognition.
    const keepSpeechActive = speechActiveRef.current;
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
          setSafeStatus('error');
        });
      } catch (recognitionError) {
        if (mountedRef.current) setError(errorMessage(recognitionError));
        setSafeStatus('error');
      }
    });
  }, [
    cancelSession,
    clearProcessingTimeout,
    consumeSession,
    invalidateVoice,
    setSafeStatus,
    stopSpeech,
  ]);

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
    finishVoice();
    optionsRef.current.onNextStep?.();
  }, [finishVoice]);

  const handlePreviousStep = useCallback(() => {
    finishVoice();
    optionsRef.current.onPreviousStep?.();
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

  return {
    status,
    transcript,
    error,
    readStep,
    readIngredients,
    stopReading,
    startListening,
    stopListening,
    onNextStep: handleNextStep,
    onPreviousStep: handlePreviousStep,
    onStartTimer: handleStartTimer,
    onFinish: handleFinish,
  };
}
