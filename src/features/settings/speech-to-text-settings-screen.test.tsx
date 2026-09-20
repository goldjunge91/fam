import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { i18n } from '@/i18n';
import { SpeechToTextSettingsScreen } from './speech-to-text-settings-screen';

const mockGetAutoAssign = jest.fn();
const mockGetSpeechRecognizerPermissions = jest.fn();
const mockRequestSpeechRecognizerPermissions = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/settings/auto-assign', () => ({
  autoAssignPort: {
    get: (...args: unknown[]) => mockGetAutoAssign(...args),
    set: jest.fn(),
  },
}));

jest.mock('@/features/shopping-list/stt-beta/services/native-speech-recognition', () => ({
  getSpeechRecognizerPermissions: (...args: unknown[]) =>
    mockGetSpeechRecognizerPermissions(...args),
  requestSpeechRecognizerPermissions: (...args: unknown[]) =>
    mockRequestSpeechRecognizerPermissions(...args),
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <SpeechToTextSettingsScreen />
    </SafeAreaProvider>,
  );
}

describe('SpeechToTextSettingsScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    mockGetAutoAssign.mockReset();
    mockGetAutoAssign.mockResolvedValue('unset');
    mockGetSpeechRecognizerPermissions.mockReset();
    mockGetSpeechRecognizerPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestSpeechRecognizerPermissions.mockReset();
    mockRequestSpeechRecognizerPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
    jest.mocked(router.push).mockClear();
  });

  it('zeigt alle Speech-to-Text-Einstellungen auf einem eigenen Screen', async () => {
    await renderScreen();

    expect(screen.getByText('Intelligente Zuordnung')).toBeOnTheScreen();
    expect(screen.getByText('Sprachkorrekturen')).toBeOnTheScreen();
    expect(
      await screen.findByRole('button', { name: /Sprachdaten zur Transkription/ }),
    ).toBeOnTheScreen();
  });

  it('öffnet die Sprachkorrekturen aus dem Speech-to-Text-Screen', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Sprachkorrekturen' }));

    expect(router.push).toHaveBeenCalledWith('/settings/speech-corrections');
  });
});
