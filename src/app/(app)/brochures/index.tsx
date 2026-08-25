import { Stack } from 'expo-router';
import BrochuresOverviewScreen from '@/features/brochures/screens/brochures-overview-screen';

export default function BrochuresRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Angebote',
          headerShown: true,
        }}
      />
      <BrochuresOverviewScreen />
    </>
  );
}
