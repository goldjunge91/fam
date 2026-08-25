import type React from 'react';
import { useCallback } from 'react';
import { Animated } from 'react-native';
import type { CameraDevice } from 'react-native-vision-camera';
import { IconButton } from './IconButton';

interface Props {
  devices: CameraDevice[];
  currentDevice?: CameraDevice;
  setDevice: (device: CameraDevice) => void;
  uiRotation: Animated.Value;
}

export function CameraSelectorButton({
  devices,
  currentDevice,
  setDevice,
  uiRotation,
}: Props): React.ReactElement | null {
  const onToggleDevice = useCallback(() => {
    if (devices.length <= 1) return;
    const currentIndex = devices.findIndex((d) => d.id === currentDevice?.id);
    const nextIndex = (currentIndex + 1) % devices.length;
    setDevice(devices[nextIndex]);
  }, [devices, currentDevice, setDevice]);

  if (devices.length === 0) {
    return null;
  }

  const rotate = uiRotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        transform: [{ rotate }],
      }}>
      <IconButton iconName="camera.rotate" onPress={onToggleDevice} />
    </Animated.View>
  );
}
