import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { type Image, NitroImage } from 'react-native-nitro-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Photo } from 'react-native-vision-camera';
import { FullOverlay } from '@/components/components_camera/FullOverlay';
import { IconButton } from '@/components/components_camera/IconButton';
import { Row } from '@/components/components_camera/Row';

interface PhotoScreenProps {
  photo?: Photo;
  photoUri?: string;
  onClose?: () => void;
}

export function PhotoScreen({ photo, onClose }: PhotoScreenProps) {
  const insets = useSafeAreaInsets();
  const [image, setImage] = useState<Image>();

  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    const load = async () => {
      try {
        const i = await photo.toImageAsync();
        if (!cancelled) {
          setImage(i);
        }
      } catch (error) {
        console.error('Failed to convert photo to image:', error);
      } finally {
        try {
          photo.dispose();
        } catch {}
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [photo]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {image != null ? (
        <NitroImage style={styles.image} resizeMode="contain" image={image} />
      ) : (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color="white" />
        </View>
      )}

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
  },
  image: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
  },
  flex: {
    flex: 1,
  },
});
