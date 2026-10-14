import { render } from '@testing-library/react-native';

import { i18n } from '@/i18n';
import { CameraPermissionCard } from './camera-permission-card';
import { PermissionCard } from './permission-card';

jest.mock('expo-camera', () => {
  throw new Error('Native camera module unavailable');
});

jest.mock('./permission-card', () => ({
  PermissionCard: jest.fn(() => null),
}));

test('keeps the permission card functional when expo-camera is unavailable', async () => {
  await i18n.changeLanguage('de');
  await render(<CameraPermissionCard />);

  const props = jest.mocked(PermissionCard).mock.calls[0]?.[0];
  if (props === undefined) throw new Error('Permission card props were not forwarded.');

  const [permission, requestPermission] = props.usePermission();
  expect(permission).toBeNull();
  await expect(requestPermission()).resolves.toEqual({ granted: false });
});
