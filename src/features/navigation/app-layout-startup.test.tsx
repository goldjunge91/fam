import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';

import AppLayout from '@/app/(app)/_layout';

let mockProfileResult: {
  data: { onboarding_completed_at: string | null } | undefined;
  isLoading: boolean;
  error: Error | null;
};
let mockOnboardingSessionCompleted = false;
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

jest.mock('expo-router', () => {
  const { Text: NativeText } = require('react-native');

  return {
    Redirect: ({ href }: { href: string }) => <NativeText>redirect:{href}</NativeText>,
    router: { replace: jest.fn() },
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
  useSession: () => ({
    session: { user: { id: 'user-1' } },
    seenOnboarding: true,
  }),
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
  persistOnboardingCompleted: jest.fn(),
}));
jest.mock('@/features/profile/api', () => ({
  useProfile: () => mockProfileResult,
}));
jest.mock('@/features/profile/hooks/use-sign-out-on-orphaned-profile', () => ({
  useSignOutOnOrphanedProfile: jest.fn(),
}));
jest.mock('@/lib/observability/debug-log', () => ({ debugError: jest.fn() }));
jest.mock('@/lib/sync/household-bootstrap-sync', () => ({
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

  it('zeigt bei einem Routingfehler einen Retry-Zustand statt Haushalt-anlegen', async () => {
    mockHouseholdsResult.isError = true;
    await renderLayout();

    expect(screen.getByText('Erneut versuchen')).toBeOnTheScreen();
    expect(screen.queryByText('redirect:/household/create')).not.toBeOnTheScreen();
    expect(screen.queryByText('app-shell')).not.toBeOnTheScreen();
  });

  it('zeigt auch bei einem Profilfehler einen Retry-Zustand statt Haushalt-anlegen', async () => {
    mockProfileResult.error = new Error('Profil nicht erreichbar');
    await renderLayout();

    expect(screen.getByText('Erneut versuchen')).toBeOnTheScreen();
    expect(screen.queryByText('redirect:/household/create')).not.toBeOnTheScreen();
    expect(screen.queryByText('app-shell')).not.toBeOnTheScreen();
  });

  it('leitet ein unvollständiges Profil nach dem Gate ins vollständige Onboarding', async () => {
    mockProfileResult.data = { onboarding_completed_at: null };
    await renderLayout();

    expect(screen.getByText('redirect:/onboarding')).toBeOnTheScreen();
    expect(screen.queryByText('app-shell')).not.toBeOnTheScreen();
  });

  it('startet App-Sync und Realtime erst nach der Startentscheidung', async () => {
    await renderLayout();

    expect(screen.getByText('app-shell')).toBeOnTheScreen();
    expect(mockUseSyncEngine).toHaveBeenCalledWith('hh-1');
    expect(mockUseRealtimeSync).toHaveBeenCalledWith('hh-1');
  });

  it('startet den Routing-Bootstrap beim Retry erneut', async () => {
    mockHouseholdsResult.isError = true;
    const { queryClient } = await renderLayout();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(mockUseHouseholdsBootstrapSync).toHaveBeenLastCalledWith('user-1', queryClient, 1);
  });
});
