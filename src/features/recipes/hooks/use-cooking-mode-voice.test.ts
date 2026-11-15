import { act, renderHook } from '@testing-library/react-native';
import type {
  SpeechRecognitionAdapter,
  SpeechRecognitionSession,
} from '@/features/shopping-list/stt-beta/services/speech-recognition-adapter';
import type { SpeechInputResult } from '@/features/shopping-list/stt-beta/types';
import { type CookingModeVoiceSpeech, useCookingModeVoice } from './use-cooking-mode-voice';

function transcript(text: string): SpeechInputResult {
  return {
    status: 'transcript',
    text,
    locale: 'de-DE',
    onDevice: false,
    error: null,
  };
}

function result(
  status: Exclude<SpeechInputResult, { status: 'transcript' }>['status'],
): SpeechInputResult {
  return {
    status,
    text: null,
    locale: 'de-DE',
    onDevice: false,
    error: `${status} result`,
  };
}

type TestSession = SpeechRecognitionSession & {
  emitFinalResult: (value: SpeechInputResult) => void;
};

function createSession(): TestSession {
  let resolve!: (value: SpeechInputResult) => void;
  const resultPromise = new Promise<SpeechInputResult>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return {
    result: resultPromise,
    emitFinalResult: resolve,
    stop: jest.fn(),
    cancel: jest.fn(),
  };
}

function createVoiceHarness() {
  const sessions: TestSession[] = [];
  const prepare = jest.fn(async () => ({ status: 'ready' as const }));
  const adapter: SpeechRecognitionAdapter = {
    prepare,
    start: jest.fn(() => {
      const session = createSession();
      sessions.push(session);
      return session;
    }),
  };
  const speech: CookingModeVoiceSpeech = {
    speak: jest.fn(),
    stop: jest.fn(async () => undefined),
  };
  return { adapter, prepare, speech, sessions };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

async function flushScheduledCommand() {
  await flushAsyncWork();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await flushAsyncWork();
}

const options = {
  stepId: 'step-1',
  currentStepText: 'Zwiebeln fein hacken.',
  stepIngredients: [
    { itemId: 'onion', name: 'Zwiebeln', unit: 'g', quantity: 200 },
    { itemId: 'salt', name: 'Salz', unit: 'Prise', quantity: 0 },
  ],
};

describe('useCookingModeVoice', () => {
  it('waits for the explicit listening action before starting recognition', async () => {
    const { adapter, speech, sessions } = createVoiceHarness();
    const { result: hook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter, speech }),
    );

    expect(hook.current.status).toBe('ready');
    expect(adapter.start).not.toHaveBeenCalled();

    await act(async () => {
      hook.current.startListening();
      await flushAsyncWork();
    });

    expect(adapter.start).toHaveBeenCalledTimes(1);
    expect(adapter.start).toHaveBeenCalledWith({
      locale: expect.any(String),
      continuous: false,
    });
    expect(sessions).toHaveLength(1);
    expect(hook.current.status).toBe('listening');
  });

  it.each([
    ['weiter', 'next'],
    ['zurück', 'previous'],
    ['wiederholen', 'repeat'],
    ['Zutaten vorlesen', 'readIngredients'],
    ['Timer starten', 'startTimer'],
    ['Vorlesen stoppen', 'stopReading'],
    ['Kochvorgang abschließen', 'finish'],
  ] as const)('executes the supported voice command %s', async (command, action) => {
    const { adapter, speech, sessions } = createVoiceHarness();
    const callbacks = {
      onNextStep: jest.fn(),
      onPreviousStep: jest.fn(),
      onStartTimer: jest.fn(),
      onFinish: jest.fn(),
    };
    const { result: hook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter, speech, ...callbacks }),
    );

    await act(async () => {
      hook.current.startListening();
      await flushAsyncWork();
    });
    await act(async () => {
      sessions[0].emitFinalResult(transcript(command));
      await flushAsyncWork();
      await flushScheduledCommand();
    });

    if (action === 'next') expect(callbacks.onNextStep).toHaveBeenCalledTimes(1);
    if (action === 'previous') expect(callbacks.onPreviousStep).toHaveBeenCalledTimes(1);
    if (action === 'startTimer') expect(callbacks.onStartTimer).toHaveBeenCalledTimes(1);
    if (action === 'finish') expect(callbacks.onFinish).toHaveBeenCalledTimes(1);
    if (action === 'readIngredients') {
      expect(speech.speak).toHaveBeenCalledWith(
        expect.stringContaining('200 g Zwiebeln'),
        expect.anything(),
      );
    }
    if (action === 'repeat') {
      expect(speech.speak).toHaveBeenCalledWith('Zwiebeln fein hacken.', expect.anything());
    }
    if (action === 'stopReading') expect(speech.stop).toHaveBeenCalled();
  });

  it('keeps processing visible until a recognized command is executed', async () => {
    jest.useFakeTimers();
    try {
      const { adapter, speech, sessions } = createVoiceHarness();
      const onNextStep = jest.fn();
      const { result: hook } = await renderHook(() =>
        useCookingModeVoice({ ...options, adapter, speech, onNextStep }),
      );

      await act(async () => {
        hook.current.startListening();
        await flushAsyncWork();
        sessions[0].emitFinalResult(transcript('weiter'));
        await flushAsyncWork();
      });

      expect(hook.current.status).toBe('processing');
      expect(onNextStep).not.toHaveBeenCalled();

      await act(async () => {
        jest.runOnlyPendingTimers();
        await flushAsyncWork();
      });

      expect(onNextStep).toHaveBeenCalledTimes(1);
      expect(hook.current.status).toBe('ready');
    } finally {
      jest.useRealTimers();
    }
  });

  it('exposes speech callbacks as reading and ready states and stops speech on demand', async () => {
    const { adapter, speech } = createVoiceHarness();
    const { result: hook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter, speech }),
    );

    await act(async () => {
      hook.current.readStep();
      await flushAsyncWork();
    });

    const speakOptions = (speech.speak as jest.Mock).mock.calls[0]?.[1] as {
      onStart: () => void;
      onDone: () => void;
    };
    await act(async () => {
      speakOptions.onStart();
    });
    expect(hook.current.status).toBe('reading');
    await act(async () => {
      speakOptions.onDone();
    });
    expect(hook.current.status).toBe('ready');

    await act(async () => {
      hook.current.readStep();
      await flushAsyncWork();
      hook.current.stopReading();
      await flushAsyncWork();
    });
    expect(hook.current.status).toBe('ready');
  });

  it('keeps recognition available during speech so the stop-reading command can interrupt it', async () => {
    jest.useFakeTimers();
    try {
      const { adapter, speech, sessions } = createVoiceHarness();
      const { result: hook } = await renderHook(() =>
        useCookingModeVoice({ ...options, adapter, speech }),
      );

      await act(async () => {
        hook.current.readStep();
        await flushAsyncWork();
      });
      const stopCallsBeforeListening = (speech.stop as jest.Mock).mock.calls.length;

      await act(async () => {
        hook.current.startListening();
        await flushAsyncWork();
      });

      expect(hook.current.status).toBe('listening');
      expect(speech.stop).toHaveBeenCalledTimes(stopCallsBeforeListening);

      await act(async () => {
        sessions[0].emitFinalResult(transcript('Vorlesen stoppen'));
        await flushAsyncWork();
      });
      expect(hook.current.status).toBe('processing');

      await act(async () => {
        jest.runOnlyPendingTimers();
        await flushAsyncWork();
      });

      expect(speech.stop).toHaveBeenCalledTimes(stopCallsBeforeListening + 1);
      expect(hook.current.status).toBe('ready');
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([
    ['permission-denied', 'denied'],
    ['capability-unavailable', 'unavailable'],
    ['cancelled', 'ready'],
    ['error', 'error'],
  ] as const)('maps the recognition result %s to %s', async (nativeStatus, expectedStatus) => {
    const { adapter, speech, sessions } = createVoiceHarness();
    const { result: hook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter, speech }),
    );

    await act(async () => {
      hook.current.startListening();
      await flushAsyncWork();
      sessions[0].emitFinalResult(result(nativeStatus));
      await flushAsyncWork();
    });

    expect(hook.current.status).toBe(expectedStatus);
    if (nativeStatus === 'cancelled') {
      expect(hook.current.error).toBeNull();
    } else {
      expect(hook.current.error).toContain(`${nativeStatus} result`);
    }
  });

  it('keeps touch callbacks available for an unknown transcript', async () => {
    const { adapter, speech, sessions } = createVoiceHarness();
    const onNextStep = jest.fn();
    const { result: hook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter, speech, onNextStep }),
    );

    await act(async () => {
      hook.current.startListening();
      await flushAsyncWork();
      sessions[0].emitFinalResult(transcript('Was soll ich jetzt machen?'));
      await flushAsyncWork();
      await flushScheduledCommand();
    });

    expect(hook.current.status).toBe('error');
    expect(hook.current.error).toContain('Befehl nicht erkannt');
    await act(async () => {
      hook.current.onNextStep();
    });
    expect(onNextStep).toHaveBeenCalledTimes(1);
  });

  it('handles empty step ids and string speech errors', async () => {
    const { speech } = createVoiceHarness();
    const { result: emptyHook } = await renderHook(() =>
      useCookingModeVoice({ ...options, stepId: '', speech }),
    );
    expect(emptyHook.current.status).toBe('error');

    const { result: hook } = await renderHook(() => useCookingModeVoice({ ...options, speech }));
    await act(async () => {
      hook.current.readStep();
      await flushAsyncWork();
    });
    const speechOptions = (speech.speak as jest.Mock).mock.calls.at(-1)?.[1] as {
      onError: (error: Error) => void;
    };
    await act(async () => {
      speechOptions.onError('tts failed' as unknown as Error);
    });
    expect(hook.current.status).toBe('error');
    expect(hook.current.error).toBe('tts failed');
  });

  it('continues when stopping speech rejects', async () => {
    const { adapter, speech } = createVoiceHarness();
    speech.stop = jest.fn().mockRejectedValue(new Error('stop failed'));
    const { result: hook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter, speech }),
    );

    await act(async () => {
      hook.current.readStep();
      await flushAsyncWork();
    });
    expect(speech.speak).toHaveBeenCalled();
  });

  it('returns ready when stopListening is called without a session', async () => {
    const { adapter, speech } = createVoiceHarness();
    const { result: hook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter, speech }),
    );

    await act(async () => {
      hook.current.stopListening();
    });
    expect(hook.current.status).toBe('ready');
  });

  it('cancels a pending session when a new listening request starts', async () => {
    const { adapter, speech, sessions } = createVoiceHarness();
    const { result: hook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter, speech }),
    );

    await act(async () => {
      hook.current.startListening();
      await flushAsyncWork();
      hook.current.startListening();
      await flushAsyncWork();
    });
    expect(sessions[0]?.cancel).toHaveBeenCalled();
  });

  it('cancels recognition and stops speech when the step changes or unmounts', async () => {
    const { adapter, speech, sessions } = createVoiceHarness();
    const {
      result: hook,
      rerender,
      unmount,
    } = await renderHook(
      ({ stepId }: { stepId: string }) =>
        useCookingModeVoice({ ...options, stepId, adapter, speech }),
      { initialProps: { stepId: 'step-1' } },
    );

    await act(async () => {
      hook.current.startListening();
      await flushAsyncWork();
    });
    await rerender({ stepId: 'step-2' });
    expect(sessions[0].cancel).toHaveBeenCalledTimes(1);
    expect(speech.stop).toHaveBeenCalled();

    await unmount();
    expect(speech.stop).toHaveBeenCalledTimes(3);
  });

  it('speaks the no-ingredient fallback and reports an empty step', async () => {
    const { adapter, speech } = createVoiceHarness();
    const { result: hook } = await renderHook(() =>
      useCookingModeVoice({ ...options, stepIngredients: [], adapter, speech }),
    );

    await act(async () => {
      hook.current.readIngredients();
      await flushAsyncWork();
    });
    expect(speech.speak).toHaveBeenCalledWith(
      'Für diesen Schritt sind keine Zutaten verknüpft.',
      expect.anything(),
    );

    await act(async () => {
      hook.current.readStep();
      await flushAsyncWork();
    });
    const { result: emptyHook } = await renderHook(() =>
      useCookingModeVoice({ ...options, currentStepText: '  ', adapter, speech }),
    );
    await act(async () => {
      emptyHook.current.readStep();
      await flushAsyncWork();
    });
    expect(emptyHook.current.status).toBe('error');
    expect(emptyHook.current.error).toContain('kein Vorlesetext');
  });

  it('reports speech and recognition startup errors', async () => {
    const speechError = new Error('speech failed');
    const speech: CookingModeVoiceSpeech = {
      speak: jest.fn(() => {
        throw speechError;
      }),
      stop: jest.fn(async () => undefined),
    };
    const { result: speechHook } = await renderHook(() =>
      useCookingModeVoice({ ...options, speech }),
    );
    await act(async () => {
      speechHook.current.readStep();
      await flushAsyncWork();
    });
    expect(speechHook.current.status).toBe('error');
    expect(speechHook.current.error).toBe('speech failed');

    const adapter: SpeechRecognitionAdapter = {
      start: jest.fn(() => {
        throw new Error('recognizer failed');
      }),
    };
    const { result: adapterHook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter }),
    );
    await act(async () => {
      adapterHook.current.startListening();
      await flushAsyncWork();
    });
    expect(adapterHook.current.status).toBe('error');
    expect(adapterHook.current.error).toBe('recognizer failed');
  });

  it('handles a rejected recognition session and a throwing stop call', async () => {
    let rejectResult: (error: unknown) => void = () => undefined;
    const resultPromise = new Promise<SpeechInputResult>((_resolve, reject) => {
      rejectResult = reject;
    });
    const rejectedSession: SpeechRecognitionSession = {
      result: resultPromise,
      stop: jest.fn(),
      cancel: jest.fn(),
    };
    const rejectedAdapter: SpeechRecognitionAdapter = {
      start: jest.fn(() => rejectedSession),
    };
    const { result: rejectedHook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter: rejectedAdapter }),
    );
    await act(async () => {
      rejectedHook.current.startListening();
      await flushAsyncWork();
      rejectResult(new Error('recognition failed'));
      await flushAsyncWork();
    });
    expect(rejectedHook.current.status).toBe('error');
    expect(rejectedHook.current.error).toBe('recognition failed');

    let resolveStopResult: (value: SpeechInputResult) => void = () => undefined;
    const stopSession: SpeechRecognitionSession = {
      result: new Promise((resolve) => {
        resolveStopResult = resolve;
      }),
      stop: jest.fn(() => {
        throw new Error('stop failed');
      }),
      cancel: jest.fn(),
    };
    const stopAdapter: SpeechRecognitionAdapter = { start: jest.fn(() => stopSession) };
    const { result: stopHook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter: stopAdapter }),
    );
    await act(async () => {
      stopHook.current.startListening();
      await flushAsyncWork();
      await flushScheduledCommand();
      stopHook.current.stopListening();
      await flushAsyncWork();
    });
    expect(stopHook.current.status).toBe('error');
    expect(stopHook.current.error).toBe('stop failed');
    await act(async () => {
      resolveStopResult(result('cancelled'));
      await flushAsyncWork();
    });
  });

  it('does not start hands-free recognition until opt-in and waits for TTS completion', async () => {
    const { adapter, speech, sessions } = createVoiceHarness();
    const { result: hook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter, speech }),
    );

    expect(hook.current.handsFreeEnabled).toBe(false);
    await act(async () => {
      hook.current.startHandsFree();
      await flushAsyncWork();
    });

    expect(hook.current.handsFreeEnabled).toBe(true);
    expect(hook.current.status).toBe('reading');
    expect(speech.speak).toHaveBeenCalledWith('Zwiebeln fein hacken.', expect.anything());
    expect(adapter.start).not.toHaveBeenCalled();

    const speechOptions = (speech.speak as jest.Mock).mock.calls.at(-1)?.[1] as {
      onDone: () => void;
    };
    await act(async () => {
      speechOptions.onDone();
      await flushAsyncWork();
    });

    expect(adapter.start).toHaveBeenCalledWith({
      locale: expect.any(String),
      continuous: false,
    });
    expect(sessions).toHaveLength(1);
    expect(hook.current.status).toBe('listening');
  });

  it('preflights permissions before speaking the first hands-free step', async () => {
    let resolvePreflight!: (value: { status: 'ready' }) => void;
    const prepare = jest.fn(
      () => new Promise<{ status: 'ready' }>((resolve) => (resolvePreflight = resolve)),
    );
    const { adapter, speech } = createVoiceHarness();
    adapter.prepare = prepare;
    const { result: hook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter, speech }),
    );

    await act(async () => {
      hook.current.startHandsFree();
      await flushAsyncWork();
    });

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(speech.speak).not.toHaveBeenCalled();

    await act(async () => {
      resolvePreflight({ status: 'ready' });
      await flushAsyncWork();
    });

    expect(speech.speak).toHaveBeenCalledWith('Zwiebeln fein hacken.', expect.anything());
    expect(adapter.start).not.toHaveBeenCalled();
  });

  it('falls back to touch controls when the hands-free preflight is denied', async () => {
    const { adapter, speech } = createVoiceHarness();
    adapter.prepare = jest.fn(async () => ({
      status: 'permission-denied' as const,
      error: 'Sprachberechtigung verweigert',
    }));
    const { result: hook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter, speech }),
    );

    await act(async () => {
      hook.current.startHandsFree();
      await flushAsyncWork();
    });

    expect(speech.speak).not.toHaveBeenCalled();
    expect(adapter.start).not.toHaveBeenCalled();
    expect(hook.current.handsFreeEnabled).toBe(false);
    expect(hook.current.status).toBe('denied');
    expect(hook.current.error).toBe('Sprachberechtigung verweigert');
  });

  it('re-arms the current step after a spoken previous command at the first step', async () => {
    const { adapter, speech, sessions } = createVoiceHarness();
    const onPreviousStep = jest.fn(() => false);
    const { result: hook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter, speech, onPreviousStep }),
    );

    await act(async () => {
      hook.current.startHandsFree();
      await flushAsyncWork();
      const speechOptions = (speech.speak as jest.Mock).mock.calls.at(-1)?.[1] as {
        onDone: () => void;
      };
      speechOptions.onDone();
      await flushAsyncWork();
      sessions[0].emitFinalResult(transcript('zurück'));
      await flushScheduledCommand();
    });

    expect(onPreviousStep).toHaveBeenCalledTimes(1);
    expect(speech.speak).toHaveBeenCalledTimes(2);

    const repeatSpeechOptions = (speech.speak as jest.Mock).mock.calls.at(-1)?.[1] as {
      onDone: () => void;
    };
    await act(async () => {
      repeatSpeechOptions.onDone();
      await flushAsyncWork();
    });

    expect(sessions).toHaveLength(2);
    expect(hook.current.status).toBe('listening');
  });

  it('routes a spoken pause through the timer-aware pause coordinator', async () => {
    jest.useFakeTimers();
    try {
      const { adapter, speech, sessions } = createVoiceHarness();
      const onPauseHandsFree = jest.fn((pause: () => void) => pause());
      const { result: hook } = await renderHook(() =>
        useCookingModeVoice({ ...options, adapter, speech, onPauseHandsFree }),
      );

      await act(async () => {
        hook.current.startHandsFree();
        await flushAsyncWork();
        const speechOptions = (speech.speak as jest.Mock).mock.calls.at(-1)?.[1] as {
          onDone: () => void;
        };
        speechOptions.onDone();
        await flushAsyncWork();
        sessions[0].emitFinalResult(transcript('Pause'));
        await flushAsyncWork();
      });

      expect(hook.current.status).toBe('processing');
      await act(async () => {
        jest.runOnlyPendingTimers();
        await flushAsyncWork();
      });

      expect(onPauseHandsFree).toHaveBeenCalledTimes(1);
      expect(hook.current.status).toBe('paused');
    } finally {
      jest.useRealTimers();
    }
  });

  it('re-arms one-shot recognition after a spoken timer command', async () => {
    const { adapter, speech, sessions } = createVoiceHarness();
    const onStartTimer = jest.fn();
    const { result: hook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter, speech, onStartTimer }),
    );

    await act(async () => {
      hook.current.startHandsFree();
      await flushAsyncWork();
    });
    const speechOptions = (speech.speak as jest.Mock).mock.calls.at(-1)?.[1] as {
      onDone: () => void;
    };
    await act(async () => {
      speechOptions.onDone();
      await flushAsyncWork();
      sessions[0].emitFinalResult(transcript('Timer für 5 Minuten starten'));
      await flushScheduledCommand();
    });

    expect(onStartTimer).toHaveBeenCalledWith(300);
    expect(sessions).toHaveLength(2);
    expect(hook.current.handsFreeEnabled).toBe(true);
    expect(hook.current.status).toBe('listening');
  });

  it('speaks the next step automatically after a spoken next command', async () => {
    const { adapter, speech, sessions } = createVoiceHarness();
    const onNextStep = jest.fn();
    const { result: hook, rerender } = await renderHook(
      ({ stepId }: { stepId: string }) =>
        useCookingModeVoice({
          ...options,
          stepId,
          currentStepText: stepId === 'step-1' ? options.currentStepText : 'Nudeln kochen.',
          adapter,
          speech,
          onNextStep,
        }),
      { initialProps: { stepId: 'step-1' } },
    );

    await act(async () => {
      hook.current.startHandsFree();
      await flushAsyncWork();
      const speechOptions = (speech.speak as jest.Mock).mock.calls.at(-1)?.[1] as {
        onDone: () => void;
      };
      speechOptions.onDone();
      await flushAsyncWork();
      sessions[0].emitFinalResult(transcript('weiter'));
      await flushScheduledCommand();
    });

    expect(onNextStep).toHaveBeenCalledTimes(1);
    await rerender({ stepId: 'step-2' });
    await act(async () => {
      await flushAsyncWork();
    });

    expect(speech.speak).toHaveBeenLastCalledWith('Nudeln kochen.', expect.anything());
    expect(hook.current.handsFreeEnabled).toBe(true);
  });

  it('pauses without changing the step and resumes through the manual path', async () => {
    const { adapter, speech, sessions } = createVoiceHarness();
    const { result: hook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter, speech }),
    );

    await act(async () => {
      hook.current.startHandsFree();
      await flushAsyncWork();
      const speechOptions = (speech.speak as jest.Mock).mock.calls.at(-1)?.[1] as {
        onDone: () => void;
      };
      speechOptions.onDone();
      await flushAsyncWork();
    });

    await act(async () => {
      hook.current.pauseHandsFree();
      await flushAsyncWork();
    });
    expect(hook.current.status).toBe('paused');
    expect(hook.current.handsFreeEnabled).toBe(true);
    expect(sessions[0]?.cancel).toHaveBeenCalledTimes(1);

    await act(async () => {
      hook.current.resumeHandsFree();
      await flushAsyncWork();
    });
    expect(speech.speak).toHaveBeenCalledTimes(2);
    expect(speech.speak).toHaveBeenLastCalledWith('Zwiebeln fein hacken.', expect.anything());
  });

  it('falls back to touch controls after an unknown hands-free transcript', async () => {
    const { adapter, speech, sessions } = createVoiceHarness();
    const { result: hook } = await renderHook(() =>
      useCookingModeVoice({ ...options, adapter, speech }),
    );

    await act(async () => {
      hook.current.startHandsFree();
      await flushAsyncWork();
      const speechOptions = (speech.speak as jest.Mock).mock.calls.at(-1)?.[1] as {
        onDone: () => void;
      };
      speechOptions.onDone();
      await flushAsyncWork();
      sessions[0].emitFinalResult(transcript('Was mache ich jetzt?'));
      await flushScheduledCommand();
    });

    expect(hook.current.status).toBe('error');
    expect(hook.current.handsFreeEnabled).toBe(false);
    expect(hook.current.error).toContain('Befehl nicht erkannt');
  });
});
