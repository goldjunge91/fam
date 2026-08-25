import { Stack, useLocalSearchParams } from 'expo-router';
import BrochureViewerScreen from '@/features/brochures/screens/brochure-viewer-screen';

export default function BrochureViewerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) return null;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false, // Vollbild
          presentation: 'fullScreenModal',
        }}
      />
      <BrochureViewerScreen brochureId={id} />
    </>
  );
}
