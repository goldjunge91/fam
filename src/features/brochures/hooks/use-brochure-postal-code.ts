import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = '@fam/brochures/postal-code-v1';
const POSTAL_CODE_PATTERN = /^\d{5}$/;

export type BrochurePostalCodeState =
  | { status: 'locating'; postalCode: null; retry: () => void }
  | { status: 'denied'; postalCode: null; retry: () => void }
  | { status: 'unavailable'; postalCode: null; retry: () => void }
  | { status: 'error'; postalCode: null; retry: () => void }
  | { status: 'ready'; postalCode: string; retry: () => void };

async function currentPostalCode(): Promise<string> {
  const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 60 * 60 * 1000 });
  const position =
    lastKnown ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  const addresses = await Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });
  const germanAddress = addresses.find(
    (address) =>
      address.isoCountryCode?.toUpperCase() === 'DE' &&
      address.postalCode &&
      POSTAL_CODE_PATTERN.test(address.postalCode),
  );
  if (!germanAddress?.postalCode) {
    throw new Error('Am aktuellen Standort wurde keine deutsche PLZ gefunden.');
  }
  return germanAddress.postalCode;
}

/** Ermittelt nach Vordergrund-Freigabe nur die PLZ und speichert keine Koordinaten. */
export function useBrochurePostalCode(): BrochurePostalCodeState {
  const [status, setStatus] = useState<BrochurePostalCodeState['status']>('locating');
  const [postalCode, setPostalCode] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    // Reading the counter makes each retry an explicit new location attempt.
    void attempt;
    let active = true;

    async function locate() {
      setStatus('locating');
      setPostalCode(null);
      if (process.env.EXPO_OS === 'web') {
        if (active) setStatus('unavailable');
        return;
      }

      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (permission.status !== 'granted') {
          setStatus('denied');
          return;
        }

        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        try {
          const resolvedPostalCode = await currentPostalCode();
          if (!active) return;
          await AsyncStorage.setItem(STORAGE_KEY, resolvedPostalCode);
          setPostalCode(resolvedPostalCode);
          setStatus('ready');
        } catch (error) {
          if (!active) return;
          if (cached && POSTAL_CODE_PATTERN.test(cached)) {
            setPostalCode(cached);
            setStatus('ready');
            return;
          }
          throw error;
        }
      } catch {
        if (active) setStatus('error');
      }
    }

    void locate();
    return () => {
      active = false;
    };
  }, [attempt]);

  if (status === 'ready' && postalCode) return { status, postalCode, retry };
  return { status: status === 'ready' ? 'error' : status, postalCode: null, retry };
}
