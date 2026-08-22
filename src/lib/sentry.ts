import * as Sentry from '@sentry/react-native';

import { env } from '@/lib/env';

let configured = false;

/**
 * Navigations-Breadcrumbs & -Performance-Spans (Expo Router baut auf React
 * Navigation auf). `Sentry.wrap()` allein liefert das NICHT mit — es haengt
 * nur eine Touch-/Profiling-Boundary um die App (siehe `sdk.js#wrap` im SDK).
 * Muss vor `Sentry.init()` erzeugt (hier, Modul-Ebene) und danach einmalig
 * mit dem Navigation-Container verbunden werden — `registerNavigationContainer`
 * ruft `src/app/_layout.tsx` auf, sobald der Router gemountet ist.
 */
export const navigationIntegration = Sentry.reactNavigationIntegration();

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

  try {
    Sentry.init({
      dsn,
      // Debug-Logging nur bei explizitem EXPO_PUBLIC_SENTRY_DEBUG=true aktivieren,
      // um das Metro-/Terminal-Log im Dev-Modus sauber zu halten.
      debug: env.sentryDebug,
      // Traces sind im Sentry-Free-Tier kontingentiert — 20% Sampling reicht,
      // um Performance-Regressionen zu sehen, ohne das Kontingent in wenigen
      // Testlaeufen zu verbrauchen. In Entwicklungs-Builds ganz aus, damit
      // Metro-Reloads keine Traces erzeugen.
      tracesSampleRate: __DEV__ ? 0 : 0.2,
      enableAutoSessionTracking: true,
      // Logs & Profiling sind zusaetzliches Kontingent (Sentry-Free-Tier) und nur
      // fuer eigene Diagnose relevant — an dieselbe Flagge gekoppelt, die auch die
      // Dev-Tools-Screens freischaltet (`EXPO_PUBLIC_DEV_TOOLS`), statt an __DEV__,
      // damit sich auch ein Test-/Preview-Build gezielt aufklappen laesst.
      enableLogs: env.devTools,
      // Relativ zu tracesSampleRate: bei devTools=true wird jeder gesampelte
      // Trace vollstaendig profiliert.
      profilesSampleRate: env.devTools ? 1.0 : 0,
      // sendDefaultPii (IP, User-Objekt, Cookies) und Session Replay (Screen-
      // Recording) sind bei einer datenschutzorientierten App mit privatem
      // Kalorien-/Gewichts-Tagebuch zu sensibel fuer den Standardbetrieb —
      // dieselbe Dev-Tools-Flagge wie oben, statt eine eigene anzulegen, damit
      // es nicht mehrere Schalter fuer denselben Zweck gibt. `mobileReplayIntegration`
      // maskiert per Default ohnehin jeden Text/jedes Bild/jede Vektorgrafik.
      sendDefaultPii: env.devTools,
      replaysOnErrorSampleRate: env.devTools ? 1.0 : 0,
      replaysSessionSampleRate: env.devTools ? 0.1 : 0,
      integrations: env.devTools
        ? [navigationIntegration, Sentry.mobileReplayIntegration()]
        : [navigationIntegration],
    });
  } catch (err) {
    // Ohne try/catch reisst ein Fehler aus `Sentry.init()` die ganze App beim
    // Modul-Eval in `src/app/_layout.tsx` mit — noch bevor irgendein Screen
    // rendert. `configured` steht bereits oben auf `true`, ein erneuter Aufruf
    // wiederholt den Fehler also nicht.
    console.error('[sentry] Init fehlgeschlagen — Fehler-Tracking bleibt aus:', err);
  }
}

export { Sentry };
