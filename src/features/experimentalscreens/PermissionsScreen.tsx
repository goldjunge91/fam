import type React from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/constants/ui';

/** Native permission handling lives in PermissionsScreen.ios.tsx. */
export function PermissionsScreen(): React.ReactElement {
  return (
    <View style={styles.container}>
      <Txt variant="body" tone="inverse" center>
        Kamera-Berechtigungen sind nur auf iOS verfügbar.
      </Txt>
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
