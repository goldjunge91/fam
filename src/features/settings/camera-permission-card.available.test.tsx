import { render } from '@testing-library/react-native';

import { i18n } from '@/i18n';
import { CameraPermissionCard } from './camera-permission-card';
import { PermissionCard } from './permission-card';

jest.mock('expo-camera', () => ({
  useCameraPermissions: jest.fn(),
}));

jest.mock('./permission-card', () => ({
  PermissionCard: jest.fn(() => null),
}));

test('uses expo-camera permissions when the native hook is available', async () => {
  await i18n.changeLanguage('de');
  await render(<CameraPermissionCard />);

  const props = jest.mocked(PermissionCard).mock.calls[0]?.[0];
  expect(props?.usePermission).toEqual(expect.any(Function));
});
