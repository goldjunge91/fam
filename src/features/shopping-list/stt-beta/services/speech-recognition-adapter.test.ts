import type { SpeechInputResult } from '../types';
import {
  CONTEXTUAL_STRING_LIST,
  createSpeechRecognitionAdapter,
  type SpeechRecognitionClient,
} from './speech-recognition-adapter';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageTag: 'de-DE', languageCode: 'de' }]),
}));

type ResultListener = (event: {
  isFinal: boolean;
  results: readonly {
    transcript: string;
  }[];
}) => void;
type ErrorListener = (event: { error: string; message: string }) => void;
type EndListener = () => void;
type VolumeChangeListener = (event: { value: number }) => void;

type FakeSpeechClient = SpeechRecognitionClient & {
  abort: jest.Mock;
  addListener: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  emitResult: (transcript: string, isFinal?: boolean) => void;
  emitVolumeChange: (value: number) => void;
  emitError: (error: string, message?: string) => void;
  emitEnd: () => void;
};

function createFakeSpeechClient(
  overrides: Partial<
    Pick<SpeechRecognitionClient, 'isRecognitionAvailable' | 'supportsOnDeviceRecognition'>
  > = {},
): FakeSpeechClient {
  let resultListener: ResultListener | null = null;
  let errorListener: ErrorListener | null = null;
  let endListener: EndListener | null = null;
  let volumeChangeListener: VolumeChangeListener | null = null;

  return {
    isRecognitionAvailable: overrides.isRecognitionAvailable ?? (() => true),
    supportsOnDeviceRecognition: overrides.supportsOnDeviceRecognition ?? (() => true),
    requestPermissionsAsync: jest.fn(async () => ({
      granted: true,
      status: 'granted',
      canAskAgain: false,
    })),
    requestMicrophonePermissionsAsync: jest.fn(async () => ({
      granted: true,
      status: 'granted',
      canAskAgain: false,
    })),
    requestSpeechRecognizerPermissionsAsync: jest.fn(async () => ({
      granted: true,
      status: 'granted',
      canAskAgain: false,
    })),
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    addListener: jest.fn((eventName, listener) => {
      if (eventName === 'result') resultListener = listener as ResultListener;
      if (eventName === 'error') errorListener = listener as ErrorListener;
      if (eventName === 'end') endListener = listener as EndListener;
      if (eventName === 'volumechange') volumeChangeListener = listener as VolumeChangeListener;
      return {
        remove: jest.fn(),
      };
    }),
    emitResult: (transcript, isFinal = true) => {
      resultListener?.({
        isFinal,
        results: [{ transcript }],
      });
    },
    emitVolumeChange: (value) => {
      volumeChangeListener?.({ value });
    },
    emitError: (error, message = error) => {
      errorListener?.({ error, message });
    },
    emitEnd: () => {
      endListener?.();
    },
  };
}

function expectFallback(
  result: SpeechInputResult,
  status: Exclude<SpeechInputResult, { status: 'transcript' }>['status'],
) {
  expect(result).toMatchObject({
    status,
    text: null,
    locale: 'de-DE',
    onDevice: false,
  });
}

async function waitForRecognitionStart(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('speech recognition adapter', () => {
  it('starts the network-capable recognition contract', async () => {
    const client = createFakeSpeechClient();
    const adapter = createSpeechRecognitionAdapter(client);
    const session = adapter.start();

    await waitForRecognitionStart();

    expect(client.requestMicrophonePermissionsAsync).toHaveBeenCalledTimes(1);
    expect(client.requestSpeechRecognizerPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(client.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(client.start).toHaveBeenCalledWith(
      expect.objectContaining({ requiresOnDeviceRecognition: false }),
    );

    client.emitResult('Äpfel');
    client.emitEnd();

    await expect(session.result).resolves.toMatchObject({
      status: 'transcript',
      onDevice: false,
    });
  });

  it('matches the native network-capable recognition contract', async () => {
    const client = createFakeSpeechClient();
    const adapter = createSpeechRecognitionAdapter(client);
    const session = adapter.start();

    await waitForRecognitionStart();

    expect(client.requestMicrophonePermissionsAsync).toHaveBeenCalledTimes(1);
    expect(client.requestSpeechRecognizerPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(client.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(client.start).toHaveBeenCalledWith({
      lang: 'de-DE',
      contextualStrings: CONTEXTUAL_STRING_LIST,
      interimResults: false,
      maxAlternatives: 1,
      continuous: true,
      requiresOnDeviceRecognition: false,
      addsPunctuation: true,
      iosTaskHint: 'dictation',
    });
    expect(CONTEXTUAL_STRING_LIST).toContain('Erythrit');
    expect(client.start).not.toHaveBeenCalledWith(
      expect.objectContaining({ recordingOptions: expect.anything() }),
    );

    client.emitResult('3 Äpfel und Brot');
    client.emitEnd();

    await expect(session.result).resolves.toEqual({
      status: 'transcript',
      text: '3 Äpfel und Brot',
      locale: 'de-DE',
      onDevice: false,
      error: null,
    });
  });

  it('forwards live input volume when requested by the caller', async () => {
    const client = createFakeSpeechClient();
    const onVolumeChange = jest.fn();
    const adapter = createSpeechRecognitionAdapter(client);
    const session = adapter.start({ onVolumeChange });

    await waitForRecognitionStart();

    expect(client.start).toHaveBeenCalledWith(
      expect.objectContaining({
        volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      }),
    );

    client.emitVolumeChange(4.5);

    expect(onVolumeChange).toHaveBeenCalledWith(4.5);
    session.cancel();
  });

  it('does not require on-device capability for network recognition', async () => {
    const client = createFakeSpeechClient({
      supportsOnDeviceRecognition: () => false,
    });
    const adapter = createSpeechRecognitionAdapter(client);

    const session = adapter.start();

    await waitForRecognitionStart();
    expect(client.requestMicrophonePermissionsAsync).toHaveBeenCalledTimes(1);
    expect(client.requestSpeechRecognizerPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(client.start).toHaveBeenCalledWith(
      expect.objectContaining({ requiresOnDeviceRecognition: false }),
    );
    session.cancel();
  });

  it('collects final transcript pieces until the native end event', async () => {
    const client = createFakeSpeechClient();
    const adapter = createSpeechRecognitionAdapter(client);
    const session = adapter.start();

    await waitForRecognitionStart();

    let settled = false;
    void session.result.then(() => {
      settled = true;
    });

    client.emitResult('3 Äpfel', true);
    await waitForRecognitionStart();
    expect(settled).toBe(false);

    client.emitResult(' und Brot', true);
    client.emitEnd();

    await expect(session.result).resolves.toMatchObject({
      status: 'transcript',
      text: '3 Äpfel und Brot',
    });
  });

  it('separates final transcript pieces when the native chunks have no whitespace', async () => {
    const client = createFakeSpeechClient();
    const adapter = createSpeechRecognitionAdapter(client);
    const session = adapter.start();

    await waitForRecognitionStart();

    client.emitResult('Äpfel', true);
    client.emitResult('Brot', true);
    client.emitEnd();

    await expect(session.result).resolves.toMatchObject({
      status: 'transcript',
      text: 'Äpfel Brot',
    });
  });

  it('uses an explicit stop to finish the continuous recognition session', async () => {
    const client = createFakeSpeechClient();
    const adapter = createSpeechRecognitionAdapter(client);
    const session = adapter.start();

    await waitForRecognitionStart();

    client.emitResult('Äpfel', true);
    session.stop();

    expect(client.stop).toHaveBeenCalledTimes(1);

    client.emitResult(' und Brot', true);
    client.emitEnd();

    await expect(session.result).resolves.toMatchObject({
      status: 'transcript',
      text: 'Äpfel und Brot',
    });
  });

  it('aborts and resolves with a deterministic error when stop never emits end or error', async () => {
    jest.useFakeTimers();
    try {
      const client = createFakeSpeechClient();
      const adapter = createSpeechRecognitionAdapter(client);
      const session = adapter.start();

      await waitForRecognitionStart();

      session.stop();
      jest.runAllTimers();

      await expect(session.result).resolves.toMatchObject({
        status: 'error',
        text: null,
        locale: 'de-DE',
        onDevice: false,
        errorCode: 'recognition-stop-timeout',
      });
      expect(client.stop).toHaveBeenCalledTimes(1);
      expect(client.abort).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the timeout result when abort synchronously emits an aborted error', async () => {
    jest.useFakeTimers();
    try {
      const client = createFakeSpeechClient();
      client.abort.mockImplementation(() => {
        client.emitError('aborted', 'Recognition aborted');
      });
      const adapter = createSpeechRecognitionAdapter(client);
      const session = adapter.start();

      await waitForRecognitionStart();

      session.stop();
      jest.runAllTimers();

      await expect(session.result).resolves.toMatchObject({
        status: 'error',
        text: null,
        locale: 'de-DE',
        onDevice: false,
        errorCode: 'recognition-stop-timeout',
      });
      expect(client.abort).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('aborts the native session when stop throws', async () => {
    const client = createFakeSpeechClient();
    client.stop.mockImplementation(() => {
      throw new Error('native stop failed');
    });
    const adapter = createSpeechRecognitionAdapter(client);
    const session = adapter.start();

    await waitForRecognitionStart();

    session.stop();

    await expect(session.result).resolves.toMatchObject({
      status: 'error',
      text: null,
      locale: 'de-DE',
      onDevice: false,
      error: 'native stop failed',
    });
    expect(client.abort).toHaveBeenCalledTimes(1);
  });

  it('clears the stop timeout when native end arrives after stop', async () => {
    jest.useFakeTimers();
    try {
      const client = createFakeSpeechClient();
      const adapter = createSpeechRecognitionAdapter(client);
      const session = adapter.start();

      await waitForRecognitionStart();

      client.emitResult('Äpfel', true);
      session.stop();
      client.emitEnd();
      await expect(session.result).resolves.toMatchObject({ status: 'transcript' });

      jest.runAllTimers();
      expect(client.abort).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not start native recognition when stopped before permission resolves', async () => {
    let resolvePermission!: (permission: { granted: boolean }) => void;
    const permission = new Promise<{ granted: boolean }>((resolve) => {
      resolvePermission = resolve;
    });
    const client = createFakeSpeechClient();
    client.requestMicrophonePermissionsAsync = jest.fn(() => permission);
    const adapter = createSpeechRecognitionAdapter(client);
    const session = adapter.start();

    session.stop();
    resolvePermission({ granted: true });

    await expect(session.result).resolves.toMatchObject({
      status: 'cancelled',
      text: null,
      locale: 'de-DE',
      onDevice: false,
    });
    expect(client.start).not.toHaveBeenCalled();
  });

  it('returns a capability fallback when speech recognition is unavailable', async () => {
    const client = createFakeSpeechClient({
      isRecognitionAvailable: () => false,
    });
    const adapter = createSpeechRecognitionAdapter(client);

    const session = adapter.start();

    await expect(session.result).resolves.toMatchObject({
      status: 'capability-unavailable',
      text: null,
      locale: 'de-DE',
      onDevice: false,
    });
    expect(client.requestMicrophonePermissionsAsync).not.toHaveBeenCalled();
    expect(client.start).not.toHaveBeenCalled();
  });

  it('returns a permission fallback without starting', async () => {
    const client = createFakeSpeechClient();
    client.requestMicrophonePermissionsAsync = jest.fn(async () => ({ granted: false }));
    const adapter = createSpeechRecognitionAdapter(client);

    const session = adapter.start();

    await expect(session.result).resolves.toMatchObject({
      status: 'permission-denied',
      text: null,
      locale: 'de-DE',
      onDevice: false,
      error: 'Sprachberechtigung verweigert',
    });
    expect(client.start).not.toHaveBeenCalled();
  });

  it('returns a fallback when iOS speech recognition permission is denied', async () => {
    const client = createFakeSpeechClient();
    client.requestSpeechRecognizerPermissionsAsync = jest.fn(async () => ({
      granted: false,
      status: 'denied',
      canAskAgain: false,
    }));
    const adapter = createSpeechRecognitionAdapter(client);

    const session = adapter.start();

    await expect(session.result).resolves.toMatchObject({
      status: 'permission-denied',
      text: null,
      locale: 'de-DE',
      onDevice: false,
      errorCode: 'speech-recognition-permission-denied',
    });
    expect(client.start).not.toHaveBeenCalled();
  });

  it('preserves the native error code for a failed recognition session', async () => {
    const client = createFakeSpeechClient();
    const adapter = createSpeechRecognitionAdapter(client);

    const session = adapter.start();
    await waitForRecognitionStart();
    client.emitError('audio-capture', 'Failed to initialize recognizer');

    await expect(session.result).resolves.toMatchObject({
      status: 'error',
      error:
        'Das Mikrofon konnte nicht initialisiert werden. Prüfe, ob keine andere App das Mikrofon verwendet.',
      errorCode: 'audio-capture',
    });
  });

  it('maps native errors and end without a transcript to testable fallback states', async () => {
    const client = createFakeSpeechClient();
    const adapter = createSpeechRecognitionAdapter(client);

    const errorSession = adapter.start();
    await waitForRecognitionStart();
    client.emitError('network', 'Network recognition is not allowed');
    expectFallback(await errorSession.result, 'error');

    const unavailableSession = adapter.start();
    await waitForRecognitionStart();
    client.emitError('service-not-allowed', 'No local recognition service');
    expectFallback(await unavailableSession.result, 'capability-unavailable');

    const emptySession = adapter.start();
    await waitForRecognitionStart();
    client.emitEnd();
    await expect(emptySession.result).resolves.toMatchObject({
      ...{
        status: 'error',
        text: null,
        locale: 'de-DE',
        onDevice: false,
      },
      error: 'Kein Transkript erhalten',
    });
  });

  it('cancels recognition without exposing audio or accepting a later result', async () => {
    const client = createFakeSpeechClient();
    const adapter = createSpeechRecognitionAdapter(client);
    const session = adapter.start();

    await waitForRecognitionStart();
    session.cancel();
    client.emitResult('Dieser Text darf nicht übernommen werden');

    await expect(session.result).resolves.toMatchObject({
      status: 'cancelled',
      text: null,
      locale: 'de-DE',
      onDevice: false,
    });
    expect(client.abort).toHaveBeenCalledTimes(1);
  });
});
