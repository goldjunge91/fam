import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import AppLayout from '@/app/(app)/_layout';

let mockProfileResult: {
  data: { onboarding_completed_at: string | null } | undefined;
  isLoading: boolean;
  error: Error | null;
};
let mockOnboardingSessionCompleted = false;
let mockSessionResult: {
  session: { user: { id: string } } | null;
  seenOnboarding: boolean;
};
let mockPendingInviteToken: string | null = null;
let mockHouseholdResult: { activeHouseholdId: string | null };
let mockHouseholdsResult: {
  data: { id: string; name: string }[];
  isLoading: boolean;
  isError: boolean;
};
let mockBootstrapState: {
  isInitialSyncComplete: boolean;
  isInitialSyncError: boolean;
};

const mockUseHouseholdsBootstrapSync = jest.fn();
const mockUseSyncEngine = jest.fn();
const mockUseRealtimeSync = jest.fn();
const mockRedeemInvite = { mutateAsync: jest.fn() };
const mockRouterReplace = jest.fn();
const mockPersistOnboardingCompleted = jest.fn();
const mockPeekPendingInviteToken = jest.fn(async () => mockPendingInviteToken);
const mockClearPendingInviteToken = jest.fn();
const mockRetryPendingReceiptAssetUpload = jest.fn();
const mockMembershipSubscriptionCleanup = jest.fn();
const mockSubscribeHouseholdMembershipRealtime = jest.fn(
  (_supabase: unknown, _userId: string, _onJoin: () => void) => mockMembershipSubscriptionCleanup,
);
const mockDebugError = jest.fn();

jest.mock('expo-router', () => {
  const { Text: NativeText } = require('react-native');

  return {
    Redirect: ({ href }: { href: string }) => <NativeText>redirect:{href}</NativeText>,
    router: { replace: (...args: unknown[]) => mockRouterReplace(...args) },
  };
});
jest.mock('@/components/layout/app-shell', () => {
  const { Text: NativeText } = require('react-native');

  return {
    __esModule: true,
    default: () => <NativeText>app-shell</NativeText>,
  };
});
jest.mock('@/features/app-shell/crash-fallback', () => {
  const { Pressable: NativePressable, Text: NativeText } = require('react-native');

  return {
    CrashFallback: ({ resetError }: { resetError: () => void }) => (
      <NativePressable
        accessibilityRole="button"
        accessibilityLabel="Erneut versuchen"
        onPress={resetError}>
        <NativeText>Erneut versuchen</NativeText>
      </NativePressable>
    ),
  };
});
jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => mockSessionResult,
}));
jest.mock('@/features/auth/pending-invite', () => ({
  clearPendingInviteToken: () => mockClearPendingInviteToken(),
  peekPendingInviteToken: () => mockPeekPendingInviteToken(),
}));
jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => mockHouseholdResult,
}));
jest.mock('@/features/household/api', () => ({
  householdsQueryKey: (userId: string) => ['households', userId],
  useHouseholds: () => mockHouseholdsResult,
  useRedeemInviteMutation: () => mockRedeemInvite,
}));
jest.mock('@/features/onboarding/onboarding-completion', () => ({
  isOnboardingSessionCompleted: () => mockOnboardingSessionCompleted,
  persistOnboardingCompleted: () => mockPersistOnboardingCompleted(),
}));
jest.mock('@/features/profile/api', () => ({
  useProfile: () => mockProfileResult,
}));
jest.mock('@/features/profile/hooks/use-sign-out-on-orphaned-profile', () => ({
  useSignOutOnOrphanedProfile: jest.fn(),
}));
jest.mock('@/features/ocr/capture/api', () => ({
  retryPendingReceiptAssetUpload: (...args: unknown[]) =>
    mockRetryPendingReceiptAssetUpload(...args),
}));
jest.mock('@/lib/backend/supabase/remote-client', () => ({ getSupabase: () => ({}) }));
jest.mock('@/lib/observability/debug-log', () => ({
  debugError: (...args: unknown[]) => mockDebugError(...args),
}));
jest.mock('@/lib/sync/household-membership-realtime', () => ({
  subscribeHouseholdMembershipRealtime: (supabase: unknown, userId: string, onJoin: () => void) =>
    mockSubscribeHouseholdMembershipRealtime(supabase, userId, onJoin),
}));
jest.mock('@/lib/sync/household-bootstrap-sync', () => ({
  triggerHouseholdsPull: jest.fn(),
  useHouseholdsBootstrapSync: (...args: unknown[]) => mockUseHouseholdsBootstrapSync(...args),
}));
jest.mock('@/lib/sync/sync-runner', () => ({
  useRealtimeSync: (...args: unknown[]) => mockUseRealtimeSync(...args),
  useSyncEngine: (...args: unknown[]) => mockUseSyncEngine(...args),
}));

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

async function renderLayout(queryClient = createQueryClient()) {
  return {
    queryClient,
    ...(await render(
      <QueryClientProvider client={queryClient}>
        <AppLayout />
      </QueryClientProvider>,
    )),
  };
}

describe('AppLayout startup gate', () => {
  beforeEach(() => {
    mockOnboardingSessionCompleted = false;
    mockSessionResult = { session: { user: { id: 'user-1' } }, seenOnboarding: true };
    mockPendingInviteToken = null;
    mockProfileResult = {
      data: { onboarding_completed_at: '2026-09-16T00:00:00.000Z' },
      isLoading: false,
      error: null,
    };
    mockHouseholdResult = { activeHouseholdId: 'hh-1' };
    mockHouseholdsResult = {
      data: [{ id: 'hh-1', name: 'Unser Haushalt' }],
      isLoading: false,
      isError: false,
    };
    mockBootstrapState = {
      isInitialSyncComplete: true,
      isInitialSyncError: false,
    };
    mockUseHouseholdsBootstrapSync.mockReset().mockReturnValue(mockBootstrapState);
    mockUseSyncEngine.mockClear();
    mockUseRealtimeSync.mockClear();
    mockRedeemInvite.mutateAsync.mockReset();
    mockRouterReplace.mockReset();
    mockPersistOnboardingCompleted.mockReset();
    mockPeekPendingInviteToken.mockReset().mockImplementation(async () => mockPendingInviteToken);
    mockClearPendingInviteToken.mockReset();
    mockRetryPendingReceiptAssetUpload.mockReset();
    mockMembershipSubscriptionCleanup.mockReset();
    mockSubscribeHouseholdMembershipRealtime
      .mockReset()
      .mockReturnValue(mockMembershipSubscriptionCleanup);
    mockDebugError.mockReset();
  });

  it('zeigt beim Laden des Profils ausschließlich den Ladebildschirm', async () => {
    mockProfileResult.isLoading = true;
    await renderLayout();

    expect(screen.getByRole('progressbar', { name: 'Start wird vorbereitet' })).toBeOnTheScreen();
    expect(screen.queryByText('app-shell')).not.toBeOnTheScreen();
    expect(mockUseSyncEngine).not.toHaveBeenCalled();
    expect(mockUseRealtimeSync).not.toHaveBeenCalled();
  });

  it('zeigt beim laufenden Haushaltssync ausschließlich den Ladebildschirm', async () => {
    mockBootstrapState = { isInitialSyncComplete: false, isInitialSyncError: false };
    mockUseHouseholdsBootstrapSync.mockReturnValue(mockBootstrapState);
    await renderLayout();

    expect(screen.getByRole('progressbar', { name: 'Start wird vorbereitet' })).toBeOnTheScreen();
    expect(screen.queryByText('app-shell')).not.toBeOnTheScreen();
  });

  it('startet mit lokalem Haushalt trotz fehlgeschlagenem Remote-Pull', async () => {
    mockHouseholdsResult.isError = true;
    await renderLayout();

    expect(screen.getByText('app-shell')).toBeOnTheScreen();
    expect(screen.queryByText('redirect:/household/create')).not.toBeOnTheScreen();
  });

  it('zeigt bei Profil-Requestfehlern auch mit lokalem Haushalt den Retry-Zustand', async () => {
    mockProfileResult.error = new Error('Profil nicht erreichbar');
    await renderLayout();

    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeOnTheScreen();
    expect(screen.queryByText('app-shell')).not.toBeOnTheScreen();
    expect(mockUseSyncEngine).not.toHaveBeenCalled();
    expect(mockUseRealtimeSync).not.toHaveBeenCalled();
  });

  it('leitet ein unvollständiges Profil nach dem Gate ins vollständige Onboarding', async () => {
    mockProfileResult.data = { onboarding_completed_at: null };
    await renderLayout();

    expect(screen.getByText('redirect:/onboarding')).toBeOnTheScreen();
    expect(screen.queryByText('app-shell')).not.toBeOnTheScreen();
  });

  it('startet App-Sync und Realtime erst nach der Startentscheidung', async () => {
    const { unmount } = await renderLayout();

    expect(screen.getByText('app-shell')).toBeOnTheScreen();
    expect(mockUseSyncEngine).toHaveBeenCalledWith('hh-1', expect.any(Function));
    expect(mockUseRealtimeSync).toHaveBeenCalledWith('hh-1', expect.any(Function));
    expect(mockSubscribeHouseholdMembershipRealtime).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.any(Function),
    );
    unmount();
    await waitFor(() => expect(mockMembershipSubscriptionCleanup).toHaveBeenCalled());
  });

  it('startet den Routing-Bootstrap beim Retry erneut', async () => {
    mockHouseholdsResult.isError = true;
    mockHouseholdsResult.data = [];
    mockHouseholdResult = { activeHouseholdId: null };
    const { queryClient } = await renderLayout();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(mockUseHouseholdsBootstrapSync).toHaveBeenLastCalledWith('user-1', queryClient, 1);
  });

  it('skips onboarding redirects when the session or profile data is absent', async () => {
    mockSessionResult = { session: null, seenOnboarding: false };
    await renderLayout();
    expect(screen.getByText('redirect:/onboarding')).toBeOnTheScreen();

    mockSessionResult = { session: { user: { id: 'user-1' } }, seenOnboarding: true };
    mockProfileResult.data = undefined;
    await renderLayout();
    expect(screen.getByText('app-shell')).toBeOnTheScreen();
  });

  it('persists completion when an existing account has no device completion flag', async () => {
    mockSessionResult.seenOnboarding = false;
    await renderLayout();

    await waitFor(() => expect(mockPersistOnboardingCompleted).toHaveBeenCalledTimes(1));
    expect(screen.getByText('app-shell')).toBeOnTheScreen();
  });

  it('uses the bootstrap error when household data has no local rows', async () => {
    mockHouseholdsResult = { data: [], isLoading: false, isError: false };
    mockBootstrapState = { isInitialSyncComplete: false, isInitialSyncError: true };
    mockUseHouseholdsBootstrapSync.mockReturnValue(mockBootstrapState);
    await renderLayout();

    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeOnTheScreen();
  });

  it('retries receipt uploads only when the household and account are both available', async () => {
    await renderLayout();
    const retryWithHousehold = mockUseSyncEngine.mock.calls.at(-1)?.[1] as () => Promise<void>;
    await retryWithHousehold();
    expect(mockRetryPendingReceiptAssetUpload).toHaveBeenCalledWith({
      accountId: 'user-1',
      householdId: 'hh-1',
      createdBy: 'user-1',
    });

    mockRetryPendingReceiptAssetUpload.mockClear();
    mockHouseholdResult = { activeHouseholdId: null };
    mockUseSyncEngine.mockClear();
    await renderLayout();
    const retryWithoutHousehold = mockUseSyncEngine.mock.calls.at(-1)?.[1] as () => Promise<void>;
    await retryWithoutHousehold();
    expect(mockRetryPendingReceiptAssetUpload).not.toHaveBeenCalled();
  });

  it('redeems a pending invite and reports a failed redemption', async () => {
    mockPendingInviteToken = 'invite-token';
    mockRedeemInvite.mutateAsync.mockResolvedValue(undefined);
    await renderLayout();

    await waitFor(() => expect(mockClearPendingInviteToken).toHaveBeenCalledTimes(1));
    expect(mockRedeemInvite.mutateAsync).toHaveBeenCalledWith('invite-token');
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/'));

    mockPendingInviteToken = 'bad-invite';
    mockRedeemInvite.mutateAsync.mockRejectedValue(new Error('invite expired'));
    await renderLayout();
    await waitFor(() =>
      expect(mockDebugError).toHaveBeenCalledWith(
        'Automatische Einloesung fehlgeschlagen:',
        expect.any(Error),
      ),
    );
    expect(mockClearPendingInviteToken).toHaveBeenCalledTimes(1);
  });
});
