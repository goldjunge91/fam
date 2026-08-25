import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { CameraScreen } from '@/features/experimentalscreens/camera-screen';
import { env } from '@/lib/env';
import { useFeatureFlag } from '@/lib/posthog';

export default function CameraLabRoute() {
  const isFeatureEnabled = useFeatureFlag('experimental-vision-camera', false);
  const isAllowed = env.devTools && isFeatureEnabled;

  if (!isAllowed) {
    return (
      <View style={styles.lockedContainer}>
        <ThemedText type="title" className="mb-2 text-center">
          VisionCamera Labor gesperrt
        </ThemedText>
        <ThemedText type="body" themeColor="textSecondary" className="mb-6 text-center px-6">
          Dieser experimentelle Screen erfordert EXPO_PUBLIC_DEV_TOOLS=true und das
          PostHog-Feature-Flag "experimental-vision-camera".
        </ThemedText>
        <Button label="Zurück" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return <CameraScreen />;
}

const styles = StyleSheet.create({
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
