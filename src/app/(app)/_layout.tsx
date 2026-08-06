import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { useProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
import { useHouseholds } from '@/features/household/api';
import { env } from '@/lib/env';
import { useSyncEngine } from '@/lib/sync/sync-runner';

import { isOnboardingSessionCompleted } from '@/features/auth/onboarding-session';

/** Angemeldeter Bereich. Der Guard sitzt im Root-Layout. */
export default function AppLayout() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile, isLoading: profileLoading } = useProfile(userId);
  const { data: households, isLoading: householdsLoading } = useHouseholds();
  const currentHousehold = households?.[0];

  // Automatischer Sync für den aktuellen Haushalt
  useSyncEngine(currentHousehold?.id);

  if (profileLoading || householdsLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Onboarding Guard (#104): Wenn EXPO_PUBLIC_FORCE_ONBOARDING=true in .env steht ODER der Account unvollständig ist, starte das Onboarding (einmalig pro App-Start).
  const isUncompleted = profile ? profile.onboarding_completed_at == null : false;
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

