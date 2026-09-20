import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { i18n } from '@/i18n';
import { NameCorrectionsSettingsScreen } from './name-corrections-settings-screen';

const mockGetNameCorrections = jest.fn();
const mockUpdateNameCorrection = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/shopping-list/stt-beta/name-corrections', () => ({
  getNameCorrections: (...args: unknown[]) => mockGetNameCorrections(...args),
  updateNameCorrection: (...args: unknown[]) => mockUpdateNameCorrection(...args),
  normalizeCorrectionName: (value: string) => value.trim().replace(/\s+/gu, ' ').toLowerCase(),
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <NameCorrectionsSettingsScreen />
    </SafeAreaProvider>,
  );
}

describe('NameCorrectionsSettingsScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    mockGetNameCorrections.mockReset();
    mockUpdateNameCorrection.mockReset();
    mockGetNameCorrections.mockResolvedValue([{ original: 'Ski er', corrected: 'Skyr' }]);
    mockUpdateNameCorrection.mockImplementation(
      async (_userId: string, original: string, corrected: string | null) =>
        corrected === null ? [] : [{ original, corrected }],
    );
  });

  it('laedt gemerkte Korrekturen aus dem persoenlichen Speicher', async () => {
    await renderScreen();

    expect(await screen.findByDisplayValue('Skyr')).toBeOnTheScreen();
    expect(mockGetNameCorrections).toHaveBeenCalledWith('user-1');
  });

  it('speichert eine bearbeitete Korrektur', async () => {
    const user = userEvent.setup();
    await renderScreen();

    const input = await screen.findByDisplayValue('Skyr');
    await user.clear(input);
    await user.type(input, 'Skyr natur');
    await user.press(screen.getByRole('button', { name: 'Speichern' }));

    expect(mockUpdateNameCorrection).toHaveBeenCalledWith('user-1', 'Ski er', 'Skyr natur');
  });

  it('loescht eine Korrektur', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Löschen' }));

    expect(mockUpdateNameCorrection).toHaveBeenCalledWith('user-1', 'Ski er', null);
    expect(await screen.findByText('Noch keine Korrekturen gespeichert.')).toBeOnTheScreen();
  });
});
