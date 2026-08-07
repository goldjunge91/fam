import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { useProfile } from '@/features/auth/api';
import { isOnboardingSessionCompleted } from '@/features/auth/onboarding-session';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useRedeemInviteMutation } from '@/features/household/api';
import { env } from '@/lib/env';
import { consumePendingInviteToken } from '@/lib/pending-invite';
import { useSyncEngine } from '@/lib/sync/sync-runner';

function AppLayoutContent() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile, isLoading: profileLoading } = useProfile(userId);
  const { activeHouseholdId, households, isLoading: householdsLoading } = useActiveHousehold();
  const redeemInvite = useRedeemInviteMutation();

  // Automatischer Sync für den aktiven Haushalt
  useSyncEngine(activeHouseholdId ?? undefined);

  useEffect(() => {
    consumePendingInviteToken().then(async (pendingToken) => {
      if (pendingToken) {
        try {
          await redeemInvite.mutateAsync(pendingToken);
          router.replace('/');
        } catch {
          router.push({ pathname: '/household/join', params: { token: pendingToken } });
        }
      }
    });
  }, [redeemInvite]);

  if (profileLoading || householdsLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Onboarding Guard (#104): Wenn EXPO_PUBLIC_FORCE_ONBOARDING=true in .env steht ODER der Account unvollständig ist, starte das Onboarding (einmalig pro App-Start).
  const isUncompleted = profile
    ? (profile as { onboarding_completed_at?: string | null }).onboarding_completed_at == null
    : false;
  const shouldPrompt = (env.forceOnboarding || isUncompleted) && !isOnboardingSessionCompleted();

  if (shouldPrompt) {
    return <Redirect href="/onboarding" />;
  }

  // Wenn der Nutzer in gar keinem Haushalt Mitglied ist, leiten wir ihn auf die Erstellen-Seite um
  if (!households || households.length === 0) {
    return <Redirect href="/household/create" />;
  }

  return <AppTabs />;
}

/** Angemeldeter Bereich. Der Guard sitzt im Root-Layout. */
export default function AppLayout() {
  return <AppLayoutContent />;
}
