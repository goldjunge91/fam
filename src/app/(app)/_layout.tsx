import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import AppShell from '@/components/layout/app-shell';
import { useProfile } from '@/features/auth/api';
import { resolveAppEntry } from '@/features/auth/app-entry';
import {
  isOnboardingSessionCompleted,
  persistOnboardingCompleted,
} from '@/features/auth/onboarding-session';
import { useSignOutOnOrphanedProfile } from '@/features/auth/orphaned-session';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useRedeemInviteMutation } from '@/features/household/api';
import { env } from '@/lib/env';
import { clearPendingInviteToken, peekPendingInviteToken } from '@/lib/pending-invite';
import { useRealtimeSync, useSyncEngine } from '@/lib/sync/sync-runner';

function AppLayoutContent() {
  const { session, seenOnboarding } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile(userId);
  useSignOutOnOrphanedProfile(profileError, queryClient);
  const {
    activeHouseholdId,
    households,
    isLoading: householdsLoading,
    isError: householdsError,
  } = useActiveHousehold();
  const redeemInvite = useRedeemInviteMutation();

  useSyncEngine(activeHouseholdId ?? undefined);
  useRealtimeSync(activeHouseholdId ?? undefined);

  useEffect(() => {
    // Erst nach erfolgreicher Einloesung loeschen, damit Redirects oder Fehler
    // den Token nicht vorzeitig verlieren.
    peekPendingInviteToken().then(async (pendingToken) => {
      if (pendingToken) {
        try {
          await redeemInvite.mutateAsync(pendingToken);
          await clearPendingInviteToken();
          router.replace('/');
        } catch (err) {
          console.error('Automatische Einloesung fehlgeschlagen:', err);
        }
      }
    });
  }, [redeemInvite]);

  const isUncompleted = profile
    ? (profile as { onboarding_completed_at?: string | null }).onboarding_completed_at == null
    : false;
  const shouldPrompt = (env.forceOnboarding || isUncompleted) && !isOnboardingSessionCompleted();

  const decision = resolveAppEntry({
    hasSession: Boolean(userId),
    hasSeenOnboarding: seenOnboarding,
    isLoading: profileLoading || householdsLoading,
    shouldPromptOnboarding: shouldPrompt,
    householdCount: households?.length ?? 0,
    householdsError,
  });

  // Auch ausserhalb des Onboardings eingerichtete Konten brauchen das lokale Flag,
  // damit sie nach dem Abmelden nicht wieder im Onboarding landen.
  const istEingerichtet = decision.kind === 'weiter';
  useEffect(() => {
    if (istEingerichtet && !seenOnboarding && !isOnboardingSessionCompleted()) {
      persistOnboardingCompleted();
    }
  }, [istEingerichtet, seenOnboarding]);

  if (decision.kind === 'umleiten') {
    return <Redirect href={decision.to} />;
  }

  // Das Overlay bewahrt den Screen-Stack bei kurzen Ladefluktuationen.
  return (
    <>
      <AppShell />
      {decision.kind === 'warten' ? (
        <View className="absolute inset-0 items-center justify-center bg-black/5">
          <ActivityIndicator size="large" />
        </View>
      ) : null}
    </>
  );
}

export default function AppLayout() {
  return <AppLayoutContent />;
}
