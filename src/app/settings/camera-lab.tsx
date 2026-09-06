import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Txt } from '@/constants/ui';

/** The experimental camera lab is intentionally available only on iOS. */
export default function CameraLabRoute() {
  return (
    <View style={styles.container}>
      <Txt variant="title" center>
        VisionCamera Labor nicht verfügbar
      </Txt>
      <Txt variant="body" tone="secondary" center className="mt-2 mb-6 px-6">
        Dieses experimentelle Kamera-Labor ist nur im iOS-Dev-Build verfügbar.
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
  },
});
