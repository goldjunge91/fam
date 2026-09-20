import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import { nativeSpeechRecognitionAdapter } from './native-speech-recognition';

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    requestMicrophonePermissionsAsync: jest.fn(async () => ({ granted: true })),
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
  requestMicrophonePermissionsAsync: jest.Mock;
  isRecognitionAvailable: jest.Mock;
  supportsOnDeviceRecognition: jest.Mock;
  start: jest.Mock;
};

describe('native speech recognition adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    speechModule.isRecognitionAvailable.mockReturnValue(true);
    speechModule.supportsOnDeviceRecognition.mockReturnValue(true);
    speechModule.requestMicrophonePermissionsAsync.mockResolvedValue({ granted: true });
  });

  it('requires on-device recognition and only requests microphone permission', async () => {
    const session = nativeSpeechRecognitionAdapter.start();

    await Promise.resolve();

    expect(speechModule.supportsOnDeviceRecognition).toHaveBeenCalledTimes(1);
    expect(speechModule.requestMicrophonePermissionsAsync).toHaveBeenCalledTimes(1);
    expect(speechModule.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(speechModule.start).toHaveBeenCalledWith(
      expect.objectContaining({ requiresOnDeviceRecognition: true }),
    );

    session.cancel();
  });

  it('reports missing on-device capability without requesting permission or starting', async () => {
    speechModule.supportsOnDeviceRecognition.mockReturnValue(false);

    const session = nativeSpeechRecognitionAdapter.start();

    await expect(session.result).resolves.toMatchObject({
      status: 'capability-unavailable',
      text: null,
    });
    expect(speechModule.requestMicrophonePermissionsAsync).not.toHaveBeenCalled();
    expect(speechModule.start).not.toHaveBeenCalled();
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
