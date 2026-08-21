import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ExportScreen } from '@/features/settings/export-screen';

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

describe('ExportScreen', () => {
  async function renderScreen() {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ExportScreen />
      </SafeAreaProvider>,
    );
  }

  it('rendert Erklärung zum DSGVO-Datenexport und Export-Button', async () => {
    await renderScreen();

    expect(screen.getByText('Export')).toBeTruthy();
    expect(screen.getByText(/Exportiert dein Profil/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Daten exportieren' })).toBeTruthy();
  });
});
