import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { PermissionCard } from './permission-card';

jest.spyOn(Linking, 'openSettings').mockImplementation(() => Promise.resolve());

describe('PermissionCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('zeigt den Schalter an, wenn die Berechtigung erteilt ist', async () => {
    const usePermission = jest
      .fn()
      .mockReturnValue([{ granted: true, canAskAgain: true }, jest.fn()]);

    await render(
      <PermissionCard
        title="Kamera"
        label="Kamera-Zugriff"
        grantedCopy="Erlaubt."
        deniedCopy="Verweigert."
        usePermission={usePermission}
      />,
    );

    expect(screen.getByRole('switch')).toHaveProp('value', true);
  });

  it('fordert die Berechtigung erneut an, wenn sie noch angefragt werden kann', async () => {
    const requestPermission = jest.fn().mockResolvedValue({ granted: true, canAskAgain: true });
    const usePermission = jest
      .fn()
      .mockReturnValue([{ granted: false, canAskAgain: true }, requestPermission]);

    await render(
      <PermissionCard
        title="Kamera"
        label="Kamera-Zugriff"
        grantedCopy="Erlaubt."
        deniedCopy="Verweigert."
        usePermission={usePermission}
      />,
    );
    fireEvent(screen.getByRole('switch'), 'valueChange', true);

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(Linking.openSettings).not.toHaveBeenCalled();
  });

  it('verweist auf die Systemeinstellungen, wenn erneutes Anfragen nicht mehr moeglich ist', async () => {
    const requestPermission = jest.fn().mockResolvedValue({ granted: false, canAskAgain: false });
    const usePermission = jest
      .fn()
      .mockReturnValue([{ granted: false, canAskAgain: false }, requestPermission]);

    await render(
      <PermissionCard
        title="Kamera"
        label="Kamera-Zugriff"
        grantedCopy="Erlaubt."
        deniedCopy="Verweigert."
        usePermission={usePermission}
      />,
    );
    fireEvent(screen.getByRole('switch'), 'valueChange', true);

    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    expect(requestPermission).not.toHaveBeenCalled();
  });
});
