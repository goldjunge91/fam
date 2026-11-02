import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, use, useCallback, useMemo, useState } from 'react';

import { useSession } from '@/features/auth/session-provider';
import { useHouseholds } from '@/features/household/api';
import { householdsQueryKey } from '@/features/household/query-keys';
import { type AppEntryDecision, resolveAppEntry } from '@/features/onboarding/domain/app-entry';
import { isOnboardingSessionCompleted } from '@/features/onboarding/onboarding-completion';
import { useProfile } from '@/features/profile/api';
import { useSignOutOnOrphanedProfile } from '@/features/profile/hooks/use-sign-out-on-orphaned-profile';
import { useHouseholdsBootstrapSync } from '@/lib/sync/household-bootstrap-sync';

export type AppEntryReadiness = {
  userId: string | undefined;
  isReady: boolean;
  decision: AppEntryDecision;
  retry: () => void;
};

const AppEntryReadinessContext = createContext<AppEntryReadiness | null>(null);

export function useAppEntryReadiness(): AppEntryReadiness {
  const context = use(AppEntryReadinessContext);
  if (!context) {
    throw new Error(
      'useAppEntryReadiness muss innerhalb des AppEntryReadinessProvider verwendet werden',
    );
  }
  return context;
}

export function AppEntryReadinessProvider({ children }: { children: ReactNode }) {
  const { session, accountReady, seenOnboarding, error: sessionError } = useSession();
  const userId = accountReady ? session?.user.id : undefined;
  const queryClient = useQueryClient();
  const [retryToken, setRetryToken] = useState(0);
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile(userId);
  useSignOutOnOrphanedProfile(profileError, queryClient);
  const {
    data: households = [],
    isLoading: householdsLoading,
    isError: householdsError,
  } = useHouseholds();
  const householdBootstrap = useHouseholdsBootstrapSync(userId, queryClient, retryToken);

  const isUncompleted = profile
    ? (profile as { onboarding_completed_at?: string | null }).onboarding_completed_at == null
    : false;
  const shouldPrompt = isUncompleted && !isOnboardingSessionCompleted();
  const isLoading =
    !accountReady ||
    profileLoading ||
    householdsLoading ||
    (!householdBootstrap.isInitialSyncComplete && !householdBootstrap.isInitialSyncError);

  const decision = resolveAppEntry({
    hasSession: Boolean(session?.user.id),
    hasSeenOnboarding: seenOnboarding,
    isLoading,
    shouldPromptOnboarding: shouldPrompt,
    householdCount: households.length,
    householdsError: householdsError || householdBootstrap.isInitialSyncError,
    profileError: Boolean(profileError),
  });

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1);
    if (!userId) return;

    void Promise.all([
      queryClient.resetQueries({ queryKey: ['profile', userId], exact: true }),
      queryClient.resetQueries({ queryKey: householdsQueryKey(userId), exact: true }),
    ]).catch(() => undefined);
  }, [queryClient, userId]);

  const value = useMemo<AppEntryReadiness>(
    () => ({
      userId,
      isReady: accountReady && !sessionError && decision.kind === 'weiter',
      decision,
      retry,
    }),
    [accountReady, decision, retry, sessionError, userId],
  );

  return <AppEntryReadinessContext value={value}>{children}</AppEntryReadinessContext>;
}
