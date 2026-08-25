import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CameraScreen } from '@/features/experimentalscreens/camera-screen';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockRequestCameraPermission = jest.fn();
const mockRequestMicrophonePermission = jest.fn();
let mockCameraHasPermission = true;
let mockMicrophoneHasPermission = true;

jest.mock('react-native-vision-camera', () => ({
  useCameraPermission: () => ({
    hasPermission: mockCameraHasPermission,
    requestPermission: mockRequestCameraPermission,
  }),
  useMicrophonePermission: () => ({
    hasPermission: mockMicrophoneHasPermission,
    requestPermission: mockRequestMicrophonePermission,
  }),
  useCameraDevices: () => [
    {
      id: 'back-camera-1',
      position: 'back',
      localizedName: 'Back Camera',
      supportedPixelFormats: ['yuv', 'rgb'],
      getSupportedResolutions: () => [{ width: 1920, height: 1080 }],
      supportedFPSRanges: [{ min: 30, max: 60 }],
      supportedVideoDynamicRanges: ['sdr'],
    },
  ],
  usePhotoOutput: () => ({
    capturePhoto: jest.fn(),
  }),
  useVideoOutput: () => ({
    createRecorder: jest.fn(),
  }),
  useFrameOutput: () => ({}),
  Camera: () => {
    const { View } = require('react-native');
    return <View testID="vision-camera-view" />;
  },
}));

jest.mock('@/hooks/useIsActive', () => ({
  useIsActive: () => true,
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));

describe('CameraScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCameraHasPermission = true;
    mockMicrophoneHasPermission = true;
  });

  it('zeigt PermissionsScreen wenn Kamera-Permission fehlt', async () => {
    mockCameraHasPermission = false;

    await render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <CameraScreen />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Kamera-Berechtigung erforderlich')).toBeTruthy();
    expect(screen.getByText('Berechtigungen erteilen')).toBeTruthy();
    expect(screen.queryByTestId('vision-camera-view')).toBeNull();
  });

  it('rendert Kamera-Viewfinder wenn Berechtigungen vorhanden sind', async () => {
    mockCameraHasPermission = true;

    await render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <CameraScreen />
      </SafeAreaProvider>,
    );

    expect(screen.getByTestId('vision-camera-view')).toBeTruthy();
    expect(screen.queryByText('Kamera-Berechtigung erforderlich')).toBeNull();
  });
});
