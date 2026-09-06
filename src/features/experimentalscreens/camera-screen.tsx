import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Txt } from '@/constants/ui';

/** Native camera implementation lives in camera-screen.ios.tsx. */
export function CameraScreen() {
  return (
    <View style={styles.container}>
      <Txt variant="title" tone="inverse" center>
        Kamera-Labor nicht verfügbar
      </Txt>
      <Txt variant="body" tone="inverse" center className="mt-2 mb-6 px-6">
        Die experimentelle Kamera ist nur auf iOS aktiviert.
      </Txt>
      <Button title="Zurück" variant="secondary" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#000',
  },
});
