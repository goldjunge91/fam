import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
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
const mockNavigationSetParams = jest.fn();
const mockGlobalRouterSetParams = jest.fn((..._args: unknown[]) => {
  throw new Error('Global router is not ready');
});
const mockNavigationDispatch = jest.fn();
const mockUsePreventRemove = jest.fn();
let mockCanGoBack = false;
let mockSessionState: {
  session: { user: { id: string } } | null;
  accountReady: boolean;
  error: Error | null;
} = { session: null, accountReady: true, error: null };
let mockAppEntryReadiness: { userId: string | undefined; isReady: boolean } | null = null;
let mockRecoveryLinkParams: {
  token_hash?: string | string[];
  type?: string | string[];
} = {};

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: {
      back: (...args: unknown[]) => mockRouterBack(...args),
      canGoBack: () => mockCanGoBack,
      replace: (...args: unknown[]) => mockRouterReplace(...args),
      setParams: (...args: unknown[]) => mockGlobalRouterSetParams(...args),
    },
    useLocalSearchParams: () => mockRecoveryLinkParams,
    useFocusEffect: (effect: () => undefined | (() => void)) => React.useEffect(effect, [effect]),
    useNavigation: () => ({
      dispatch: (...args: unknown[]) => mockNavigationDispatch(...args),
      setParams: (...args: unknown[]) => mockNavigationSetParams(...args),
    }),
  };
});

jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (...args: unknown[]) => mockUsePreventRemove(...args),
}));

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
jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => mockSessionState,
}));
jest.mock('@/features/onboarding/app-entry-readiness', () => ({
  useAppEntryReadiness: () => mockAppEntryReadiness,
}));

describe('PasswordRecoveryScreen', () => {
  function passwordRecoveryScreen() {
    return (
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <PasswordRecoveryScreen />
      </SafeAreaProvider>
    );
  }

  async function renderScreen() {
    return render(passwordRecoveryScreen());
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCanGoBack = false;
    mockSessionState = { session: null, accountReady: true, error: null };
    mockAppEntryReadiness = { userId: 'recovered-user', isReady: true };
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

  afterEach(() => jest.restoreAllMocks());

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
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('verifies each recovery link once before the global router is ready', async () => {
    mockRecoveryLinkParams = {
      token_hash: 'single-use-token-hash',
      type: 'recovery',
    };

    const view = await renderScreen();

    expect(await screen.findByTestId('recovery-new-password')).toBeOnTheScreen();
    expect(mockVerifyPasswordRecoveryTokenHash).toHaveBeenCalledWith(
      mockClient,
      'single-use-token-hash',
    );
    expect(mockNavigationSetParams).toHaveBeenCalledWith({
      token_hash: undefined,
      type: undefined,
    });
    expect(mockGlobalRouterSetParams).not.toHaveBeenCalled();

    await view.rerender(passwordRecoveryScreen());

    expect(mockNavigationSetParams).toHaveBeenCalledTimes(1);
    expect(mockVerifyPasswordRecoveryTokenHash).toHaveBeenCalledTimes(1);
  });

  it('validates mismatched new passwords without updating the password', async () => {
    const store = usePasswordRecoveryStore.getState();
    store.setEmail('person@example.test');
    store.setCode('123456');
    await store.verifyCode();
    await renderScreen();

    await fireEvent.changeText(screen.getByLabelText('Neues Passwort'), 'StrongPassword123!');
    await fireEvent.changeText(screen.getByLabelText('Passwort wiederholen'), 'Different123!');
    await fireEvent.press(screen.getByRole('button', { name: 'Passwort speichern' }));

    expect(await screen.findByText('Die Passwörter stimmen nicht überein.')).toBeOnTheScreen();
    expect(mockUpdatePasswordWithRecoveryClient).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  const recoveredUserId = 'recovered-user';
  const bugConditionSessionStates = [null, recoveredUserId, 'other-user']
    .flatMap((sessionUserId) =>
      [false, true].flatMap((accountReady) =>
        [null, new Error('session bootstrap failed')].map((sessionError) => ({
          name: `sessionUserId=${sessionUserId ?? 'null'}, accountReady=${String(accountReady)}, sessionError=${sessionError ? 'Error' : 'null'}`,
          sessionUserId,
          accountReady,
          sessionError,
        })),
      ),
    )
    .filter(
      ({ sessionUserId, accountReady, sessionError }) =>
        !(sessionUserId === recoveredUserId && accountReady && sessionError === null),
    );

  // design.md's isBugCondition fixes signed-out + ok/signed-in + recovered-user and
  // spans every provider state where R(recovered-user) is false. Historical F called
  // router.replace('/') for every row before R(recovered-user) became true.
  it.each(bugConditionSessionStates)(
    'keeps recovery success visible for isBugCondition ($name)',
    async ({ sessionUserId, accountReady, sessionError }) => {
      mockSessionState = {
        session: sessionUserId ? { user: { id: sessionUserId } } : null,
        accountReady,
        error: sessionError,
      };
      const store = usePasswordRecoveryStore.getState();
      store.setEmail('person@example.test');
      store.setCode('123456');
      await store.verifyCode();
      expect(usePasswordRecoveryStore.getState().recoveryUserId).toBe(recoveredUserId);
      const view = await renderScreen();

      await fireEvent.changeText(screen.getByLabelText('Neues Passwort'), 'StrongPassword123!');
      await fireEvent.changeText(
        screen.getByLabelText('Passwort wiederholen'),
        'StrongPassword123!',
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Passwort speichern' }));

      expect(await screen.findByText('Passwort geändert')).toBeVisible();
      expect(usePasswordRecoveryStore.getState()).toMatchObject({
        phase: 'updated',
        outcome: 'signed-in',
      });
      expect(mockRouterReplace).not.toHaveBeenCalled();

      mockSessionState = {
        session: { user: { id: recoveredUserId } },
        accountReady: true,
        error: null,
      };
      await view.rerender(passwordRecoveryScreen());

      await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledTimes(1));
      expect(mockRouterReplace).toHaveBeenCalledWith('/');

      await view.rerender(passwordRecoveryScreen());

      expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps recovery success visible until normal app entry is ready', async () => {
    mockSessionState = {
      session: { user: { id: recoveredUserId } },
      accountReady: true,
      error: null,
    };
    mockAppEntryReadiness = { userId: recoveredUserId, isReady: false };
    const store = usePasswordRecoveryStore.getState();
    store.setEmail('person@example.test');
    store.setCode('123456');
    await store.verifyCode();
    const view = await renderScreen();

    await fireEvent.changeText(screen.getByLabelText('Neues Passwort'), 'StrongPassword123!');
    await fireEvent.changeText(screen.getByLabelText('Passwort wiederholen'), 'StrongPassword123!');
    await fireEvent.press(screen.getByRole('button', { name: 'Passwort speichern' }));

    expect(await screen.findByText('Passwort geändert')).toBeVisible();
    expect(mockRouterReplace).not.toHaveBeenCalled();

    mockAppEntryReadiness = { userId: recoveredUserId, isReady: true };
    await view.rerender(passwordRecoveryScreen());

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledTimes(1));
    expect(mockRouterReplace).toHaveBeenCalledWith('/');
  });

  it('does not navigate twice when manual continue races automatic readiness', async () => {
    mockSessionState = {
      session: { user: { id: recoveredUserId } },
      accountReady: true,
      error: null,
    };
    mockAppEntryReadiness = { userId: recoveredUserId, isReady: false };
    const store = usePasswordRecoveryStore.getState();
    store.setEmail('person@example.test');
    store.setCode('123456');
    await store.verifyCode();
    const view = await renderScreen();

    await fireEvent.changeText(screen.getByLabelText('Neues Passwort'), 'StrongPassword123!');
    await fireEvent.changeText(screen.getByLabelText('Passwort wiederholen'), 'StrongPassword123!');
    await fireEvent.press(screen.getByRole('button', { name: 'Passwort speichern' }));
    expect(await screen.findByText('Passwort geändert')).toBeVisible();

    await fireEvent.press(screen.getByRole('button', { name: 'Weiter' }));
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);

    mockAppEntryReadiness = { userId: recoveredUserId, isReady: true };
    await view.rerender(passwordRecoveryScreen());

    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
  });

  const preservationOutcomeCases = [
    {
      name: 'existing-session',
      primaryUserId: 'existing-user',
      sessionUserId: 'existing-user',
      transferResult: 'primary-session-preserved',
      expectedPhase: 'updated',
      expectedOutcome: 'existing-session',
      expectedBody: 'Dein Passwort ist gespeichert. Das aktuell angemeldete Konto bleibt geöffnet.',
      expectedRouterCalls: 1,
      expectedTransferCalls: 1,
    },
    ...(['sign-in-required', 'transfer-uncertain'] as const).map((transferResult) => ({
      name: transferResult,
      primaryUserId: null,
      sessionUserId: null,
      transferResult,
      expectedPhase: 'sign-in-required',
      expectedOutcome: 'sign-in-required',
      expectedBody: 'Melde dich mit deinem neuen Passwort an, um fortzufahren.',
      expectedRouterCalls: 0,
      expectedTransferCalls: 1,
    })),
    {
      name: 'primary-session-capture-unavailable',
      primaryUserId: undefined,
      sessionUserId: null,
      transferResult: null,
      expectedPhase: 'sign-in-required',
      expectedOutcome: 'sign-in-required',
      expectedBody: 'Melde dich mit deinem neuen Passwort an, um fortzufahren.',
      expectedRouterCalls: 0,
      expectedTransferCalls: 0,
    },
  ];

  // Property 2 compares visible state and routing for completion outcomes outside Bug_Condition.
  // **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
  it.each(preservationOutcomeCases)(
    'preserves $name completion behavior outside Bug_Condition',
    async ({
      primaryUserId,
      sessionUserId,
      transferResult,
      expectedPhase,
      expectedOutcome,
      expectedBody,
      expectedRouterCalls,
      expectedTransferCalls,
    }) => {
      mockGetPrimarySessionUserId.mockResolvedValue(primaryUserId);
      if (transferResult) mockTransferPasswordRecoverySession.mockResolvedValue(transferResult);
      mockSessionState = {
        session: sessionUserId ? { user: { id: sessionUserId } } : null,
        accountReady: true,
        error: null,
      };
      const store = usePasswordRecoveryStore.getState();
      store.setEmail('person@example.test');
      store.setCode('123456');
      await store.verifyCode();
      await renderScreen();

      await fireEvent.changeText(screen.getByLabelText('Neues Passwort'), 'StrongPassword123!');
      await fireEvent.changeText(
        screen.getByLabelText('Passwort wiederholen'),
        'StrongPassword123!',
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Passwort speichern' }));

      expect(await screen.findByText(expectedBody)).toBeVisible();
      expect(usePasswordRecoveryStore.getState()).toMatchObject({
        phase: expectedPhase,
        outcome: expectedOutcome,
      });
      expect(mockTransferPasswordRecoverySession).toHaveBeenCalledTimes(expectedTransferCalls);

      if (expectedRouterCalls === 1) {
        await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledTimes(1));
        expect(mockRouterReplace).toHaveBeenCalledWith('/');
      } else {
        expect(mockRouterReplace).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Weiter' })).toBeEnabled();
      }
    },
  );

  const readySessionsWithoutCapturedRecoveryUser = [recoveredUserId, 'other-user'].map(
    (sessionUserId) => ({
      name: `sessionUserId=${sessionUserId}`,
      sessionUserId,
    }),
  );

  it.each(readySessionsWithoutCapturedRecoveryUser)(
    'does not infer a missing recovery user ID from a ready session ($name)',
    async ({ sessionUserId }) => {
      mockSessionState = {
        session: { user: { id: sessionUserId } },
        accountReady: true,
        error: null,
      };
      const store = usePasswordRecoveryStore.getState();
      store.setEmail('person@example.test');
      store.setCode('123456');
      await store.verifyCode();
      usePasswordRecoveryStore.setState({ recoveryUserId: null });
      const view = await renderScreen();

      await fireEvent.changeText(screen.getByLabelText('Neues Passwort'), 'StrongPassword123!');
      await fireEvent.changeText(
        screen.getByLabelText('Passwort wiederholen'),
        'StrongPassword123!',
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Passwort speichern' }));

      expect(
        await screen.findByText(
          'Dein neues Passwort ist gespeichert. Du kannst dich jetzt anmelden.',
        ),
      ).toBeVisible();
      expect(usePasswordRecoveryStore.getState()).toMatchObject({
        phase: 'updated',
        outcome: 'signed-in',
      });
      expect(mockRouterReplace).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Weiter' })).toBeEnabled();

      await view.rerender(passwordRecoveryScreen());

      expect(mockRouterReplace).not.toHaveBeenCalled();
    },
  );

  it('shows a password update error and allows retrying or cancelling recovery', async () => {
    const store = usePasswordRecoveryStore.getState();
    store.setEmail('person@example.test');
    store.setCode('123456');
    await store.verifyCode();
    mockUpdatePasswordWithRecoveryClient
      .mockResolvedValueOnce({ error: new Error('save failed') })
      .mockResolvedValueOnce({ error: new Error('save failed again') });
    await renderScreen();

    await fireEvent.changeText(screen.getByLabelText('Neues Passwort'), 'StrongPassword123!');
    await fireEvent.changeText(screen.getByLabelText('Passwort wiederholen'), 'StrongPassword123!');
    await fireEvent.press(screen.getByRole('button', { name: 'Passwort speichern' }));
    expect(await screen.findByText('save failed')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Passwort speichern' })).toBeEnabled();
    expect(mockRouterReplace).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Passwort speichern' }));
    expect(await screen.findByText('save failed again')).toBeOnTheScreen();
    expect(mockUpdatePasswordWithRecoveryClient).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeEnabled();
    expect(mockRouterReplace).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(usePasswordRecoveryStore.getState().phase).toBe('entry'));
    expect(mockRouterReplace).toHaveBeenCalledWith('/');
    expect(mockDiscardPasswordRecoverySession).toHaveBeenCalledWith(mockClient);
  });

  it('cancels before prevented navigation and handles the hardware back action', async () => {
    const store = usePasswordRecoveryStore.getState();
    store.setEmail('person@example.test');
    let onHardwareBack: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_eventName, handler) => {
      onHardwareBack = handler;
      return { remove: jest.fn() };
    });

    await renderScreen();
    const preventRemove = mockUsePreventRemove.mock.calls.at(-1)?.[1] as
      | ((event: { data: { action: unknown } }) => void)
      | undefined;
    expect(preventRemove).toBeDefined();
    const action = { type: 'GO_BACK' };
    await act(async () => {
      preventRemove?.({ data: { action } });
      await waitFor(() => expect(mockNavigationDispatch).toHaveBeenCalledWith(action));
    });

    await act(async () => store.setEmail('person@example.test'));
    mockCanGoBack = true;
    const hardwareBackHandler = onHardwareBack;
    if (!hardwareBackHandler) throw new Error('Expected the hardware back press handler');
    await act(async () =>
      expect(hardwareBackHandler({ type: 'hardwareBackPress', timeStamp: 1 })).toBe(true),
    );
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
    expect(usePasswordRecoveryStore.getState().phase).toBe('entry');
  });
});
