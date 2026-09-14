import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { latestWeightEntryQueryKey } from '@/features/calorie-tracking/api';
import { useOnboarding, useOnboardingStore } from '@/features/onboarding/onboarding-store';

const mockCreateWeightEntry = jest.fn();
const mockMarkOnboardingCompleted = jest.fn();
const mockPersistOnboardingCompleted = jest.fn();
const mockUpdateProfile = jest.fn();
const mockSaveModulePreferences = jest.fn();
const mockTriggerHouseholdsPull = jest.fn();
const mockHouseholdLimit = jest.fn();
const mockTrackAnalyticsEvent = jest.fn();

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/calorie-tracking/api', () => ({
  createWeightEntry: (input: { userId: string; weightKg: number }) => mockCreateWeightEntry(input),
  latestWeightEntryQueryKey: (userId: string | undefined) => [
    'calorie-tracking',
    'weight',
    'latest',
    userId,
  ],
}));

jest.mock('@/features/onboarding/api', () => ({
  markOnboardingCompleted: (userId: string) => mockMarkOnboardingCompleted(userId),
}));

jest.mock('@/features/onboarding/onboarding-completion', () => ({
  persistOnboardingCompleted: () => mockPersistOnboardingCompleted(),
}));

jest.mock('@/features/profile/api', () => ({
  updateProfile: (
    userId: string,
    input: {
      displayName?: string;
      birthDate?: string;
      heightCm?: number;
      sex?: string;
      activityLevel?: string;
    },
  ) => mockUpdateProfile(userId, input),
}));

jest.mock('@/features/settings/module-preferences', () => ({
  saveModulePreferences: (userId: string, modules: Record<string, boolean>) =>
    mockSaveModulePreferences(userId, modules),
}));

jest.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: (event: string) => mockTrackAnalyticsEvent(event),
}));

jest.mock('@/lib/observability/debug-log', () => ({
  debugWarn: jest.fn(),
}));

jest.mock('@/lib/backend/supabase/client', () => ({
  getSupabase: () => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({ limit: mockHouseholdLimit })),
    })),
  }),
}));

jest.mock('@/lib/sync/household-bootstrap-sync', () => ({
  triggerHouseholdsPull: (userId: string) => mockTriggerHouseholdsPull(userId),
}));

function QueryClientWrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('completeOnboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOnboardingStore.getState().reset();
    mockCreateWeightEntry.mockResolvedValue({ id: 'weight-1' });
    mockMarkOnboardingCompleted.mockResolvedValue({ error: null });
    mockPersistOnboardingCompleted.mockResolvedValue(undefined);
    mockUpdateProfile.mockResolvedValue({ error: null });
    mockSaveModulePreferences.mockResolvedValue({ error: null });
    mockTriggerHouseholdsPull.mockResolvedValue(undefined);
    mockHouseholdLimit.mockResolvedValue({ data: [{ id: 'household-1' }], error: null });
  });

  it('überführt Körperdaten und Onboarding-Gewicht in die bestehenden privaten Owner', async () => {
    useOnboardingStore.getState().updateProfileData({
      displayName: 'Max',
      birthDate: '1990-01-01',
      heightCm: 180,
      weightKg: 80,
      sex: 'male',
      activityLevel: 'moderate',
      weightGoal: 'maintain',
    });

    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: QueryClientWrapper,
    });

    let completed = false;
    await act(async () => {
      completed = await result.current.completeOnboarding();
    });
    expect(completed).toBe(true);
    expect(mockUpdateProfile).toHaveBeenCalledWith('user-1', {
      displayName: 'Max',
      birthDate: '1990-01-01',
      heightCm: 180,
      sex: 'male',
      activityLevel: 'moderate',
    });
    expect(mockCreateWeightEntry).toHaveBeenCalledWith({ userId: 'user-1', weightKg: 80 });
    expect(mockSaveModulePreferences).toHaveBeenCalled();
    expect(mockTriggerHouseholdsPull).toHaveBeenCalled();
    expect(mockMarkOnboardingCompleted).toHaveBeenCalledWith('user-1');
    expect(mockPersistOnboardingCompleted).toHaveBeenCalled();
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith('onboarding.flow.completed');
  });

  it('invalidiert nach dem Gewichtseintrag den aktuellen Kalorien-Cache', async () => {
    useOnboardingStore.getState().updateProfileData({ weightKg: 80 });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    function QueryClientSpyWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: QueryClientSpyWrapper,
    });

    let completed = false;
    await act(async () => {
      completed = await result.current.completeOnboarding();
    });
    expect(completed).toBe(true);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: latestWeightEntryQueryKey('user-1'),
    });
  });
});
