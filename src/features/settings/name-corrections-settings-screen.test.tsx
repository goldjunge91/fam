import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { i18n } from '@/i18n';
import { NameCorrectionsSettingsScreen } from './name-corrections-settings-screen';

const mockGetNameCorrections = jest.fn();
const mockUpdateNameCorrection = jest.fn();
let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } };

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockSession }),
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
    mockSession = { user: { id: 'user-1' } };
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

  it('zeigt leeren Zustand ohne angemeldeten Nutzer und meldet Ladefehler', async () => {
    mockSession = null;
    const view = await renderScreen();

    expect(screen.getByText('Noch keine Korrekturen gespeichert.')).toBeOnTheScreen();
    expect(mockGetNameCorrections).not.toHaveBeenCalled();
    await view.unmount();

    mockSession = { user: { id: 'user-1' } };
    mockGetNameCorrections.mockRejectedValueOnce(new Error('storage unavailable'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();

    expect(await screen.findByText('Noch keine Korrekturen gespeichert.')).toBeOnTheScreen();
    expect(alert).toHaveBeenCalledWith(
      i18n.t('settings.groups.app.naturalLanguageBeta.corrections.loadErrorTitle'),
      i18n.t('settings.groups.app.naturalLanguageBeta.corrections.loadErrorBody'),
    );
  });

  it('deaktiviert Speichern für leere oder unveränderte normalisierte Namen', async () => {
    const user = userEvent.setup();
    await renderScreen();

    const input = await screen.findByDisplayValue('Skyr');
    const save = screen.getByRole('button', { name: 'Speichern' });
    expect(save).toBeEnabled();

    await user.clear(input);
    expect(save).toBeDisabled();
    await user.type(input, '   ');
    expect(save).toBeDisabled();

    await user.clear(input);
    await user.type(input, '  SKI   er  ');
    expect(save).toBeDisabled();
    expect(mockUpdateNameCorrection).not.toHaveBeenCalled();
  });

  it('meldet Speicher- und Löschfehler, ohne die Korrektur zu entfernen', async () => {
    const user = userEvent.setup();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockUpdateNameCorrection.mockRejectedValue(new Error('write failed'));
    await renderScreen();

    const input = await screen.findByDisplayValue('Skyr');
    await user.clear(input);
    await user.type(input, 'Skyr bio');
    await user.press(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        i18n.t('settings.groups.app.naturalLanguageBeta.corrections.saveErrorTitle'),
        i18n.t('settings.groups.app.naturalLanguageBeta.corrections.saveErrorBody'),
      ),
    );

    await user.press(screen.getByRole('button', { name: 'Löschen' }));
    await waitFor(() =>
      expect(alert).toHaveBeenLastCalledWith(
        i18n.t('settings.groups.app.naturalLanguageBeta.corrections.deleteErrorTitle'),
        i18n.t('settings.groups.app.naturalLanguageBeta.corrections.deleteErrorBody'),
      ),
    );
    expect(screen.getByDisplayValue('Skyr bio')).toBeOnTheScreen();
  });
});
