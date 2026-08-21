import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ForgotPasswordScreen } from '@/features/auth/forgot-password-screen';

const mockRequestPasswordReset = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
}));

jest.mock('@/features/auth/api', () => ({
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
  authErrorMessage: (err: { message: string }) => err.message,
}));

describe('ForgotPasswordScreen', () => {
  async function renderScreen() {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ForgotPasswordScreen />
      </SafeAreaProvider>,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rendert E-Mail-Eingabe zum Zurücksetzen', async () => {
    await renderScreen();

    expect(screen.getByText('Passwort zurücksetzen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Link anfordern' })).toBeTruthy();
  });

  it('sendet Reset-Link und wechselt zur Bestätigungsansicht', async () => {
    mockRequestPasswordReset.mockResolvedValue({ error: null });

    await renderScreen();

    const input = screen.getByLabelText('E-Mail');
    await fireEvent.changeText(input, 'anna@test.fam');

    const submitBtn = screen.getByRole('button', { name: 'Link anfordern' });
    await fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('anna@test.fam');
      expect(screen.getByText('E-Mail unterwegs')).toBeTruthy();
    });
  });
});
