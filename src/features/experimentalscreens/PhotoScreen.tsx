import { router } from 'expo-router';
import type React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Txt } from '@/constants/ui';

interface PhotoScreenProps {
  photo?: unknown;
  onClose?: () => void;
}

/** Native NitroImage rendering lives in PhotoScreen.ios.tsx. */
export function PhotoScreen({ onClose }: PhotoScreenProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <Txt variant="title" tone="inverse" center>
        Fotovorschau nicht verfügbar
      </Txt>
      <Txt variant="body" tone="inverse" center className="mt-2 mb-6 px-6">
        Die experimentelle Fotovorschau ist nur auf iOS verfügbar.
      </Txt>
      <Button title="Zurück" variant="secondary" onPress={onClose ?? (() => router.back())} />
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
