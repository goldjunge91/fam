import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DeleteAccountScreen } from '@/features/settings/delete-account-screen';

const mockInvoke = jest.fn().mockResolvedValue({ data: { success: true }, error: null });
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
    back: jest.fn(),
  },
}));

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  }),
}));

jest.mock('@/lib/db/client', () => ({
  deleteLocalDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.spyOn(Alert, 'alert');

describe('DeleteAccountScreen', () => {
  async function renderScreen() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <QueryClientProvider client={queryClient}>
          <DeleteAccountScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rendert Warnhinweise und Lösch-Button', async () => {
    await renderScreen();

    expect(screen.getByText('Konto löschen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Account löschen' })).toBeTruthy();
  });

  it('öffnet Bestätigungs-Dialog vor der Ausführung', async () => {
    await renderScreen();

    const deleteBtn = screen.getByRole('button', { name: 'Account löschen' });
    fireEvent.press(deleteBtn);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Account wirklich löschen?',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Abbrechen' }),
        expect.objectContaining({ text: 'Endgültig löschen' }),
      ]),
    );
  });
});
