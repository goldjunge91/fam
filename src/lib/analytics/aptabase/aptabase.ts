import Aptabase, {
  type AptabaseOptions,
  dispose as aptabaseDispose,
  init as aptabaseInit,
  trackError as aptabaseTrackError,
  trackEvent as aptabaseTrackEvent,
  type TrackErrorOptions,
} from '@aptabase/react-native';
import Constants from 'expo-constants';

import { env } from '@/lib/env';

let configured = false;
let initializationError: string | undefined;

/**
 * Initialisiert das Aptabase Analytics SDK einmalig pro App-Leben.
 *
 * Ohne `EXPO_PUBLIC_APTABASE_APP_KEY` (z. B. lokale Entwicklung ohne Analytics)
 * bleibt der Aufruf bewusst ein No-op statt eines Fehlers.
 *
 * Crash-Reporting wird standardmäßig deaktiviert (`enableCrashReporting: false`),
 * da Sentry (`@/lib/sentry`) für Fehler- und Crash-Erfassung zuständig ist.
 */
export function initAptabase(customOptions?: Partial<AptabaseOptions>): void {
  if (configured) return;
  configured = true;

  const appKey = env.aptabaseAppKey;
  if (!appKey) {
    if (__DEV__) {
      console.warn(
        '[aptabase] EXPO_PUBLIC_APTABASE_APP_KEY fehlt — Aptabase-Tracking ist deaktiviert. ' +
          'Siehe README "Umgebungsvariablen" fuer die Einrichtung.',
      );
    }
    return;
  }

  try {
    const appVersion = Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '1.0.0';

    aptabaseInit(appKey, {
      enableWeb: true,
      appVersion,
      enableCrashReporting: false,
      ...customOptions,
    });
  } catch (err) {
    initializationError = err instanceof Error ? err.message : String(err);
    console.error('[aptabase] Init fehlgeschlagen — Tracking bleibt aus:', err);
  }
}

/** Ob Aptabase erfolgreich initialisiert wurde und ein App-Key konfiguriert ist. */
export function isAptabaseConfigured(): boolean {
  return configured && !!env.aptabaseAppKey && !initializationError;
}

/** Liefert den letzten Initialisierungsfehler für Diagnose-Zwecke. */
export function getAptabaseInitializationError(): string | undefined {
  return initializationError;
}

/**
 * Sendet ein benutzerdefiniertes Analytics-Event an Aptabase.
 *
 * Props akzeptieren Zeichenketten, Zahlen und Booleans.
 * Aufrufe sind asynchron und blockieren den UI-Thread nicht.
 */
export function trackAptabaseEvent(
  eventName: string,
  props?: Record<string, string | number | boolean>,
): void {
  if (!isAptabaseConfigured()) return;
  try {
    aptabaseTrackEvent(eventName, props);
  } catch (err) {
    if (__DEV__) {
      console.warn('[aptabase] Event konnte nicht gesendet werden:', err);
    }
  }
}

/**
 * Sendet einen erfassten Fehler an Aptabase.
 */
export function trackAptabaseError(error: unknown, options?: TrackErrorOptions): void {
  if (!isAptabaseConfigured()) return;
  try {
    aptabaseTrackError(error, options);
  } catch (err) {
    if (__DEV__) {
      console.warn('[aptabase] Fehlerbericht konnte nicht gesendet werden:', err);
    }
  }
}

/**
 * Deinitialisiert das SDK und stoppt Event-Tracking.
 */
export function disposeAptabase(): void {
  try {
    aptabaseDispose();
  } catch (err) {
    if (__DEV__) {
      console.warn('[aptabase] Dispose fehlgeschlagen:', err);
    }
  } finally {
    configured = false;
    initializationError = undefined;
  }
}

export { Aptabase };
