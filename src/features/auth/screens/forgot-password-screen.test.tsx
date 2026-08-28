import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ForgotPasswordScreen } from '@/features/auth/screens/forgot-password-screen';

const mockRequestPasswordReset = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => false);
let mockSearchParams: { from?: string } = {};

jest.mock('expo-router', () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => mockCanGoBack(),
  },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('@/features/auth/api', () => ({
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
}));

jest.mock('@/features/auth/domain/auth-error-message', () => ({
  authErrorMessage: (error: { message: string }) => error.message,
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
    mockSearchParams = {};
    mockCanGoBack.mockReturnValue(false);
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
    });
    expect(await screen.findByText('E-Mail unterwegs')).toBeOnTheScreen();
  });

  it('kehrt aus dem Onboarding nach der Anfrage zum Account-Schritt zurück', async () => {
    mockSearchParams = { from: 'onboarding' };
    mockCanGoBack.mockReturnValue(true);
    mockRequestPasswordReset.mockResolvedValue({ error: null });

    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('E-Mail'), 'anna@test.fam');
    await fireEvent.press(screen.getByRole('button', { name: 'Link anfordern' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Zurück zum Onboarding' }));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
