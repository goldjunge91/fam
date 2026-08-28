import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useBrochurePostalCode } from './use-brochure-postal-code';

const mockRequestPermission = jest.fn();
const mockLastKnownPosition = jest.fn();
const mockCurrentPosition = jest.fn();
const mockReverseGeocode = jest.fn();
const mockGetPostalCode = jest.fn();
const mockSetPostalCode = jest.fn();
const mockGetPostalCodeSource = jest.fn();
const mockMarkAsDeviceLocation = jest.fn();
const mockSessionState: {
  isLoading: boolean;
  session: { user: { id: string } } | null;
} = {
  isLoading: false,
  session: { user: { id: 'user-a' } },
};

jest.mock('expo-location', () => {
  const { useCallback, useState } = require('react');
  return {
    Accuracy: { Balanced: 3 },
    // Simuliert den reaktiven Hook: jeder request() aktualisiert den zurückgegebenen
    // Permission-State, wie es Location.useForegroundPermissions() in der App auch tut.
    // requestPermission ist per useCallback stabil, genau wie beim echten Expo-Hook.
    useForegroundPermissions: () => {
      const [permission, setPermission] = useState(
        null as { granted: boolean; canAskAgain: boolean } | null,
      );
      const requestPermission = useCallback(async (...args: unknown[]) => {
        const result = await mockRequestPermission(...args);
        const next = {
          granted: result.status === 'granted',
          canAskAgain: result.canAskAgain ?? true,
        };
        setPermission(next);
        return next;
      }, []);
      return [permission, requestPermission];
    },
    getLastKnownPositionAsync: (...args: unknown[]) => mockLastKnownPosition(...args),
    getCurrentPositionAsync: (...args: unknown[]) => mockCurrentPosition(...args),
    reverseGeocodeAsync: (...args: unknown[]) => mockReverseGeocode(...args),
  };
});

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => mockSessionState,
}));

jest.mock('@/lib/storage/account-preferences', () => ({
  getBrochurePostalCode: (...args: unknown[]) => mockGetPostalCode(...args),
  getBrochurePostalCodeSource: (...args: unknown[]) => mockGetPostalCodeSource(...args),
  setBrochurePostalCode: (...args: unknown[]) => mockSetPostalCode(...args),
  markBrochurePostalCodeAsDeviceLocation: (...args: unknown[]) => mockMarkAsDeviceLocation(...args),
}));

describe('useBrochurePostalCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionState.isLoading = false;
    mockSessionState.session = { user: { id: 'user-a' } };
    mockRequestPermission.mockResolvedValue({ status: 'granted' });
    mockLastKnownPosition.mockResolvedValue({ coords: { latitude: 52.52, longitude: 13.4 } });
    mockReverseGeocode.mockResolvedValue([
      { isoCountryCode: 'DE', postalCode: '10115', city: 'Berlin' },
    ]);
    mockGetPostalCode.mockResolvedValue(null);
    mockGetPostalCodeSource.mockResolvedValue(null);
    mockSetPostalCode.mockResolvedValue(undefined);
    mockMarkAsDeviceLocation.mockResolvedValue(undefined);
  });

  it('fragt Vordergrundstandort ab und speichert die deutsche PLZ für den Nutzer', async () => {
    const { result } = await renderHook(() => useBrochurePostalCode());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.postalCode).toBe('10115');
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: 52.52, longitude: 13.4 });
    expect(mockSetPostalCode).toHaveBeenCalledWith('user-a', '10115');
  });

  it('verwendet bei einem temporären Geocoding-Fehler nur die PLZ desselben Nutzers', async () => {
    mockGetPostalCode.mockResolvedValue('22043');
    mockReverseGeocode.mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useBrochurePostalCode());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.postalCode).toBe('22043');
    expect(mockGetPostalCode).toHaveBeenCalledWith('user-a');
  });

  it('verwendet nach verweigerter Freigabe keine gespeicherte Standort-PLZ', async () => {
    mockGetPostalCode.mockResolvedValue('22043');
    mockRequestPermission.mockResolvedValue({ status: 'denied' });
    const { result } = await renderHook(() => useBrochurePostalCode());

    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(result.current.postalCode).toBeNull();
    expect(mockReverseGeocode).not.toHaveBeenCalled();
  });

  it('greift ohne angemeldeten Nutzer weder auf Standort noch Account-Speicher zu', async () => {
    mockSessionState.session = null;
    const { result } = await renderHook(() => useBrochurePostalCode());

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockGetPostalCode).not.toHaveBeenCalled();
  });

  it('überspringt GPS und Berechtigung, wenn eine manuelle PLZ gespeichert ist', async () => {
    mockGetPostalCode.mockResolvedValue('80331');
    mockGetPostalCodeSource.mockResolvedValue('manual');
    const { result } = await renderHook(() => useBrochurePostalCode());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.postalCode).toBe('80331');
    expect(result.current.isManual).toBe(true);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockReverseGeocode).not.toHaveBeenCalled();
  });

  it('speichert eine manuell eingegebene PLZ als manuelle Quelle und wechselt auf ready', async () => {
    const { result } = await renderHook(() => useBrochurePostalCode());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    mockGetPostalCode.mockResolvedValue('80331');
    mockGetPostalCodeSource.mockResolvedValue('manual');
    await act(() => result.current.setManualPostalCode('80331'));

    expect(mockSetPostalCode).toHaveBeenCalledWith('user-a', '80331', 'manual');
    await waitFor(() => expect(result.current.postalCode).toBe('80331'));
    expect(result.current.isManual).toBe(true);
  });

  it('wechselt über useDeviceLocation wieder zur GPS-Ermittlung', async () => {
    mockGetPostalCode.mockResolvedValue('80331');
    mockGetPostalCodeSource.mockResolvedValue('manual');
    const { result } = await renderHook(() => useBrochurePostalCode());
    await waitFor(() => expect(result.current.isManual).toBe(true));

    mockGetPostalCodeSource.mockResolvedValue('gps');
    // useDeviceLocation stößt den Attempt-Zähler erst nach dem markBrochurePostalCode…-Promise
    // an (.finally); dafür muss der act()-Scope über diese Microtask-Kette hinaus offen bleiben.
    await act(async () => {
      result.current.useDeviceLocation();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(mockMarkAsDeviceLocation).toHaveBeenCalledWith('user-a'));
    await waitFor(() => expect(result.current.postalCode).toBe('10115'));
    expect(result.current.isManual).toBe(false);
  });
});
