import * as Sentry from '@sentry/react-native';

import { env } from '@/lib/env';

let configured = false;

/**
 * Initialisiert Sentry einmalig pro App-Leben. Muss vor dem ersten
 * `Sentry.captureException`/`captureMessage` laufen — wird ganz oben in
 * `src/app/_layout.tsx` aufgerufen, noch vor allen anderen Imports mit
 * Nebenwirkungen.
 *
 * Ohne `EXPO_PUBLIC_SENTRY_DSN` (noch kein Sentry-Projekt angelegt, oder ein
 * lokaler Dev-Build ohne eigenes Tracking) bleibt das bewusst ein No-op statt
 * eines Absturzes — dasselbe Muster wie `initPurchases()` in `@/lib/purchases`.
 * `captureException`/`captureMessage` sind in dem Fall selbst No-ops (Sentry
 * SDK faengt Aufrufe vor `init()` intern ab), Call-Sites muessen also nicht
 * zusaetzlich pruefen, ob Sentry aktiv ist.
 */
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

  Sentry.init({
    dsn,
    debug: __DEV__,
    // Traces sind im Sentry-Free-Tier kontingentiert — 20% Sampling reicht,
    // um Performance-Regressionen zu sehen, ohne das Kontingent in wenigen
    // Testlaeufen zu verbrauchen. In Entwicklungs-Builds ganz aus, damit
    // Metro-Reloads keine Traces erzeugen.
    tracesSampleRate: __DEV__ ? 0 : 0.2,
    enableAutoSessionTracking: true,
  });
}

export { Sentry };
