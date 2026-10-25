import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ForgotPasswordScreen } from '@/features/auth/screens/forgot-password-screen';
import { i18n } from '@/i18n';

const mockRequestCode = jest.fn();
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

jest.mock('@/features/auth/recovery-store', () => ({
  usePasswordRecoveryStore: {
    getState: () => ({ requestCode: (...args: unknown[]) => mockRequestCode(...args) }),
  },
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

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRequestCode.mockResolvedValue({ status: 'ok' });
    mockSearchParams = {};
    mockCanGoBack.mockReturnValue(false);
    await i18n.changeLanguage('de');
  });

  it('rendert E-Mail-Eingabe zum Zurücksetzen', async () => {
    await renderScreen();

    expect(screen.getByText('Passwort zurücksetzen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Code anfordern' })).toBeTruthy();
  });

  it('rendert die Passwort-Reset-Anfrage auf Englisch', async () => {
    await i18n.changeLanguage('en');
    await renderScreen();

    expect(screen.getByText('Reset password')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Request code' })).toBeTruthy();
  });

  it('sendet einen Code und wechselt zur Bestätigungsansicht', async () => {
    await renderScreen();

    const input = screen.getByLabelText('E-Mail');
    await fireEvent.changeText(input, 'anna@test.fam');

    const submitBtn = screen.getByRole('button', { name: 'Code anfordern' });
    await fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(mockRequestCode).toHaveBeenCalledWith('anna@test.fam');
    });
    expect(await screen.findByText('E-Mail unterwegs')).toBeOnTheScreen();
  });

  it('setzt die E-Mail-Adresse in den neutralen englischen Hinweis ein', async () => {
    await i18n.changeLanguage('en');
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'anna@test.fam');
    await fireEvent.press(screen.getByRole('button', { name: 'Request code' }));

    expect(
      await screen.findByText(
        'If an account exists for anna@test.fam, an email with a six-digit code is on its way.',
      ),
    ).toBeOnTheScreen();
  });

  it('behauptet bei einer bereits laufenden Anfrage nicht, der Code sei gesendet', async () => {
    mockRequestCode.mockResolvedValue({ status: 'busy' });
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('E-Mail'), 'anna@test.fam');
    await fireEvent.press(screen.getByRole('button', { name: 'Code anfordern' }));

    expect(screen.queryByText('E-Mail unterwegs')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Code anfordern' })).toBeOnTheScreen();
  });

  it('kehrt aus dem Onboarding nach der Anfrage zum Account-Schritt zurück', async () => {
    mockSearchParams = { from: 'onboarding' };
    mockCanGoBack.mockReturnValue(true);
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('E-Mail'), 'anna@test.fam');
    await fireEvent.press(screen.getByRole('button', { name: 'Code anfordern' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Zurück zum Onboarding' }));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
