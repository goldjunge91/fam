import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DeleteAccountScreen } from '@/features/settings/delete-account-screen';

const mockInvoke = jest.fn().mockResolvedValue({ data: { success: true }, error: null });
const mockReplace = jest.fn();
const mockSignOutAndClearLocalData = jest.fn();

jest.mock('@/features/auth/sign-out', () => ({
  signOutAndClearLocalData: (...args: unknown[]) => mockSignOutAndClearLocalData(...args),
}));

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

jest.spyOn(Alert, 'alert');

describe('DeleteAccountScreen', () => {
  async function renderScreen() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
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
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    mockSignOutAndClearLocalData.mockResolvedValue({ error: null });
  });

  it('rendert Warnhinweise und Lösch-Button', async () => {
    await renderScreen();

    expect(screen.getByText('Konto löschen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Account löschen' })).toBeTruthy();
  });

  it('öffnet Bestätigungs-Dialog vor der Ausführung', async () => {
    await renderScreen();

    const deleteBtn = screen.getByRole('button', { name: 'Account löschen' });
    await fireEvent.press(deleteBtn);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Account wirklich löschen?',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Abbrechen' }),
        expect.objectContaining({ text: 'Endgültig löschen' }),
      ]),
    );
  });

  it('verwendet nach erfolgreicher Server-Löschung den zentralen Account-Cleanup', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Account löschen' }));
    const actions = jest.mocked(Alert.alert).mock.calls[0][2];
    const confirm = actions?.find((action) => action.text === 'Endgültig löschen');

    await act(async () => {
      await confirm?.onPress?.();
    });

    await waitFor(() => expect(mockSignOutAndClearLocalData).toHaveBeenCalled());
    expect(mockSignOutAndClearLocalData).toHaveBeenCalledWith(expect.any(QueryClient));
    expect(mockInvoke.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignOutAndClearLocalData.mock.invocationCallOrder[0],
    );
    expect(mockReplace).toHaveBeenCalledWith('/onboarding');
  });

  it('navigiert bei fehlgeschlagenem lokalen Wipe nicht weiter', async () => {
    mockSignOutAndClearLocalData.mockRejectedValue(new Error('local wipe failed'));
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Account löschen' }));
    const actions = jest.mocked(Alert.alert).mock.calls[0][2];
    const confirm = actions?.find((action) => action.text === 'Endgültig löschen');

    await act(async () => {
      await confirm?.onPress?.();
    });

    expect(mockReplace).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenLastCalledWith('Löschen fehlgeschlagen', 'local wipe failed');
  });
});
