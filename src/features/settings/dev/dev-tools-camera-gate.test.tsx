import { render, screen } from '@testing-library/react-native';
import CameraLabRoute from '@/app/settings/camera-lab';
import { env } from '@/lib/env';

jest.mock('@/lib/posthog', () => ({
  useFeatureFlag: jest.fn(),
}));

jest.mock('@/features/experimentalscreens/camera-screen', () => ({
  CameraScreen: () => {
    const { Text } = require('react-native');
    return <Text testID="camera-screen-mock">Camera Screen Active</Text>;
  },
}));

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

  it('rendert CameraScreen wenn devTools und Feature-Flag aktiv sind', async () => {
    jest.spyOn(env, 'devTools', 'get').mockReturnValue(true);
    useFeatureFlag.mockReturnValue(true);

    await render(<CameraLabRoute />);

    expect(screen.getByTestId('camera-screen-mock')).toBeTruthy();
    expect(screen.queryByText('VisionCamera Labor gesperrt')).toBeNull();
  });
});
