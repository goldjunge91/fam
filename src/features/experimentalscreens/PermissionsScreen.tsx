import { router } from 'expo-router';
import type React from 'react';
import { StyleSheet, View } from 'react-native';
import { useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';

interface PermissionsScreenProps {
  onPermissionsGranted?: () => void;
}

export function PermissionsScreen({
  onPermissionsGranted,
}: PermissionsScreenProps): React.ReactElement {
  const cameraPermission = useCameraPermission();
  const microphonePermission = useMicrophonePermission();

  const handleGrant = async () => {
    const cameraGranted = await cameraPermission.requestPermission();
    const micGranted = await microphonePermission.requestPermission();
    if (cameraGranted && micGranted) {
      onPermissionsGranted?.();
    }
  };

  return (
    <View style={styles.textContainer}>
      <ThemedText type="title" className="mb-2 text-center">
        Kamera-Berechtigung erforderlich
      </ThemedText>
      <ThemedText type="body" themeColor="textSecondary" className="mb-6 text-center px-6">
        Um die VisionCamera auszuprobieren, benötigt die App Zugriff auf Kamera und Mikrofon.
      </ThemedText>
      <View className="w-full px-6 gap-3">
        <Button label="Berechtigungen erteilen" onPress={handleGrant} />
        <Button label="Zurück" variant="secondary" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});
