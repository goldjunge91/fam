import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAppDeepLinks } from './use-app-deep-links';

const mockGetInitialURL = jest.fn();
const mockOpenLegacyRecoveryLink = jest.fn();
const mockParseAuthTokensFromUrl = jest.fn();
const mockParseAuthErrorFromUrl = jest.fn();
const mockMarkRecoveryLinkFailed = jest.fn();
const mockSavePendingInviteToken = jest.fn();
const mockSetAuthDeepLinkError = jest.fn();
const mockReportError = jest.fn();
const mockReportWarning = jest.fn();
const mockDebugError = jest.fn();
const mockDebugWarn = jest.fn();
const mockRemoveListener = jest.fn();
let mockInviteToken: string | null = null;
let mockUrlListener: ((event: { url: string }) => void) | null = null;

jest.mock('expo-linking', () => ({
  getInitialURL: () => mockGetInitialURL(),
  addEventListener: (_type: string, listener: (event: { url: string }) => void) => {
    mockUrlListener = listener;
    return { remove: () => mockRemoveListener() };
  },
  parse: () => ({ queryParams: { token: mockInviteToken } }),
}));

jest.mock('@/features/auth/auth-deep-link-state', () => ({
  setAuthDeepLinkError: (...args: unknown[]) => mockSetAuthDeepLinkError(...args),
}));

jest.mock('@/features/auth/domain/auth-deep-link', () => ({
  parseAuthTokensFromUrl: (...args: unknown[]) => mockParseAuthTokensFromUrl(...args),
  parseAuthErrorFromUrl: (...args: unknown[]) => mockParseAuthErrorFromUrl(...args),
}));

jest.mock('@/features/auth/pending-invite', () => ({
  savePendingInviteToken: (...args: unknown[]) => mockSavePendingInviteToken(...args),
}));

jest.mock('@/features/auth/recovery-store', () => ({
  usePasswordRecoveryStore: {
    getState: () => ({
      openLegacyRecoveryLink: (...args: unknown[]) => mockOpenLegacyRecoveryLink(...args),
      markRecoveryLinkFailed: () => mockMarkRecoveryLinkFailed(),
    }),
  },
}));

jest.mock('@/lib/observability/debug-log', () => ({
  debugError: (...args: unknown[]) => mockDebugError(...args),
  debugWarn: (...args: unknown[]) => mockDebugWarn(...args),
}));

jest.mock('@/lib/telemetry', () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
  reportWarning: (...args: unknown[]) => mockReportWarning(...args),
}));

describe('useAppDeepLinks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInviteToken = null;
    mockUrlListener = null;
    mockGetInitialURL.mockResolvedValue(null);
    mockParseAuthTokensFromUrl.mockReturnValue(null);
    mockParseAuthErrorFromUrl.mockReturnValue(null);
    mockOpenLegacyRecoveryLink.mockResolvedValue('opened');
  });

  it('opens legacy recovery tokens without changing the primary session and removes the listener', async () => {
    mockGetInitialURL.mockResolvedValue('fam://auth/callback');
    mockParseAuthTokensFromUrl.mockReturnValue({ accessToken: 'access', refreshToken: 'refresh' });
    const { unmount } = await renderHook(() => useAppDeepLinks());

    await waitFor(() =>
      expect(mockOpenLegacyRecoveryLink).toHaveBeenCalledWith({
        accessToken: 'access',
        refreshToken: 'refresh',
      }),
    );
    expect(mockOpenLegacyRecoveryLink).toHaveBeenCalledTimes(1);
    expect(mockSavePendingInviteToken).not.toHaveBeenCalled();

    await unmount();
    expect(mockRemoveListener).toHaveBeenCalledTimes(1);
  });

  it('reports a warning when a legacy recovery session cannot be opened', async () => {
    mockParseAuthTokensFromUrl.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    mockOpenLegacyRecoveryLink.mockResolvedValue('failed');
    mockGetInitialURL.mockResolvedValue('fam://auth/callback');
    await renderHook(() => useAppDeepLinks());

    await waitFor(() =>
      expect(mockReportWarning).toHaveBeenCalledWith('Legacy recovery link could not be applied', {
        operation: 'auth.deep_link_session',
        error_code: 'deep_link_session_failed',
      }),
    );
    expect(mockSetAuthDeepLinkError).not.toHaveBeenCalled();
  });

  it('stores a parsed auth error and reports it as a warning', async () => {
    mockGetInitialURL.mockResolvedValue('fam://auth/callback?error=expired');
    mockParseAuthErrorFromUrl.mockReturnValue('Der Link ist abgelaufen.');
    await renderHook(() => useAppDeepLinks());

    await waitFor(() =>
      expect(mockReportWarning).toHaveBeenCalledWith('Der Link ist abgelaufen.', {
        operation: 'auth.deep_link',
        error_code: 'auth_deep_link_error',
      }),
    );
    expect(mockSetAuthDeepLinkError).toHaveBeenCalledWith('Der Link ist abgelaufen.');
  });

  it('shows expired legacy reset links in the recovery route instead of sign-in', async () => {
    mockGetInitialURL.mockResolvedValue('fam:///reset-password#error=access_denied');
    mockParseAuthErrorFromUrl.mockReturnValue('Der Link ist abgelaufen.');
    await renderHook(() => useAppDeepLinks());

    await waitFor(() => expect(mockMarkRecoveryLinkFailed).toHaveBeenCalledTimes(1));
    expect(mockSetAuthDeepLinkError).not.toHaveBeenCalled();
  });

  it('stores a trimmed invite token from the initial URL', async () => {
    mockGetInitialURL.mockResolvedValue('fam://invite?token= invite-1 ');
    mockInviteToken = ' invite-1 ';
    await renderHook(() => useAppDeepLinks());

    await waitFor(() => expect(mockSavePendingInviteToken).toHaveBeenCalledWith('invite-1'));
  });

  it('ignores missing URLs and blank invite tokens', async () => {
    const { unmount } = await renderHook(() => useAppDeepLinks());
    await act(async () => mockUrlListener?.({ url: '' }));
    expect(mockSavePendingInviteToken).not.toHaveBeenCalled();

    mockInviteToken = '   ';
    await act(async () => mockUrlListener?.({ url: 'fam://invite?token= ' }));
    expect(mockSavePendingInviteToken).not.toHaveBeenCalled();
    await unmount();
  });

  it('reports URL parsing exceptions and initial URL retrieval failures', async () => {
    mockGetInitialURL.mockRejectedValue(new Error('initial url failed'));
    const { unmount } = await renderHook(() => useAppDeepLinks());
    await waitFor(() =>
      expect(mockReportError).toHaveBeenCalledWith(expect.any(Error), {
        operation: 'auth.initial_url',
        error_code: 'initial_url_failed',
      }),
    );

    mockGetInitialURL.mockResolvedValue('fam://invite?token=bad');
    mockParseAuthTokensFromUrl.mockImplementation(() => {
      throw new Error('malformed');
    });
    await unmount();
    await renderHook(() => useAppDeepLinks());
    await waitFor(() =>
      expect(mockReportError).toHaveBeenCalledWith(expect.any(Error), {
        operation: 'auth.deep_link_parse',
        error_code: 'deep_link_parse_failed',
      }),
    );
  });
});
