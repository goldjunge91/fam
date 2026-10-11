import { act, renderHook } from '@testing-library/react-native';
import { AudioManager, AudioRecorder } from 'react-native-audio-api';

import { useExecuTorchAudioRecorder } from './use-executorch-audio-recorder';

jest.mock('react-native-audio-api', () => ({
  AudioManager: {
    setAudioSessionOptions: jest.fn(),
    requestRecordingPermissions: jest.fn().mockResolvedValue('Granted'),
  },
  AudioRecorder: jest.fn(() => ({
    onAudioReady: jest.fn(),
    start: jest.fn().mockResolvedValue({ status: 'success' }),
    stop: jest.fn().mockResolvedValue({ status: 'success' }),
  })),
}));

type RecorderDouble = {
  onAudioReady: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
};

function recorderAt(index: number): RecorderDouble {
  const instance = (AudioRecorder as jest.Mock).mock.results[index]?.value;
  if (!instance) throw new Error(`Recorder ${index} was not created`);
  return instance as RecorderDouble;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(AudioManager.requestRecordingPermissions).mockResolvedValue('Granted');
  (AudioRecorder as jest.Mock).mockImplementation(() => ({
    onAudioReady: jest.fn(),
    start: jest.fn().mockResolvedValue({ status: 'success' }),
    stop: jest.fn().mockResolvedValue({ status: 'success' }),
  }));
});

it('configures the audio session and tolerates a rejected mount permission request', async () => {
  jest.mocked(AudioManager.requestRecordingPermissions).mockRejectedValueOnce(new Error('denied'));

  await renderHook(() => useExecuTorchAudioRecorder());

  expect(AudioManager.setAudioSessionOptions).toHaveBeenCalledWith({
    iosCategory: 'playAndRecord',
    iosMode: 'spokenAudio',
    iosOptions: ['allowBluetoothHFP', 'defaultToSpeaker'],
  });
  expect(AudioManager.requestRecordingPermissions).toHaveBeenCalledTimes(1);
});

it('rejects recording when microphone permission is not granted', async () => {
  jest.mocked(AudioManager.requestRecordingPermissions).mockResolvedValue('Denied');
  const { result } = await renderHook(() => useExecuTorchAudioRecorder());

  await expect(result.current.startRecording(16_000, jest.fn())).rejects.toThrow(
    'Mikrofonberechtigung wurde nicht erteilt.',
  );
  expect(AudioRecorder).not.toHaveBeenCalled();
  expect(result.current.isRecording).toBe(false);
});

it('starts capture with the default buffer and copies each audio chunk', async () => {
  const { result } = await renderHook(() => useExecuTorchAudioRecorder());
  const onAudioChunk = jest.fn();

  await act(async () => {
    await result.current.startRecording(16_000, onAudioChunk);
  });

  const recorder = recorderAt(0);
  expect(recorder.onAudioReady).toHaveBeenCalledWith(
    { sampleRate: 16_000, bufferLength: 4096, channelCount: 1 },
    expect.any(Function),
  );
  expect(result.current.isRecording).toBe(true);

  const samples = new Float32Array([0.25, -0.5]);
  const callback = recorder.onAudioReady.mock.calls[0]?.[1] as (event: {
    buffer: { getChannelData: jest.Mock };
  }) => void;
  callback({ buffer: { getChannelData: jest.fn(() => samples) } });

  expect(onAudioChunk).toHaveBeenCalledWith(new Float32Array([0.25, -0.5]));
  expect(onAudioChunk.mock.calls[0]?.[0]).not.toBe(samples);
});

it('uses a supplied buffer size and stops an active recorder', async () => {
  const { result } = await renderHook(() => useExecuTorchAudioRecorder());

  await act(async () => {
    await result.current.startRecording(48_000, jest.fn(), 2048);
  });
  await act(async () => {
    await result.current.stopRecording();
  });

  expect(recorderAt(0).onAudioReady.mock.calls[0]?.[0]).toEqual({
    sampleRate: 48_000,
    bufferLength: 2048,
    channelCount: 1,
  });
  expect(recorderAt(0).stop).toHaveBeenCalledTimes(1);
  expect(result.current.isRecording).toBe(false);
});

it('stops a previous recorder before starting another and tolerates stop errors', async () => {
  const { result } = await renderHook(() => useExecuTorchAudioRecorder());
  await act(async () => {
    await result.current.startRecording(16_000, jest.fn());
  });
  recorderAt(0).stop.mockRejectedValueOnce(new Error('native stop failed'));

  await act(async () => {
    await result.current.startRecording(16_000, jest.fn());
  });

  expect(recorderAt(0).stop).toHaveBeenCalledTimes(1);
  expect(AudioRecorder).toHaveBeenCalledTimes(2);
  expect(result.current.isRecording).toBe(true);
});

it.each([
  [{ status: 'error', message: 'Audio route unavailable' }, 'Audio route unavailable'],
  [{ status: 'error' }, 'Mikrofonaufnahme konnte nicht gestartet werden.'],
])(
  'reports recorder start failure and uses the fallback message when needed',
  async (response, message) => {
    const { result } = await renderHook(() => useExecuTorchAudioRecorder());
    (AudioRecorder as jest.Mock).mockImplementationOnce(() => ({
      onAudioReady: jest.fn(),
      start: jest.fn().mockResolvedValue(response),
      stop: jest.fn().mockResolvedValue({ status: 'success' }),
    }));

    await expect(result.current.startRecording(16_000, jest.fn())).rejects.toThrow(message);
    expect(result.current.isRecording).toBe(false);
  },
);

it('stops an active recorder when the hook unmounts', async () => {
  const { result, unmount } = await renderHook(() => useExecuTorchAudioRecorder());
  await act(async () => {
    await result.current.startRecording(16_000, jest.fn());
  });

  await unmount();

  expect(recorderAt(0).stop).toHaveBeenCalledTimes(1);
});
