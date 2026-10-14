import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { PermissionStatus } from 'expo-modules-core';
import { router } from 'expo-router';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Alert, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useDevSettingsStore } from '@/constants/dev-settings';
import { debugLogEvent } from '@/lib/observability/debug-log';
import { DevToolsScreen } from './dev-tools-screen';

const mockStorageData = new Map<string, string>();

jest.mock('@/lib/storage/local-device-storage', () => ({
  getDeviceStorage: () => ({
    getString: (key: string) => mockStorageData.get(key),
    remove: (key: string) => mockStorageData.delete(key),
    set: (key: string, value: string) => mockStorageData.set(key, value),
  }),
}));

const mockRedirect = jest.fn();
let mockHasDevToolsAccess = true;

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Redirect: (props: { href: string }) => {
    mockRedirect(props);
    return null;
  },
}));

jest.mock('@/hooks/use-dev-tools-access', () => ({
  useDevToolsAccess: () => mockHasDevToolsAccess,
}));

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestMicrophonePermissionsAsync: jest.fn(),
  },
}));

jest.mock('@/lib/observability/debug-log', () => ({
  debugLog: jest.fn(),
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
    mockHasDevToolsAccess = true;
    mockRedirect.mockClear();
    useDevSettingsStore.getState().setSpeechTestProvider('native');
    useDevSettingsStore.getState().setReceiptOcrTestEnabled(false);
    jest.mocked(router.push).mockClear();
    jest.mocked(ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync).mockReset();
  });

  afterEach(() => jest.restoreAllMocks());

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

  it('öffnet den OCR-Pipeline-Inspector', async () => {
    await renderScreen();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'OCR-Pipeline analysieren' }));

    expect(router.push).toHaveBeenCalledWith('/settings/dev-ocr-inspector');
  });

  it('aktiviert die OCR-Anbieterauswahl für den Kassenbon-Upload', async () => {
    await renderScreen();
    const user = userEvent.setup();

    expect(screen.getByRole('radio', { name: 'Aus', selected: true })).toBeOnTheScreen();
    await user.press(screen.getByRole('radio', { name: 'An' }));

    expect(useDevSettingsStore.getState().receiptOcrTestEnabled).toBe(true);
  });

  it('leitet zu den Einstellungen um, wenn kein Entwickler-Zugriff besteht', async () => {
    mockHasDevToolsAccess = false;
    await renderScreen();

    expect(mockRedirect).toHaveBeenCalledWith({ href: '/settings' });
    expect(screen.queryByText('Entwickler')).toBeNull();
  });

  it.each([
    [true, true, 'Mikrofon freigegeben'],
    [false, true, 'Mikrofon nicht freigegeben'],
  ] as const)('zeigt den jeweiligen Mikrofon-Status an', async (granted, canAskAgain, title) => {
    jest.mocked(ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync).mockResolvedValue({
      granted,
      canAskAgain,
      expires: 'never',
      status: granted ? PermissionStatus.GRANTED : PermissionStatus.DENIED,
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Mikrofon freigeben' }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith(title, expect.any(String)));
    expect(debugLogEvent).toHaveBeenCalledWith('shopping-list.voice-permission.dev-menu-result', {
      granted,
      status: granted ? PermissionStatus.GRANTED : PermissionStatus.DENIED,
      canAskAgain,
    });
  });

  it('verweist nach dauerhafter Ablehnung auf die Systemeinstellungen', async () => {
    jest.mocked(ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: false,
      expires: 'never',
      status: PermissionStatus.DENIED,
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Mikrofon freigeben' }));
    const buttons = alert.mock.calls[0]?.[2];
    const openSettingsButton = buttons?.find((button) => button.text === 'Einstellungen öffnen');
    await openSettingsButton?.onPress?.();

    expect(openSettings).toHaveBeenCalled();
  });

  it('meldet, wenn das native Speech-Modul die Berechtigungsabfrage nicht anbietet', async () => {
    jest
      .mocked(ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync)
      .mockRejectedValue(new Error('Native module unavailable'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Mikrofon freigeben' }));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Mikrofonberechtigung nicht verfügbar',
        'Der aktuelle Build stellt das native Speech-Modul nicht bereit.',
      ),
    );
    expect(debugLogEvent).toHaveBeenCalledWith('shopping-list.voice-permission.dev-menu-failed', {
      hasError: true,
    });
  });
});
