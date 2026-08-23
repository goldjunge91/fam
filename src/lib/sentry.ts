import * as Sentry from '@sentry/react-native';

import { env } from '@/lib/env';

let configured = false;

/** Wird nach `Sentry.init()` mit dem Navigation-Container verbunden. */
export const navigationIntegration = Sentry.reactNavigationIntegration();

/** Initialisiert Sentry einmalig; ohne DSN bleibt das SDK deaktiviert. */
export function initSentry(): void {
  if (configured) return;
  configured = true;

  const dsn = env.sentryDsn;
  if (!dsn) {
    if (__DEV__) {
      console.warn(
        '[sentry] EXPO_PUBLIC_SENTRY_DSN fehlt — Fehler-Tracking ist deaktiviert. ' +
          'Siehe README "Umgebungsvariablen" fuer die Einrichtung.',
      );
    }
    return;
  }

  try {
    Sentry.init({
      dsn,
      debug: env.sentryDebug,
      // Dev-Reloads erzeugen keine Traces; Produktion nutzt begrenztes Sampling.
      tracesSampleRate: __DEV__ ? 0 : 0.2,
      enableAutoSessionTracking: true,
      enableLogs: env.devTools,
      profilesSampleRate: env.devTools ? 1.0 : 0,
      // PII und Replay bleiben ausserhalb expliziter Diagnose-Builds aus.
      sendDefaultPii: env.devTools,
      replaysOnErrorSampleRate: env.devTools ? 1.0 : 0,
      replaysSessionSampleRate: env.devTools ? 0.1 : 0,
      integrations: env.devTools
        ? [navigationIntegration, Sentry.mobileReplayIntegration()]
        : [navigationIntegration],
    });
  } catch (err) {
    console.error('[sentry] Init fehlgeschlagen — Fehler-Tracking bleibt aus:', err);
  }
}

export { Sentry };
