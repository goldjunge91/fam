import { render, screen } from '@testing-library/react-native';
import AppLayout from '@/app/(app)/_layout';

const mockUseActiveHousehold = jest.fn(() => {
  throw new Error('ActiveHouseholdProvider is not mounted during account bootstrap');
});

jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));
jest.mock('expo-router', () => ({ Redirect: () => null, router: { replace: jest.fn() } }));
jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } }, seenOnboarding: true }),
}));
jest.mock('@/features/onboarding/app-entry-readiness', () => ({
  useAppEntryReadiness: () => ({ decision: { kind: 'warten' }, retry: jest.fn() }),
}));
jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => mockUseActiveHousehold(),
}));
jest.mock('@/features/household/api', () => ({ useRedeemInviteMutation: () => ({}) }));
jest.mock('@/features/ocr/capture/api', () => ({ retryPendingReceiptAssetUpload: jest.fn() }));
jest.mock('@/features/onboarding/onboarding-completion', () => ({
  isOnboardingSessionCompleted: () => true,
  persistOnboardingCompleted: jest.fn(),
}));
jest.mock('@/features/shopping-list/watch/watch-toggle-listener', () => ({
  WatchShoppingToggleListener: () => null,
}));
jest.mock('@/components/layout/app-shell', () => () => null);
jest.mock('@/features/app-shell/crash-fallback', () => ({ CrashFallback: () => null }));
jest.mock('@/lib/backend/supabase/remote-client', () => ({ getSupabase: jest.fn() }));
jest.mock('@/lib/observability/debug-log', () => ({ debugError: jest.fn(), debugWarn: jest.fn() }));
jest.mock('@/lib/sync/household-bootstrap-sync', () => ({ triggerHouseholdsPull: jest.fn() }));
jest.mock('@/lib/sync/household-membership-realtime', () => ({
  subscribeHouseholdMembershipRealtime: jest.fn(),
}));
jest.mock('@/lib/sync/sync-runner', () => ({
  useRealtimeSync: jest.fn(),
  useSyncEngine: jest.fn(),
}));

describe('authenticated app layout bootstrap gate', () => {
  it('does not read household context before the account provider is ready', async () => {
    await render(<AppLayout />);

    expect(screen.getByLabelText('Start wird vorbereitet')).toBeOnTheScreen();
    expect(mockUseActiveHousehold).not.toHaveBeenCalled();
  });
});
