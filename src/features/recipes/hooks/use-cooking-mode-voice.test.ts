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
  const adapter: SpeechRecognitionAdapter = {
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
  return { adapter, speech, sessions };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

async function flushScheduledCommand() {
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
      await flushScheduledCommand();
    });

    expect(onNextStep).toHaveBeenCalledTimes(1);
    expect(hook.current.status).toBe('ready');
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
      await flushScheduledCommand();
    });

    expect(speech.stop).toHaveBeenCalledTimes(stopCallsBeforeListening + 1);
    expect(hook.current.status).toBe('ready');
  });

  it.each([
    ['permission-denied', 'denied'],
    ['capability-unavailable', 'unavailable'],
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
    expect(hook.current.error).toContain(`${nativeStatus} result`);
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
});
