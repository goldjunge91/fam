import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import AppShell from '@/components/app-shell';
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

  // Automatischer Sync für den aktiven Haushalt
  useSyncEngine(activeHouseholdId ?? undefined);
  useRealtimeSync(activeHouseholdId ?? undefined);

  useEffect(() => {
    // Nur lesen, nicht loeschen (#128): Dieser Effekt laeuft auf jedem Mount
    // von AppLayoutContent, auch wenn der synchrone Redirect weiter unten
    // gleich danach nach /onboarding oder /household/create schickt. Wuerde
    // hier destruktiv gelesen, waere der Token weg, bevor die Einloesung
    // (die asynchron ist) ueberhaupt zu Ende lief. Erst bei Erfolg loeschen —
    // schlaegt sie fehl, bleibt er liegen, und der manuelle Beitritts-Screen
    // (/household/join) kann ihn spaeter noch verwenden.
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

  // Onboarding Guard (#104): Wenn EXPO_PUBLIC_FORCE_ONBOARDING=true in .env steht ODER der Account unvollständig ist, starte das Onboarding (einmalig pro App-Start).
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

  // Wer angemeldet ist, einen Haushalt hat und an keiner Weiche mehr haengt,
  // ist erkennbar eingerichtet — auch wenn das Geraete-Flag fehlt, weil das
  // Konto nicht ueber diesen Flow entstanden ist. Einmal nachtragen, sonst
  // landet derselbe Nutzer nach dem Abmelden im Onboarding statt beim
  // Anmelden (`isNewUser` im Root-Layout haengt an genau diesem Flag).
  const istEingerichtet = decision.kind === 'weiter';
  useEffect(() => {
    if (istEingerichtet && !seenOnboarding && !isOnboardingSessionCompleted()) {
      persistOnboardingCompleted();
    }
  }, [istEingerichtet, seenOnboarding]);

  if (decision.kind === 'warten') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (decision.kind === 'umleiten') {
    return <Redirect href={decision.to} />;
  }

  return <AppShell />;
}

/** Angemeldeter Bereich. Der Guard sitzt im Root-Layout. */
export default function AppLayout() {
  return <AppLayoutContent />;
}
