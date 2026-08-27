import * as Sentry from '@sentry/react-native';

import { env } from '@/lib/env';

let configured = false;

export const SENTRY_REPLAY_DISABLE = true;

const SENTRY_REPLAY_SAMPLE_RATES = {
  replaysOnErrorSampleRate: 0.1,
  replaysSessionSampleRate: 0.01,
} as const;

export function getSentryReplayOptions(disabled: boolean) {
  return disabled ? {} : SENTRY_REPLAY_SAMPLE_RATES;
}

export const navigationIntegration = Sentry.reactNavigationIntegration();

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
      // Debug-Logging nur bei expliziter Aktivierung.
      debug: env.sentryDebug,
      // Im Free-Tier begrenztes Tracing: 20% außerhalb von Dev-Builds.
      tracesSampleRate: __DEV__ ? 0 : 0.2,
      enableAutoSessionTracking: true,
      // Logs und Profiling nur für aktivierte Entwicklerdiagnose.
      enableLogs: env.devTools,
      // Profiling erfasst jeden bereits gesampelten Trace.
      profilesSampleRate: env.devTools ? 1.0 : 0,
      // PII umfasst IP-Adresse und erweiterte Gerätekontexte.
      sendDefaultPii: true,
      ...getSentryReplayOptions(SENTRY_REPLAY_DISABLE),
      integrations: [navigationIntegration],
    });
  } catch (err) {
    // Initialisierungsfehler dürfen den App-Start nicht abbrechen.
    console.error('[sentry] Init fehlgeschlagen — Fehler-Tracking bleibt aus:', err);
  }
}

export { Sentry };
