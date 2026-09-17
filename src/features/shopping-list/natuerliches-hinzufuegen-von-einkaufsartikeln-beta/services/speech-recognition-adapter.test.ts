import type { SpeechInputResult, SpeechInputSegment } from '../types';
import {
  createSpeechRecognitionAdapter,
  type SpeechRecognitionAdapter,
  type SpeechRecognitionClient,
  type SpeechRecognitionStartOptions,
} from './speech-recognition-adapter';

type ResultListener = (event: {
  isFinal: boolean;
  results: readonly {
    transcript: string;
    segments?: readonly SpeechInputSegment[];
  }[];
}) => void;
type ErrorListener = (event: { error: string; message: string }) => void;
type EndListener = () => void;

type FakeSpeechClient = SpeechRecognitionClient & {
  abort: jest.Mock;
  addListener: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  emitResult: (
    transcript: string,
    isFinal?: boolean,
    segments?: readonly SpeechInputSegment[],
  ) => void;
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
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    addListener: jest.fn((eventName, listener) => {
      if (eventName === 'result') resultListener = listener as ResultListener;
      if (eventName === 'error') errorListener = listener as ErrorListener;
      if (eventName === 'end') endListener = listener as EndListener;
      return {
        remove: jest.fn(),
      };
    }),
    emitResult: (transcript, isFinal = true, segments) => {
      resultListener?.({
        isFinal,
        results: [{ transcript, segments: segments ?? [] }],
      });
    },
    emitError: (error, message = error) => {
      errorListener?.({ error, message });
    },
    emitEnd: () => {
      endListener?.();
    },
  };
}

function createNetworkSpeechRecognitionAdapter(
  client: SpeechRecognitionClient,
): SpeechRecognitionAdapter {
  const adapter = createSpeechRecognitionAdapter(client, {
    requiresOnDeviceRecognition: false,
  });

  return {
    start: (options: SpeechRecognitionStartOptions = {}) =>
      adapter.start({ ...options, networkRecognitionConsent: true }),
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

describe('speech recognition adapter', () => {
  it('requires explicit consent before starting network recognition', async () => {
    const client = createFakeSpeechClient();
    const adapter = createSpeechRecognitionAdapter(client, {
      requiresOnDeviceRecognition: false,
    });
    const session = adapter.start();

    await expect(session.result).resolves.toMatchObject({
      status: 'consent-required',
      text: null,
      locale: 'de-DE',
      onDevice: false,
      errorCode: 'network-recognition-consent-required',
    });
    expect(client.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(client.start).not.toHaveBeenCalled();
  });

  it('matches the example for network recognition and reports a non-device transcript', async () => {
    const client = createFakeSpeechClient();
    const adapter = createNetworkSpeechRecognitionAdapter(client);
    const session = adapter.start();

    await Promise.resolve();

    expect(client.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(client.requestMicrophonePermissionsAsync).not.toHaveBeenCalled();
    expect(client.start).toHaveBeenCalledWith({
      lang: 'de-DE',
      interimResults: true,
      maxAlternatives: 3,
      continuous: true,
      requiresOnDeviceRecognition: false,
      addsPunctuation: true,
      iosTaskHint: 'dictation',
    });
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

  it('forwards native segment timing metadata with the transcript', async () => {
    const client = createFakeSpeechClient();
    const adapter = createNetworkSpeechRecognitionAdapter(client);
    const session = adapter.start();

    await Promise.resolve();

    const segments = [
      {
        startTimeMillis: 120,
        endTimeMillis: 540,
        segment: 'Milch',
        confidence: 0.98,
      },
      {
        startTimeMillis: 1_120,
        endTimeMillis: 1_480,
        segment: 'Eier',
        confidence: 0.91,
      },
    ] as const;
    client.emitResult('Milch Eier', true, segments);
    client.emitEnd();

    await expect(session.result).resolves.toEqual({
      status: 'transcript',
      text: 'Milch Eier',
      locale: 'de-DE',
      onDevice: false,
      error: null,
      segments,
    });
  });

  it('does not require on-device capability when network recognition is enabled', async () => {
    const client = createFakeSpeechClient({
      supportsOnDeviceRecognition: () => {
        throw new Error('on-device capability must not be queried');
      },
    });
    const adapter = createNetworkSpeechRecognitionAdapter(client);

    const session = adapter.start();

    await Promise.resolve();

    expect(client.start).toHaveBeenCalledTimes(1);
    client.emitResult('Netzwerk-Erkennung');
    client.emitEnd();

    await expect(session.result).resolves.toMatchObject({
      status: 'transcript',
      onDevice: false,
    });
  });

  it('collects final transcript pieces until the native end event', async () => {
    const client = createFakeSpeechClient();
    const adapter = createNetworkSpeechRecognitionAdapter(client);
    const session = adapter.start();

    await Promise.resolve();

    let settled = false;
    void session.result.then(() => {
      settled = true;
    });

    client.emitResult('3 Äpfel', true);
    await Promise.resolve();
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
    const adapter = createNetworkSpeechRecognitionAdapter(client);
    const session = adapter.start();

    await Promise.resolve();

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
    const adapter = createNetworkSpeechRecognitionAdapter(client);
    const session = adapter.start();

    await Promise.resolve();

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
      const adapter = createNetworkSpeechRecognitionAdapter(client);
      const session = adapter.start();

      await Promise.resolve();

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
      const adapter = createNetworkSpeechRecognitionAdapter(client);
      const session = adapter.start();

      await Promise.resolve();

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
    const adapter = createNetworkSpeechRecognitionAdapter(client);
    const session = adapter.start();

    await Promise.resolve();

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
      const adapter = createNetworkSpeechRecognitionAdapter(client);
      const session = adapter.start();

      await Promise.resolve();

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
    client.requestPermissionsAsync = jest.fn(() => permission);
    const adapter = createNetworkSpeechRecognitionAdapter(client);
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
    const adapter = createNetworkSpeechRecognitionAdapter(client);

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
    client.requestPermissionsAsync = jest.fn(async () => ({ granted: false }));
    const adapter = createNetworkSpeechRecognitionAdapter(client);

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

  it('preserves the native error code for a failed recognition session', async () => {
    const client = createFakeSpeechClient();
    const adapter = createNetworkSpeechRecognitionAdapter(client);

    const session = adapter.start();
    await Promise.resolve();
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
    const adapter = createNetworkSpeechRecognitionAdapter(client);

    const errorSession = adapter.start();
    await Promise.resolve();
    client.emitError('network', 'Network recognition is not allowed');
    expectFallback(await errorSession.result, 'error');

    const unavailableSession = adapter.start();
    await Promise.resolve();
    client.emitError('service-not-allowed', 'No local recognition service');
    expectFallback(await unavailableSession.result, 'capability-unavailable');

    const emptySession = adapter.start();
    await Promise.resolve();
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
    const adapter = createNetworkSpeechRecognitionAdapter(client);
    const session = adapter.start();

    await Promise.resolve();
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
