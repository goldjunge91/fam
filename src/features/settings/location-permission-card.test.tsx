import { render } from '@testing-library/react-native';
import { LocationPermissionCard } from './location-permission-card';
import { PermissionCard } from './permission-card';

jest.mock('./permission-card', () => ({
  PermissionCard: jest.fn(() => null),
}));

describe('LocationPermissionCard', () => {
  it('reicht Standort-Copy und die Standort-Berechtigungsfunktion an das geteilte Muster weiter', async () => {
    await render(<LocationPermissionCard />);

    const props = jest.mocked(PermissionCard).mock.calls[0]?.[0];
    expect(props).toMatchObject({
      title: 'Standort',
      label: 'Standort-Zugriff',
      grantedCopy: expect.stringContaining('Prospekte'),
      deniedCopy: expect.stringContaining('Systemeinstellungen'),
    });
    expect(props?.usePermission).toEqual(expect.any(Function));
  });
});
