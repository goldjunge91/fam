import { act, render, screen, userEvent } from '@testing-library/react-native';
import { PermissionStatus } from 'expo-modules-core';
import { ExpoSpeechRecognitionModule, SpeechRecognizerErrorAndroid } from 'expo-speech-recognition';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { useDevToolsAccess } from '@/hooks/use-dev-tools-access';
import { ExpoSpeechRecognitionExampleScreen } from './expo-speech-recognition-example-screen';

function mockPermissionResponse(granted: boolean, restricted?: boolean) {
  return {
    status: granted ? PermissionStatus.GRANTED : PermissionStatus.DENIED,
    expires: 'never' as const,
    granted,
    canAskAgain: true,
    restricted,
  };
}

jest.mock('expo-speech-recognition', () => {
  const handlers = new Map();
  return {
    ExpoSpeechRecognitionModule: {
      requestMicrophonePermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
      requestSpeechRecognizerPermissionsAsync: jest
        .fn()
        .mockResolvedValue(mockPermissionResponse(true, false)),
      start: jest.fn(),
      stop: jest.fn(),
      abort: jest.fn(),
    },
    SpeechRecognizerErrorAndroid: {
      ERROR_NETWORK_TIMEOUT: 1,
      ERROR_TOO_MANY_REQUESTS: 10,
    },
    useSpeechRecognitionEvent: jest.fn((eventName: string, listener: (payload: never) => void) => {
      handlers.set(eventName, listener);
    }),
    __handlers: handlers,
  };
});

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, null, href),
  };
});

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
jest.mock('@/hooks/use-dev-tools-access', () => ({ useDevToolsAccess: jest.fn(() => true) }));
jest.mock('@/lib/observability/debug-log', () => ({ debugLog: jest.fn() }));

type EventHandlers = {
  __handlers: Map<string, (event: never) => void>;
};

const eventHandlers = (jest.requireMock('expo-speech-recognition') as EventHandlers).__handlers;
const originalPlatform = Platform.OS;

async function emit(event: string, payload: unknown = {}): Promise<void> {
  const handler = eventHandlers.get(event);
  if (!handler) throw new Error(`No listener registered for ${event}`);
  await act(async () => {
    handler(payload as never);
  });
}

function setPlatform(os: string): void {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

beforeEach(() => {
  jest.clearAllMocks();
  eventHandlers.clear();
  setPlatform('ios');
  jest
    .mocked(ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync)
    .mockResolvedValue(mockPermissionResponse(true));
  jest
    .mocked(ExpoSpeechRecognitionModule.requestSpeechRecognizerPermissionsAsync)
    .mockResolvedValue(mockPermissionResponse(true, false));
  jest.mocked(useDevToolsAccess).mockReturnValue(true);
});

afterAll(() => {
  setPlatform(originalPlatform);
});

it('redirects users without developer access', async () => {
  jest.mocked(useDevToolsAccess).mockReturnValue(false);
  await render(<ExpoSpeechRecognitionExampleScreen />);

  expect(screen.getByText('/settings')).toBeOnTheScreen();
});

it('returns to idle and displays an error when microphone permission is denied', async () => {
  jest
    .mocked(ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync)
    .mockResolvedValue(mockPermissionResponse(false));
  const user = userEvent.setup();
  await render(<ExpoSpeechRecognitionExampleScreen />);
  await user.press(screen.getByRole('button', { name: 'Erkennung starten' }));

  expect(
    screen.getByText('{"error":"not-allowed","message":"Permissions not granted"}'),
  ).toBeOnTheScreen();
  expect(screen.getByText('idle')).toBeOnTheScreen();
  expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
});

it.each([
  [true, 'Speech recognition is restricted.'],
  [false, 'Permissions not granted'],
])('shows the iOS speech permission result (restricted=%s)', async (restricted, message) => {
  jest
    .mocked(ExpoSpeechRecognitionModule.requestSpeechRecognizerPermissionsAsync)
    .mockResolvedValue(mockPermissionResponse(false, restricted));
  const user = userEvent.setup();
  await render(<ExpoSpeechRecognitionExampleScreen />);
  await user.press(screen.getByRole('button', { name: 'Erkennung starten' }));

  expect(screen.getByText(`{"error":"not-allowed","message":"${message}"}`)).toBeOnTheScreen();
  expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
});

it('starts with the reference options, accumulates interim and final results, and supports stop and abort', async () => {
  const user = userEvent.setup();
  await render(<ExpoSpeechRecognitionExampleScreen />);
  await user.press(screen.getByRole('button', { name: 'Erkennung starten' }));

  expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(
    expect.objectContaining({
      lang: 'de-DE',
      interimResults: true,
      maxAlternatives: 3,
      continuous: true,
      requiresOnDeviceRecognition: false,
      addsPunctuation: true,
    }),
  );
  expect(ExpoSpeechRecognitionModule.requestSpeechRecognizerPermissionsAsync).toHaveBeenCalled();

  await emit('start');
  expect(screen.getByText('recognizing')).toBeOnTheScreen();
  await emit('result', { isFinal: false, results: [{ transcript: 'Guten' }] });
  expect(screen.getByText('Guten')).toBeOnTheScreen();
  await emit('result', { isFinal: true, results: [{ transcript: 'Tag' }] });
  expect(screen.getByText('Tag')).toBeOnTheScreen();
  await emit('result', { isFinal: false, results: [{ transcript: '!' }] });
  expect(screen.getByText('Tag!')).toBeOnTheScreen();

  await user.press(screen.getByRole('button', { name: 'Stop' }));
  await user.press(screen.getByRole('button', { name: 'Abbrechen' }));
  expect(ExpoSpeechRecognitionModule.stop).toHaveBeenCalledTimes(1);
  expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalledTimes(1);
  await emit('end');
  expect(screen.getByText('idle')).toBeOnTheScreen();
});

it('does not request iOS speech permission on Android', async () => {
  setPlatform('android');
  const user = userEvent.setup();
  await render(<ExpoSpeechRecognitionExampleScreen />);
  await user.press(screen.getByRole('button', { name: 'Erkennung starten' }));

  expect(ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync).toHaveBeenCalled();
  expect(
    ExpoSpeechRecognitionModule.requestSpeechRecognizerPermissionsAsync,
  ).not.toHaveBeenCalled();
  expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalled();
});

it('logs auxiliary events and displays recognizer errors with and without codes', async () => {
  await render(<ExpoSpeechRecognitionExampleScreen />);

  await emit('audiostart', { type: 'start' });
  await emit('audioend', { type: 'end' });
  await emit('nomatch');
  await emit('languagedetection', { language: 'de-DE' });
  await emit('error', {
    error: 'network-timeout',
    message: 'Timed out',
    code: SpeechRecognizerErrorAndroid.ERROR_NETWORK_TIMEOUT,
  });
  expect(
    screen.getByText('{"error":"network-timeout","message":"Timed out","code":1}'),
  ).toBeOnTheScreen();
  expect(screen.getByText('idle')).toBeOnTheScreen();

  await emit('error', { error: 'too-many-requests', message: 'Slow down', code: 10 });
  expect(
    screen.getByText('{"error":"too-many-requests","message":"Slow down","code":10}'),
  ).toBeOnTheScreen();
  await emit('error', { error: 'service-error', message: 'Failed' });
  expect(screen.getByText('{"error":"service-error","message":"Failed"}')).toBeOnTheScreen();
});
