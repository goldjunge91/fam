import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import AppShell from '@/components/layout/app-shell';
import { CrashFallback } from '@/features/app-shell/crash-fallback';
import { clearPendingInviteToken, peekPendingInviteToken } from '@/features/auth/pending-invite';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import {
  householdsQueryKey,
  useHouseholds,
  useRedeemInviteMutation,
} from '@/features/household/api';
import { resolveAppEntry } from '@/features/onboarding/domain/app-entry';
import {
  isOnboardingSessionCompleted,
  persistOnboardingCompleted,
} from '@/features/onboarding/onboarding-completion';
import { useProfile } from '@/features/profile/api';
import { useSignOutOnOrphanedProfile } from '@/features/profile/hooks/use-sign-out-on-orphaned-profile';
import { env } from '@/lib/config/env';
import { debugError } from '@/lib/observability/debug-log';
import { useHouseholdsBootstrapSync } from '@/lib/sync/household-bootstrap-sync';
import { useRealtimeSync, useSyncEngine } from '@/lib/sync/sync-runner';

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function AppLayoutContent() {
  const { session, seenOnboarding } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const [retryToken, setRetryToken] = useState(0);
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile(userId);
  useSignOutOnOrphanedProfile(profileError, queryClient);
  const { activeHouseholdId } = useActiveHousehold();
  const {
    data: households = [],
    isLoading: householdsLoading,
    isError: householdsError,
  } = useHouseholds();
  const householdBootstrap = useHouseholdsBootstrapSync(userId, queryClient, retryToken);

  const isUncompleted = profile
    ? (profile as { onboarding_completed_at?: string | null }).onboarding_completed_at == null
    : false;
  const shouldPrompt = (env.forceOnboarding || isUncompleted) && !isOnboardingSessionCompleted();

  const decision = resolveAppEntry({
    hasSession: Boolean(userId),
    hasSeenOnboarding: seenOnboarding,
    isLoading:
      profileLoading ||
      householdsLoading ||
      (!householdBootstrap.isInitialSyncComplete && !householdBootstrap.isInitialSyncError),
    shouldPromptOnboarding: shouldPrompt,
    householdCount: households?.length ?? 0,
    householdsError:
      householdsError || Boolean(profileError) || householdBootstrap.isInitialSyncError,
  });

  const retryRouting = useCallback(() => {
    setRetryToken((token) => token + 1);
    if (!userId) return;

    void Promise.all([
      queryClient.resetQueries({ queryKey: ['profile', userId], exact: true }),
      queryClient.resetQueries({ queryKey: householdsQueryKey(userId), exact: true }),
    ]).catch(() => undefined);
  }, [queryClient, userId]);

  // Ein vollständiger App-Zustand gilt als eingerichtet; das Geräte-Flag wird nachgetragen.
  const istEingerichtet = decision.kind === 'weiter';
  useEffect(() => {
    if (istEingerichtet && !seenOnboarding && !isOnboardingSessionCompleted()) {
      persistOnboardingCompleted();
    }
  }, [istEingerichtet, seenOnboarding]);

  if (decision.kind === 'umleiten') {
    return <Redirect href={decision.to} />;
  }

  if (decision.kind === 'warten') {
    return (
      <View
        accessible
        accessibilityLabel="Start wird vorbereitet"
        accessibilityRole="progressbar"
        style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (decision.kind === 'fehler') {
    return <CrashFallback resetError={retryRouting} />;
  }

  return <ReadyAppContent activeHouseholdId={activeHouseholdId} />;
}

function ReadyAppContent({ activeHouseholdId }: { activeHouseholdId: string | null }) {
  const redeemInvite = useRedeemInviteMutation();

  // Automatische App-Synchronisation startet erst nach der Routingentscheidung.
  useSyncEngine(activeHouseholdId ?? undefined);
  useRealtimeSync(activeHouseholdId ?? undefined);

  useEffect(() => {
    peekPendingInviteToken().then(async (pendingToken) => {
      if (pendingToken) {
        try {
          await redeemInvite.mutateAsync(pendingToken);
          await clearPendingInviteToken();
          router.replace('/');
        } catch (err) {
          debugError('Automatische Einloesung fehlgeschlagen:', err);
        }
      }
    });
  }, [redeemInvite]);

  return (
    <View style={styles.root}>
      <AppShell />
    </View>
  );
}

/** Angemeldeter Bereich. Der Guard sitzt im Root-Layout. */
export default function AppLayout() {
  return <AppLayoutContent />;
}
