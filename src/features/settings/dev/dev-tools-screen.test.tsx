import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useDevSettingsStore } from '@/constants/dev-settings';
import { DevToolsScreen } from './dev-tools-screen';

const mockStorageData = new Map<string, string>();

jest.mock('@/lib/storage/device-storage', () => ({
  getDeviceStorage: () => ({
    getString: (key: string) => mockStorageData.get(key),
    remove: (key: string) => mockStorageData.delete(key),
    set: (key: string, value: string) => mockStorageData.set(key, value),
  }),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestMicrophonePermissionsAsync: jest.fn(),
  },
}));

jest.mock('@/lib/observability/debug-log', () => ({
  debugLogEvent: jest.fn(),
}));

describe('DevToolsScreen', () => {
  async function renderScreen() {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
        }}>
        <DevToolsScreen />
      </SafeAreaProvider>,
    );
  }

  beforeEach(() => {
    mockStorageData.clear();
    useDevSettingsStore.getState().setSpeechTestProvider('native');
    jest.mocked(router.push).mockClear();
  });

  it('schaltet zwischen Apple Speech und Whisper um', async () => {
    await renderScreen();
    const user = userEvent.setup();

    expect(screen.getByRole('radio', { name: 'Apple Speech', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Apple Speech testen' })).toBeOnTheScreen();

    await user.press(screen.getByRole('radio', { name: 'Whisper' }));

    expect(screen.getByRole('radio', { name: 'Whisper', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Whisper testen' })).toBeOnTheScreen();
    expect(useDevSettingsStore.getState().speechTestProvider).toBe('whisper');
  });

  it('öffnet den Testscreen des ausgewählten Anbieters', async () => {
    await renderScreen();
    const user = userEvent.setup();

    await user.press(screen.getByRole('radio', { name: 'Whisper' }));
    await user.press(screen.getByRole('button', { name: 'Whisper testen' }));

    expect(router.push).toHaveBeenCalledWith('/settings/dev-executorch-speech-to-text');
  });
});
