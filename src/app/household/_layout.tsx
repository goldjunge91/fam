import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/auth/session-provider';

export default function HouseholdLayout() {
  const { session, isLoading } = useSession();

  // Erst nach dem Session-Laden weiterleiten, damit Deep Links beim Kaltstart erhalten bleiben.
  if (isLoading) return null;

  if (!session) return <Redirect href="/onboarding" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
