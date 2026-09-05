import { router } from 'expo-router';
import type React from 'react';
import { StyleSheet, View } from 'react-native';
import { useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';
import { Button, Txt } from '@/constants/ui';

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
      <Txt variant="title" tone="inverse" center className="mb-2">
        Kamera-Berechtigung erforderlich
      </Txt>
      <Txt variant="body" tone="inverse" center className="mb-6 px-6">
        Um die VisionCamera auszuprobieren, benötigt die App Zugriff auf Kamera und Mikrofon.
      </Txt>
      <View className="w-full px-6 gap-3">
        <Button title="Berechtigungen erteilen" onPress={handleGrant} />
        <Button title="Zurück" variant="secondary" onPress={() => router.back()} />
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
