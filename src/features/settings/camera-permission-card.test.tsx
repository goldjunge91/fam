import { render } from '@testing-library/react-native';
import { CameraPermissionCard } from './camera-permission-card';
import { PermissionCard } from './permission-card';

jest.mock('./permission-card', () => ({
  PermissionCard: jest.fn(() => null),
}));

describe('CameraPermissionCard', () => {
  it('reicht Kamera-Copy und die Kamera-Berechtigungsfunktion an das geteilte Muster weiter', async () => {
    await render(<CameraPermissionCard />);

    const props = jest.mocked(PermissionCard).mock.calls[0]?.[0];
    expect(props).toMatchObject({
      title: 'Kamera',
      label: 'Kamera-Zugriff',
      grantedCopy: expect.stringContaining('Barcode-Scan'),
      deniedCopy: expect.stringContaining('Systemeinstellungen'),
    });
    expect(props?.usePermission).toEqual(expect.any(Function));
  });
});
