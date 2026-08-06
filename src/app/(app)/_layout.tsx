import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { useHouseholds } from '@/features/household/api';

/** Angemeldeter Bereich. Der Guard sitzt im Root-Layout. */
export default function AppLayout() {
  const { data: households, isLoading } = useHouseholds();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Wenn der Nutzer in gar keinem Haushalt Mitglied ist, leiten wir ihn auf die Erstellen-Seite um
  if (!households || households.length === 0) {
    return <Redirect href="/household/create" />;
  }

  return <AppTabs />;
}
