import { router } from 'expo-router';
import { lazy, Suspense, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Txt } from '@/constants/ui';
import { VISION_CAMERA_LAB_ENABLED } from '@/features/experimentalscreens/vision-camera-lab';
import { env } from '@/lib/env';
import { useFeatureFlag } from '@/lib/posthog';
import { addDiagnosticStep } from '@/lib/telemetry';

const CameraScreen = lazy(() =>
  import('@/features/experimentalscreens/camera-screen').then(({ CameraScreen }) => ({
    default: CameraScreen,
  })),
);

export default function CameraLabRoute() {
  const isFeatureEnabled = useFeatureFlag('experimental-vision-camera', false);
  const isAllowed = VISION_CAMERA_LAB_ENABLED && env.devTools && isFeatureEnabled;

  useEffect(() => {
    if (isAllowed) return;
    addDiagnosticStep('camera.lab.blocked', {
      operation: 'camera.lab',
      outcome: 'blocked',
      local_kill_switch: Number(VISION_CAMERA_LAB_ENABLED),
      remote_flag_enabled: Number(isFeatureEnabled),
    });
  }, [isAllowed, isFeatureEnabled]);

  if (!isAllowed) {
    return (
      <View style={styles.lockedContainer}>
        <Txt variant="title" center className="mb-2">
          VisionCamera Labor gesperrt
        </Txt>
        <Txt variant="body" tone="secondary" center className="mb-6 px-6">
          Dieses experimentelle Labor ist in diesem Build deaktiviert.
        </Txt>
        <Button title="Zurück" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <Suspense fallback={null}>
      <CameraScreen />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
