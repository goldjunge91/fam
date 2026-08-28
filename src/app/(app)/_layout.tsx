import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import AppShell from '@/components/layout/app-shell';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useRedeemInviteMutation } from '@/features/household/api';
import { resolveAppEntry } from '@/features/onboarding/domain/app-entry';
import {
  isOnboardingSessionCompleted,
  persistOnboardingCompleted,
} from '@/features/onboarding/onboarding-completion';
import { useProfile } from '@/features/profile/api';
import { useSignOutOnOrphanedProfile } from '@/features/profile/hooks/use-sign-out-on-orphaned-profile';
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

  // Automatischer Sync für den aktiven Haushalt
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

  // AppShell bleibt bei kurzen Ladephasen gemountet; der Indikator liegt als Overlay darüber.
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

/** Angemeldeter Bereich. Der Guard sitzt im Root-Layout. */
export default function AppLayout() {
  return <AppLayoutContent />;
}
