import { render, screen } from '@testing-library/react-native';
import CameraLabRoute from '@/app/settings/camera-lab';
import { env } from '@/lib/env';

const mockCameraModuleLoaded = jest.fn();
const mockAddDiagnosticStep = jest.fn();

jest.mock('@/lib/posthog', () => ({
  useFeatureFlag: jest.fn(),
}));

jest.mock('@/lib/telemetry', () => ({
  addDiagnosticStep: (...args: unknown[]) => mockAddDiagnosticStep(...args),
}));

jest.mock('@/features/experimentalscreens/camera-screen', () => {
  mockCameraModuleLoaded();
  return {
    CameraScreen: () => {
      const { Text } = require('react-native');
      return <Text testID="camera-screen-mock">Camera Screen Active</Text>;
    },
  };
});

describe('CameraLabRoute gating', () => {
  const { useFeatureFlag } = require('@/lib/posthog');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('zeigt Sperrbildschirm an, wenn Feature-Flag deaktiviert ist', async () => {
    jest.spyOn(env, 'devTools', 'get').mockReturnValue(true);
    useFeatureFlag.mockReturnValue(false);

    await render(<CameraLabRoute />);

    expect(screen.getByText('VisionCamera Labor gesperrt')).toBeTruthy();
    expect(screen.queryByTestId('camera-screen-mock')).toBeNull();
  });

  it('zeigt Sperrbildschirm an, wenn devTools deaktiviert ist', async () => {
    jest.spyOn(env, 'devTools', 'get').mockReturnValue(false);
    useFeatureFlag.mockReturnValue(true);

    await render(<CameraLabRoute />);

    expect(screen.getByText('VisionCamera Labor gesperrt')).toBeTruthy();
    expect(screen.queryByTestId('camera-screen-mock')).toBeNull();
  });

  it('laedt CameraScreen trotz aktivem Remote-Flag nicht, solange der Kill-Switch aus ist', async () => {
    jest.spyOn(env, 'devTools', 'get').mockReturnValue(true);
    useFeatureFlag.mockReturnValue(true);

    await render(<CameraLabRoute />);

    expect(screen.getByText('VisionCamera Labor gesperrt')).toBeTruthy();
    expect(screen.queryByTestId('camera-screen-mock')).toBeNull();
    expect(mockCameraModuleLoaded).not.toHaveBeenCalled();
    expect(mockAddDiagnosticStep).toHaveBeenCalledWith(
      'camera.lab.blocked',
      expect.objectContaining({ local_kill_switch: 0, remote_flag_enabled: 1 }),
    );
  });
});
