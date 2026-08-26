import { renderHook, waitFor } from '@testing-library/react-native';
import { useBrochurePostalCode } from './use-brochure-postal-code';

const mockRequestPermission = jest.fn();
const mockLastKnownPosition = jest.fn();
const mockCurrentPosition = jest.fn();
const mockReverseGeocode = jest.fn();
const mockGetPostalCode = jest.fn();
const mockSetPostalCode = jest.fn();
const mockSessionState: {
  isLoading: boolean;
  session: { user: { id: string } } | null;
} = {
  isLoading: false,
  session: { user: { id: 'user-a' } },
};

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: (...args: unknown[]) => mockRequestPermission(...args),
  getLastKnownPositionAsync: (...args: unknown[]) => mockLastKnownPosition(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockCurrentPosition(...args),
  reverseGeocodeAsync: (...args: unknown[]) => mockReverseGeocode(...args),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => mockSessionState,
}));

jest.mock('@/lib/storage/account-preferences', () => ({
  getBrochurePostalCode: (...args: unknown[]) => mockGetPostalCode(...args),
  setBrochurePostalCode: (...args: unknown[]) => mockSetPostalCode(...args),
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
    mockSetPostalCode.mockResolvedValue(undefined);
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
    expect(mockGetPostalCode).not.toHaveBeenCalled();
    expect(mockReverseGeocode).not.toHaveBeenCalled();
  });

  it('greift ohne angemeldeten Nutzer weder auf Standort noch Account-Speicher zu', async () => {
    mockSessionState.session = null;
    const { result } = await renderHook(() => useBrochurePostalCode());

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockGetPostalCode).not.toHaveBeenCalled();
  });
});
