import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useSpeechToText } from 'react-native-executorch';
import { speechLocaleToLanguageCode } from '@/features/shopping-list/stt-beta/services/speech-locale';
import { useDevToolsAccess } from '@/hooks/use-dev-tools-access';
import { ExecuTorchSpeechToTextScreen } from './executorch-speech-to-text-screen';
import { useExecuTorchAudioRecorder } from './use-executorch-audio-recorder';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Redirect: ({ href }: { href: string }) => React.createElement(Text, null, href) };
});

jest.mock('react-native-executorch', () => ({
  models: { speechToText: { WHISPER: { TINY: { DEFAULT: 'whisper-tiny' } } } },
  WHISPER_LANGUAGES: ['de', 'en'],
  WHISPER_SAMPLE_RATE_HZ: 16_000,
  useSpeechToText: jest.fn(),
}));

jest.mock('@/components/layout/screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Screen: ({ title, children }: { title: string; children: ReactNode }) =>
      React.createElement(View, null, React.createElement(Text, null, title), children),
  };
});

jest.mock('@/components/ui/content-card', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ContentCard: ({ title, children }: { title: string; children: ReactNode }) =>
      React.createElement(View, null, React.createElement(Text, null, title), children),
  };
});

jest.mock('@/constants/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Txt: ({ children }: { children: ReactNode }) => React.createElement(Text, null, children),
    Button: ({
      title,
      onPress,
      disabled,
    }: {
      title: string;
      onPress: () => void;
      disabled?: boolean;
    }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel: title, onPress, disabled },
        React.createElement(Text, null, title),
      ),
  };
});

jest.mock('@/components/theme/index', () => ({ space: { md: 12 } }));
jest.mock('@/features/shopping-list/stt-beta/services/speech-locale', () => ({
  getDeviceSpeechLocale: jest.fn(() => 'de-DE'),
  speechLocaleToLanguageCode: jest.fn(() => 'de'),
}));
jest.mock('@/hooks/use-dev-tools-access', () => ({ useDevToolsAccess: jest.fn(() => true) }));
jest.mock('@/lib/observability/debug-log', () => ({
  debugLog: jest.fn(),
  debugLogEvent: jest.fn(),
}));
jest.mock('./use-executorch-audio-recorder', () => ({
  useExecuTorchAudioRecorder: jest.fn(),
}));

type SttState = {
  isReady: boolean;
  error: Error | null;
  downloadProgress: number;
  stream?: (options: { language: string }) => AsyncIterable<{
    committed: string;
    nonCommitted: string;
  }>;
  streamInsert?: jest.Mock;
  streamStop?: jest.Mock;
};

type RecorderState = {
  isRecording: boolean;
  startRecording: jest.Mock;
  stopRecording: jest.Mock;
};

const sttState: SttState = {
  isReady: false,
  error: null,
  downloadProgress: 42,
  stream: jest.fn(async function* () {
    yield { committed: 'Hallo', nonCommitted: 'Welt' };
  }),
  streamInsert: jest.fn(),
  streamStop: jest.fn(),
};

const recorderState: RecorderState = {
  isRecording: false,
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  sttState.isReady = false;
  sttState.error = null;
  sttState.downloadProgress = 42;
  sttState.stream = jest.fn(async function* () {
    yield { committed: 'Hallo', nonCommitted: 'Welt' };
  });
  sttState.streamInsert = jest.fn();
  sttState.streamStop = jest.fn();
  recorderState.isRecording = false;
  recorderState.startRecording.mockReset().mockImplementation(async (_rate, onAudioChunk) => {
    onAudioChunk(new Float32Array([0.1, 0.2]));
    recorderState.isRecording = true;
  });
  recorderState.stopRecording.mockReset().mockImplementation(async () => {
    recorderState.isRecording = false;
  });
  jest
    .mocked(useSpeechToText)
    .mockImplementation(
      (_, options) =>
        ({ ...sttState, isReady: options?.preventLoad ? false : sttState.isReady }) as never,
    );
  jest.mocked(useExecuTorchAudioRecorder).mockReturnValue(recorderState as never);
  jest.mocked(useDevToolsAccess).mockReturnValue(true);
  jest.mocked(speechLocaleToLanguageCode).mockReturnValue('de');
});

it('redirects when developer tools are unavailable', async () => {
  jest.mocked(useDevToolsAccess).mockReturnValue(false);

  await render(<ExecuTorchSpeechToTextScreen />);

  expect(screen.getByText('/settings')).toBeOnTheScreen();
});

it('shows the initial, loading, model-error, and ready states', async () => {
  sttState.isReady = true;
  sttState.error = new Error('Model download failed');
  const user = userEvent.setup();
  const { rerender } = await render(<ExecuTorchSpeechToTextScreen />);

  expect(screen.getByText('Nicht geladen')).toBeOnTheScreen();
  expect(screen.getByText('Noch keine Sprache erkannt')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Whisper-Modell laden' }));
  expect(screen.getByText('Fehler: Model download failed')).toBeOnTheScreen();

  sttState.error = null;
  await rerender(<ExecuTorchSpeechToTextScreen />);
  expect(screen.getByText('Bereit')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Aufnahme starten' })).toBeEnabled();
});

it('shows download progress and prevents recording until the model is ready', async () => {
  const user = userEvent.setup();
  await render(<ExecuTorchSpeechToTextScreen />);
  await user.press(screen.getByRole('button', { name: 'Whisper-Modell laden' }));

  expect(screen.getByText('Lade Modell: 42 %')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Aufnahme starten' })).toBeDisabled();
  expect(recorderState.startRecording).not.toHaveBeenCalled();
});

it('streams transcript chunks, inserts audio, and stops recording', async () => {
  sttState.isReady = true;
  const user = userEvent.setup();
  await render(<ExecuTorchSpeechToTextScreen />);
  await user.press(screen.getByRole('button', { name: 'Whisper-Modell laden' }));
  await user.press(screen.getByRole('button', { name: 'Aufnahme starten' }));

  expect(sttState.stream).toHaveBeenCalledWith({ language: 'de' });
  expect(recorderState.startRecording).toHaveBeenCalledWith(16_000, expect.any(Function));
  expect(sttState.streamInsert).toHaveBeenCalledWith(new Float32Array([0.1, 0.2]));
  expect(await screen.findByText('Hallo Welt')).toBeOnTheScreen();

  await user.press(screen.getByRole('button', { name: 'Aufnahme stoppen' }));
  expect(recorderState.stopRecording).toHaveBeenCalled();
  expect(sttState.streamStop).toHaveBeenCalled();
});

it('falls back to English when the device language is unsupported', async () => {
  sttState.isReady = true;
  jest.mocked(speechLocaleToLanguageCode).mockReturnValue('fr');
  const user = userEvent.setup();
  await render(<ExecuTorchSpeechToTextScreen />);
  await user.press(screen.getByRole('button', { name: 'Whisper-Modell laden' }));
  await user.press(screen.getByRole('button', { name: 'Aufnahme starten' }));

  expect(sttState.stream).toHaveBeenCalledWith({ language: 'en' });
});

it.each([
  [new Error('Audio permission denied'), 'Audio permission denied'],
  ['Audio hardware unavailable', 'Audio hardware unavailable'],
])('displays recording errors and stops the stream', async (cause, message) => {
  sttState.isReady = true;
  recorderState.startRecording.mockRejectedValueOnce(cause);
  const user = userEvent.setup();
  await render(<ExecuTorchSpeechToTextScreen />);
  await user.press(screen.getByRole('button', { name: 'Whisper-Modell laden' }));
  await user.press(screen.getByRole('button', { name: 'Aufnahme starten' }));

  expect(await screen.findByText(message)).toBeOnTheScreen();
  expect(recorderState.stopRecording).toHaveBeenCalled();
  expect(sttState.streamStop).toHaveBeenCalled();
});

it.each([
  [new Error('Decoder crashed'), 'Decoder crashed'],
  ['Decoder crashed', 'Decoder crashed'],
])(
  'displays asynchronous stream errors and exits safely when streaming is unavailable',
  async (cause, message) => {
    sttState.isReady = true;
    sttState.stream = jest.fn(() => ({
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.reject(cause),
      }),
    }));
    const user = userEvent.setup();
    const firstScreen = await render(<ExecuTorchSpeechToTextScreen />);
    await user.press(screen.getByRole('button', { name: 'Whisper-Modell laden' }));
    await user.press(screen.getByRole('button', { name: 'Aufnahme starten' }));
    expect(await screen.findByText(message)).toBeOnTheScreen();

    await firstScreen.unmount();
    sttState.stream = undefined;
    const noStream = await render(<ExecuTorchSpeechToTextScreen />);
    await user.press(screen.getByRole('button', { name: 'Whisper-Modell laden' }));
    await user.press(screen.getByRole('button', { name: 'Aufnahme starten' }));
    expect(recorderState.startRecording).toHaveBeenCalledTimes(1);
    await noStream.unmount();
  },
);
