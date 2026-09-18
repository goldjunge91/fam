import { render } from '@testing-library/react-native';
import { i18n } from '@/i18n';
import { MicrophonePermissionCard } from './microphone-permission-card';
import { PermissionCard } from './permission-card';

jest.mock('./permission-card', () => ({
  PermissionCard: jest.fn(() => null),
}));

describe('MicrophonePermissionCard', () => {
  it('reicht Mikrofon-Copy und die Mikrofon-Berechtigungsfunktion an das geteilte Muster weiter', async () => {
    await i18n.changeLanguage('de');
    await render(<MicrophonePermissionCard />);

    const props = jest.mocked(PermissionCard).mock.calls[0]?.[0];
    expect(props).toMatchObject({
      title: 'Mikrofon',
      label: 'Mikrofon-Zugriff',
      grantedCopy: expect.stringContaining('Spracheingabe'),
      deniedCopy: expect.stringContaining('Systemeinstellungen'),
    });
    expect(props?.usePermission).toEqual(expect.any(Function));
  });
});
