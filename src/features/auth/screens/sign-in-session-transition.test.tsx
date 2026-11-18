import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SignInScreen } from '@/features/auth/screens/sign-in-screen';
import { i18n } from '@/i18n';

const mockSignIn = jest.fn();
let mockSession: { user: { id: string } } | null = null;

jest.mock('expo-router', () => {
  const actual = jest.requireActual<typeof import('expo-router')>('expo-router');

  return {
    ...actual,
    router: { replace: jest.fn() },
  };
});

jest.mock('@/features/auth/api', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockSession }),
}));

jest.mock('@/features/auth/oauth-provider-actions', () => ({
  signInWithOAuthProvider: jest.fn(),
  signInWithApple: jest.fn(),
}));

jest.mock('@/lib/observability/debug-log', () => ({
  debugLog: jest.fn(),
  debugLogEvent: jest.fn(),
}));

function screenTree() {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <SignInScreen />
    </SafeAreaProvider>
  );
}

describe('SignInScreen session transition', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSession = null;
    mockSignIn.mockResolvedValue({ data: { session: {} }, error: null });
    await i18n.changeLanguage('de');
  });

  it('retries the app entry when the session context catches up after a successful login', async () => {
    const user = userEvent.setup();
    const { rerender } = await render(screenTree());

    await user.type(screen.getByLabelText('E-Mail'), 'test@example.com');
    await user.type(screen.getByLabelText('Passwort'), 'password123');
    await user.press(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    expect(router.replace).toHaveBeenCalledTimes(1);

    mockSession = { user: { id: 'user-1' } };
    await rerender(screenTree());

    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(2));
    expect(router.replace).toHaveBeenLastCalledWith('/');
  });
});
