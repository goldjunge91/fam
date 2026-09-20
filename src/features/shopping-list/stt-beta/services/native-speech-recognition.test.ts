import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import {
  getSpeechRecognizerPermissions,
  nativeSpeechRecognitionAdapter,
  requestSpeechRecognizerPermissions,
} from './native-speech-recognition';

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    getSpeechRecognizerPermissionsAsync: jest.fn(async () => ({ granted: false })),
    requestMicrophonePermissionsAsync: jest.fn(async () => ({ granted: true })),
    requestSpeechRecognizerPermissionsAsync: jest.fn(async () => ({ granted: true })),
    isRecognitionAvailable: jest.fn(() => true),
    supportsOnDeviceRecognition: jest.fn(() => true),
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

const speechModule = ExpoSpeechRecognitionModule as unknown as {
  requestPermissionsAsync: jest.Mock;
  getSpeechRecognizerPermissionsAsync: jest.Mock;
  requestMicrophonePermissionsAsync: jest.Mock;
  requestSpeechRecognizerPermissionsAsync: jest.Mock;
  isRecognitionAvailable: jest.Mock;
  supportsOnDeviceRecognition: jest.Mock;
  start: jest.Mock;
};

async function waitForRecognitionStart(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('native speech recognition adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    speechModule.isRecognitionAvailable.mockReturnValue(true);
    speechModule.supportsOnDeviceRecognition.mockReturnValue(true);
    speechModule.getSpeechRecognizerPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    speechModule.requestMicrophonePermissionsAsync.mockResolvedValue({ granted: true });
    speechModule.requestSpeechRecognizerPermissionsAsync.mockResolvedValue({ granted: true });
  });

  it('reads and requests the dedicated speech-recognizer permission', async () => {
    speechModule.getSpeechRecognizerPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: false,
      status: 'granted',
    });
    speechModule.requestSpeechRecognizerPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: false,
      status: 'granted',
    });

    await expect(getSpeechRecognizerPermissions()).resolves.toEqual({
      granted: true,
      canAskAgain: false,
      status: 'granted',
    });
    await expect(requestSpeechRecognizerPermissions()).resolves.toEqual({
      granted: true,
      canAskAgain: false,
      status: 'granted',
    });
  });

  it('allows network recognition and requests both iOS permissions', async () => {
    const session = nativeSpeechRecognitionAdapter.start();

    await waitForRecognitionStart();

    expect(speechModule.supportsOnDeviceRecognition).not.toHaveBeenCalled();
    expect(speechModule.requestMicrophonePermissionsAsync).toHaveBeenCalledTimes(1);
    expect(speechModule.requestSpeechRecognizerPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(speechModule.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(speechModule.start).toHaveBeenCalledWith(
      expect.objectContaining({ requiresOnDeviceRecognition: false }),
    );

    session.cancel();
  });

  it('does not block network recognition when on-device capability is missing', async () => {
    speechModule.supportsOnDeviceRecognition.mockReturnValue(false);

    const session = nativeSpeechRecognitionAdapter.start();

    await waitForRecognitionStart();
    expect(speechModule.requestMicrophonePermissionsAsync).toHaveBeenCalledTimes(1);
    expect(speechModule.requestSpeechRecognizerPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(speechModule.start).toHaveBeenCalled();
    session.cancel();
  });

  it('reports denied microphone permission without starting recognition', async () => {
    speechModule.requestMicrophonePermissionsAsync.mockResolvedValue({ granted: false });

    const session = nativeSpeechRecognitionAdapter.start();

    await expect(session.result).resolves.toMatchObject({
      status: 'permission-denied',
      text: null,
    });
    expect(speechModule.start).not.toHaveBeenCalled();
  });
});
