import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/auth/session-provider';

export default function HouseholdLayout() {
  const { session, isLoading } = useSession();

  // Auf Deep Links erst nach der Session-Hydrierung ueber Auth entscheiden.
  if (isLoading) return null;

  if (!session) return <Redirect href="/onboarding" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
