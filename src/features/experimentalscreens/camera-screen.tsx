import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type CameraDevice,
  type Photo,
  type Recorder,
  useCameraDevices,
  useCameraPermission,
  useMicrophonePermission,
  usePhotoOutput,
  useVideoOutput,
} from 'react-native-vision-camera';
import { CameraSelectorButton } from '@/components/components_camera/CameraSelectorButton';
import { CameraView } from '@/components/components_camera/CameraView';
import { CaptureButton } from '@/components/components_camera/CaptureButton';
import { FullOverlay } from '@/components/components_camera/FullOverlay';
import { IconButton } from '@/components/components_camera/IconButton';
import { Row } from '@/components/components_camera/Row';
import { ThemedText } from '@/components/theme/themed-text';
import { PermissionsScreen } from '@/features/experimentalscreens/PermissionsScreen';
import { PhotoScreen } from '@/features/experimentalscreens/PhotoScreen';
import { VideoScreen } from '@/features/experimentalscreens/VideoScreen';
import { useIsActive } from '@/hooks/useIsActive';
import { logDevices } from '@/lib/debug-log';

export function CameraScreen() {
  const insets = useSafeAreaInsets();
  const isAppActive = useIsActive();
  const cameraPermission = useCameraPermission();
  const microphonePermission = useMicrophonePermission();

  const [capturedPhoto, setCapturedPhoto] = useState<Photo | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);

  const uiRotation = useRef(new Animated.Value(0)).current;

  const devices = useCameraDevices();
  const defaultDevice = devices[0];
  const [device, setDevice] = useState<CameraDevice | undefined>(defaultDevice);

  useEffect(() => {
    if (!device && defaultDevice) {
      setDevice(defaultDevice);
    }
  }, [defaultDevice, device]);

  useEffect(() => {
    if (devices.length > 0) {
      logDevices(devices);
    }
  }, [devices]);

  const photoOutput = usePhotoOutput({});
  const videoOutput = useVideoOutput({
    enableAudio: microphonePermission.hasPermission,
  });

  const takePhoto = useCallback(async () => {
    try {
      console.log('Capturing Photo...');
      const start = performance.now();
      const photo = await photoOutput.capturePhoto({}, {});
      const end = performance.now();
      console.log(
        `Captured ${photo.width}x${photo.height} ${photo.containerFormat} Photo in ${(end - start).toFixed(2)}ms!`,
      );
      setCapturedPhoto(photo);
    } catch (e) {
      console.error('Failed to take Photo!', e);
    }
  }, [photoOutput]);

  const preparedRecorder = useRef<Recorder | undefined>(undefined);
  const activeRecorder = useRef<Recorder | undefined>(undefined);

  const startRecording = useCallback(async () => {
    console.log('Starting Recording...');
    let recorder = preparedRecorder.current;
    if (recorder == null) {
      recorder = await videoOutput.createRecorder({});
    }
    if (activeRecorder.current != null) {
      console.error('Cannot start recording - already actively recording!');
      return;
    }
    activeRecorder.current = recorder;
    await recorder.startRecording(
      (path) => {
        console.log('Recording finished! Path:', path);
        setRecordedVideoUrl(path);
        activeRecorder.current = undefined;
      },
      (error) => {
        console.error('Failed to record!', error);
        activeRecorder.current = undefined;
      },
      () => console.log('Recording paused'),
      () => console.log('Recording resumed.'),
    );
    preparedRecorder.current = await videoOutput.createRecorder({});
  }, [videoOutput]);

  const stopRecording = useCallback(async () => {
    console.log('Stopping Recording...');
    const recorder = activeRecorder.current;
    if (recorder == null) {
      console.error('Not actively recording - cannot stop recording!');
      return;
    }
    activeRecorder.current = undefined;
    await recorder.stopRecording();
    console.log('Recording stopped!');
  }, []);

  if (!cameraPermission.hasPermission) {
    return <PermissionsScreen />;
  }

  if (capturedPhoto) {
    return <PhotoScreen photo={capturedPhoto} onClose={() => setCapturedPhoto(null)} />;
  }

  if (recordedVideoUrl) {
    return <VideoScreen videoURL={recordedVideoUrl} onClose={() => setRecordedVideoUrl(null)} />;
  }

  if (device == null) {
    return (
      <View style={[styles.container, styles.center]}>
        <ThemedText type="body">Kein Kamera-Gerät gefunden.</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <CameraView
        isActive={isAppActive}
        device={device}
        outputs={[photoOutput, videoOutput]}
        mirrorMode={device.position === 'front' ? 'on' : 'off'}
        orientationSource="device"
        onUIRotationChanged={(rotation: number) => {
          Animated.spring(uiRotation, {
            toValue: rotation,
            useNativeDriver: true,
          }).start();
        }}
        onInterruptionStarted={(reason: string) =>
          console.log(`Camera interrupted! Reason: ${reason}`)
        }
        onInterruptionEnded={() => console.log('Camera interruption over.')}
        onError={(error: unknown) => console.error('Camera error:', error)}
      />

      <FullOverlay style={{ top: insets.top, bottom: insets.bottom + 10 }}>
        <Row style={styles.topRow}>
          <IconButton iconName="close" onPress={() => router.back()} />
          <View style={styles.flex} />
          <CameraSelectorButton
            uiRotation={uiRotation}
            devices={devices}
            currentDevice={device}
            setDevice={(d) => setDevice(d)}
          />
        </Row>
        <View style={styles.flex} />

        <View style={styles.captureButtonRow}>
          <CaptureButton
            takePhoto={takePhoto}
            startRecording={startRecording}
            stopRecording={stopRecording}
          />
        </View>
      </FullOverlay>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  topRow: {
    alignItems: 'center',
  },
  captureButtonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
});
