import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { usePasswordRecoveryStore } from '@/features/auth/recovery-store';
import { PasswordRecoveryScreen } from '@/features/auth/screens/password-recovery-screen';
import { i18n } from '@/i18n';

const mockClient = { auth: { signOut: jest.fn() } };
const mockRequestPasswordReset = jest.fn();
const mockGetPrimarySessionUserId = jest.fn();
const mockVerifyPasswordRecoveryCode = jest.fn();
const mockVerifyPasswordRecoveryTokenHash = jest.fn();
const mockUpdatePasswordWithRecoveryClient = jest.fn();
const mockTransferPasswordRecoverySession = jest.fn();
const mockDiscardPasswordRecoverySession = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterSetParams = jest.fn();
const mockNavigationDispatch = jest.fn();
let mockRecoveryLinkParams: {
  token_hash?: string | string[];
  type?: string | string[];
} = {};

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: {
      back: (...args: unknown[]) => mockRouterBack(...args),
      canGoBack: () => false,
      replace: (...args: unknown[]) => mockRouterReplace(...args),
      setParams: (...args: unknown[]) => mockRouterSetParams(...args),
    },
    useLocalSearchParams: () => mockRecoveryLinkParams,
    useFocusEffect: (effect: () => undefined | (() => void)) => React.useEffect(effect, [effect]),
    useNavigation: () => ({ dispatch: (...args: unknown[]) => mockNavigationDispatch(...args) }),
  };
});

jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));

jest.mock('@/features/auth/api', () => ({
  discardPasswordRecoverySession: (...args: unknown[]) =>
    mockDiscardPasswordRecoverySession(...args),
  getPrimarySessionUserId: (...args: unknown[]) => mockGetPrimarySessionUserId(...args),
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
  transferPasswordRecoverySession: (...args: unknown[]) =>
    mockTransferPasswordRecoverySession(...args),
  updatePasswordWithRecoveryClient: (...args: unknown[]) =>
    mockUpdatePasswordWithRecoveryClient(...args),
  verifyPasswordRecoveryCode: (...args: unknown[]) => mockVerifyPasswordRecoveryCode(...args),
  verifyPasswordRecoveryTokenHash: (...args: unknown[]) =>
    mockVerifyPasswordRecoveryTokenHash(...args),
}));

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  createPasswordRecoveryClient: () => mockClient,
}));

jest.mock('@/features/auth/domain/auth-error-message', () => ({
  authErrorMessage: (error: { message: string }) => error.message,
}));

describe('PasswordRecoveryScreen', () => {
  async function renderScreen() {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <PasswordRecoveryScreen />
      </SafeAreaProvider>,
    );
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRecoveryLinkParams = {};
    usePasswordRecoveryStore.setState({
      phase: 'entry',
      email: '',
      code: '',
      recoveryLinkFailed: false,
      operation: null,
      cooldownUntil: null,
      recoveryClient: null,
      primaryUserId: undefined,
      recoveryUserId: null,
      outcome: null,
      generation: 0,
    });
    mockGetPrimarySessionUserId.mockResolvedValue(null);
    mockRequestPasswordReset.mockResolvedValue({ error: null });
    mockVerifyPasswordRecoveryCode.mockResolvedValue({
      data: { session: { user: { id: 'recovered-user' } } },
      error: null,
    });
    mockVerifyPasswordRecoveryTokenHash.mockResolvedValue({
      data: { session: { user: { id: 'recovered-user' } } },
      error: null,
    });
    mockUpdatePasswordWithRecoveryClient.mockResolvedValue({ error: null });
    mockTransferPasswordRecoverySession.mockResolvedValue('transferred');
    mockDiscardPasswordRecoverySession.mockResolvedValue({ error: null });
    await i18n.changeLanguage('de');
  });

  it('does not send another email on a cold route and verifies the entered code', async () => {
    await renderScreen();

    expect(mockRequestPasswordReset).not.toHaveBeenCalled();
    expect(screen.getByText('E-Mail-Code eingeben')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('E-Mail'), 'person@example.test');
    await fireEvent.press(screen.getByRole('button', { name: 'Code anfordern' }));
    await waitFor(() =>
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('person@example.test'),
    );

    await fireEvent.changeText(screen.getByLabelText('Code aus der E-Mail'), '000000');
    await act(async () => {
      usePasswordRecoveryStore.setState({ cooldownUntil: Date.now() - 5_000 });
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Code erneut senden' }));
    await waitFor(() => expect(mockRequestPasswordReset).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('password-recovery-code').props.value).toBe('');

    await fireEvent.changeText(screen.getByLabelText('Code aus der E-Mail'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Code prüfen' }));

    expect(await screen.findByTestId('recovery-new-password')).toBeOnTheScreen();
    expect(mockVerifyPasswordRecoveryCode).toHaveBeenCalledWith(
      mockClient,
      'person@example.test',
      '123456',
    );
  });

  it('shows a localized error for an expired legacy reset link', async () => {
    usePasswordRecoveryStore.setState({ recoveryLinkFailed: true });

    await renderScreen();

    expect(
      screen.getByText(
        'Dieser Reset-Link ist abgelaufen oder ungültig. Fordere einen neuen Code an.',
      ),
    ).toBeOnTheScreen();
  });

  it('verifies a recovery link and opens the new-password form', async () => {
    mockRecoveryLinkParams = {
      token_hash: 'single-use-token-hash',
      type: 'recovery',
    };

    await renderScreen();

    expect(await screen.findByTestId('recovery-new-password')).toBeOnTheScreen();
    expect(mockVerifyPasswordRecoveryTokenHash).toHaveBeenCalledWith(
      mockClient,
      'single-use-token-hash',
    );
    expect(mockRouterSetParams).toHaveBeenCalledWith({
      token_hash: undefined,
      type: undefined,
    });
  });
});
