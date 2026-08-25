import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useBrochurePostalCode } from './use-brochure-postal-code';

const mockRequestPermission = jest.fn();
const mockLastKnownPosition = jest.fn();
const mockCurrentPosition = jest.fn();
const mockReverseGeocode = jest.fn();

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: (...args: unknown[]) => mockRequestPermission(...args),
  getLastKnownPositionAsync: (...args: unknown[]) => mockLastKnownPosition(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockCurrentPosition(...args),
  reverseGeocodeAsync: (...args: unknown[]) => mockReverseGeocode(...args),
}));

describe('useBrochurePostalCode', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockRequestPermission.mockResolvedValue({ status: 'granted' });
    mockLastKnownPosition.mockResolvedValue({ coords: { latitude: 52.52, longitude: 13.4 } });
    mockReverseGeocode.mockResolvedValue([
      { isoCountryCode: 'DE', postalCode: '10115', city: 'Berlin' },
    ]);
  });

  it('fragt Vordergrundstandort ab und liefert die deutsche PLZ', async () => {
    const { result } = await renderHook(() => useBrochurePostalCode());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.postalCode).toBe('10115');
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: 52.52, longitude: 13.4 });
  });

  it('verwendet bei einem temporaeren Geocoding-Fehler die zuletzt bekannte PLZ', async () => {
    await AsyncStorage.setItem('@fam/brochures/postal-code-v1', '22043');
    mockReverseGeocode.mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useBrochurePostalCode());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.postalCode).toBe('22043');
  });

  it('verwendet nach verweigerter Freigabe keine gespeicherte Standort-PLZ', async () => {
    await AsyncStorage.setItem('@fam/brochures/postal-code-v1', '22043');
    mockRequestPermission.mockResolvedValue({ status: 'denied' });
    const { result } = await renderHook(() => useBrochurePostalCode());

    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(result.current.postalCode).toBeNull();
    expect(mockReverseGeocode).not.toHaveBeenCalled();
  });
});
