import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/features/auth/session-provider';
import {
  getBrochurePostalCode,
  getBrochurePostalCodeSource,
  markBrochurePostalCodeAsDeviceLocation,
  setBrochurePostalCode,
} from '@/lib/storage/account-preferences';

const POSTAL_CODE_PATTERN = /^\d{5}$/;

type BrochurePostalCodeCommon = {
  retry: () => void;
  canAskAgain: boolean;
  /** true, wenn die aktuelle PLZ vom Nutzer manuell eingetragen statt per GPS ermittelt wurde. */
  isManual: boolean;
  setManualPostalCode: (postalCode: string) => Promise<void>;
  /** Verwirft die manuelle PLZ wieder und ermittelt den Standort erneut per GPS. */
  useDeviceLocation: () => void;
};

export type BrochurePostalCodeState =
  | ({ status: 'locating'; postalCode: null } & BrochurePostalCodeCommon)
  | ({ status: 'denied'; postalCode: null } & BrochurePostalCodeCommon)
  | ({ status: 'unavailable'; postalCode: null } & BrochurePostalCodeCommon)
  | ({ status: 'error'; postalCode: null } & BrochurePostalCodeCommon)
  | ({ status: 'ready'; postalCode: string } & BrochurePostalCodeCommon);

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

/**
 * Ermittelt nach Vordergrund-Freigabe nur die PLZ und speichert keine Koordinaten.
 * Alternativ kann der Nutzer die PLZ manuell eintragen (setManualPostalCode) — das
 * überspringt GPS vollständig, bis useDeviceLocation wieder auf Standortermittlung umschaltet.
 */
export function useBrochurePostalCode(): BrochurePostalCodeState {
  const { isLoading: isSessionLoading, session } = useSession();
  const userId = session?.user.id;
  // Reagiert wie location-permission-card automatisch auf AppState-Wechsel, z. B. wenn
  // der Nutzer aus den Systemeinstellungen (nach Freigabe) in die App zurückkehrt.
  const [permission, requestPermission] = Location.useForegroundPermissions();
  const canAskAgain = permission?.canAskAgain ?? true;
  const isGranted = permission?.granted ?? false;
  const [status, setStatus] = useState<BrochurePostalCodeState['status']>('locating');
  const [postalCode, setPostalCode] = useState<string | null>(null);
  const [isManual, setIsManual] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  const setManualPostalCode = useCallback(
    async (candidate: string) => {
      if (!userId) throw new Error('Kein angemeldeter Nutzer.');
      await setBrochurePostalCode(userId, candidate, 'manual');
      setAttempt((current) => current + 1);
    },
    [userId],
  );

  const useDeviceLocation = useCallback(() => {
    if (!userId) return;
    void markBrochurePostalCodeAsDeviceLocation(userId)
      .catch(() => undefined)
      .finally(() => setAttempt((current) => current + 1));
  }, [userId]);

  useEffect(() => {
    // Reading the counter makes each retry an explicit new location attempt.
    void attempt;
    let active = true;

    async function locate() {
      setStatus('locating');
      setPostalCode(null);
      if (isSessionLoading) return;
      if (!userId) {
        if (active) setStatus('unavailable');
        return;
      }

      const cached = await getBrochurePostalCode(userId).catch(() => null);
      const source = await getBrochurePostalCodeSource(userId).catch(() => null);
      if (!active) return;

      if (source === 'manual' && cached && POSTAL_CODE_PATTERN.test(cached)) {
        setPostalCode(cached);
        setIsManual(true);
        setStatus('ready');
        return;
      }
      setIsManual(false);

      if (process.env.EXPO_OS === 'web') {
        if (active) setStatus('unavailable');
        return;
      }

      try {
        const granted = isGranted || (await requestPermission()).granted;
        if (!active) return;
        if (!granted) {
          setStatus('denied');
          return;
        }

        try {
          const resolvedPostalCode = await currentPostalCode();
          if (!active) return;
          await setBrochurePostalCode(userId, resolvedPostalCode).catch(() => undefined);
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
    // isGranted triggert einen Neuversuch, sobald die Freigabe nach einem Settings-Besuch
    // aktiv wird (der Hook prüft den Status selbst bei jedem Foreground neu).
  }, [attempt, isSessionLoading, userId, isGranted, requestPermission]);

  const common: BrochurePostalCodeCommon = {
    retry,
    canAskAgain,
    isManual,
    setManualPostalCode,
    useDeviceLocation,
  };

  if (status === 'ready' && postalCode) return { status, postalCode, ...common };
  return { status: status === 'ready' ? 'error' : status, postalCode: null, ...common };
}
