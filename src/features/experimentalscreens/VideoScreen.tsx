import { router } from 'expo-router';
import type React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullOverlay } from '@/components/components_camera/FullOverlay';
import { IconButton } from '@/components/components_camera/IconButton';
import { Row } from '@/components/components_camera/Row';
import { ThemedText } from '@/components/theme/themed-text';

interface VideoScreenProps {
  videoURL?: string;
  onClose?: () => void;
}

export function VideoScreen({ videoURL, onClose }: VideoScreenProps): React.ReactElement {
  const insets = useSafeAreaInsets();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.centerContainer}>
        <ThemedText type="title" className="mb-2 text-center">
          Video aufgenommen
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" className="text-center px-4">
          Pfad: {videoURL ?? 'Unbekannt'}
        </ThemedText>
      </View>

      <FullOverlay style={{ top: insets.top, bottom: insets.bottom }}>
        <Row>
          <View style={styles.flex} />
          <IconButton iconName="close" onPress={handleClose} />
        </Row>
      </FullOverlay>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  flex: {
    flex: 1,
  },
});
