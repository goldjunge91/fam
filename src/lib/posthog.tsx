import PostHog, {
  PostHogProvider,
  useFeatureFlag as usePostHogFeatureFlagSdk,
} from 'posthog-react-native';
import type { ReactNode } from 'react';

import { env } from '@/lib/env';

let client: PostHog | undefined;
let attempted = false;

/**
 * Konfiguriert den PostHog-Client einmalig pro App-Leben. Muss vor dem ersten
 * Mount von `<PostHogProvider>` laufen — wird ganz oben in `src/app/_layout.tsx`
 * aufgerufen, analog zu `initSentry()`/`initPurchases()`.
 *
 * Ohne `EXPO_PUBLIC_POSTHOG_API_KEY` (noch kein PostHog-Projekt angelegt, oder
 * ein lokaler Dev-Build ohne eigenes Tracking) bleibt das bewusst ein No-op
 * statt eines Absturzes — dasselbe Muster wie `initSentry()`/`initPurchases()`.
 * `useFeatureFlag()` faellt in dem Fall immer auf `defaultValue` zurueck.
 *
 * Wirft der Konstruktor (z. B. fehlerhafte Env-Variable, fehlendes natives
 * Storage-Modul), faengt der try/catch den Fehler ab und die App laeuft ohne
 * PostHog weiter, statt beim Modul-Eval in `src/app/_layout.tsx` abzustuerzen.
 * Der `attempted`-Flag verhindert, dass ein erneuter Aufruf denselben Fehler
 * noch einmal wirft — analog zum `configured`-Flag in `initSentry()`.
 */
export function initPostHog(): void {
  if (attempted) return;
  attempted = true;

  const apiKey = env.posthogApiKey;
  if (!apiKey) {
    if (__DEV__) {
      console.warn(
        '[posthog] EXPO_PUBLIC_POSTHOG_API_KEY fehlt — Feature-Flags fallen auf ihren ' +
          'Default-Wert zurueck. Siehe README "Umgebungsvariablen" fuer die Einrichtung.',
      );
    }
    return;
  }

  try {
    client = new PostHog(apiKey, { host: env.posthogHost });
  } catch (err) {
    console.error('[posthog] Client-Konstruktion fehlgeschlagen — Tracking bleibt aus:', err);
  }
}

/** Ob `initPostHog()` erfolgreich einen API-Key konfiguriert hat. */
export function isPostHogConfigured(): boolean {
  return client !== undefined;
}

/**
 * Der konfigurierte PostHog-Client, oder `undefined` ohne API-Key. Fuer
 * `<PostHogProvider client={...}>` in `src/app/_layout.tsx` sowie fuer
 * `identify()`/`reset()` bei Login/Logout.
 */
export function getPostHogClient(): PostHog | undefined {
  return client;
}

/**
 * Haengt den konfigurierten PostHog-Client in den Provider-Baum ein — nur
 * wenn `initPostHog()` einen API-Key konfiguriert hat, sonst reiner
 * Pass-Through (kein `<PostHogProvider>`, `useFeatureFlag()` faellt dann
 * selbst auf `defaultValue` zurueck).
 *
 * Rendert absichtlich nur den Client-Wrapper, keine Login/Logout-Logik —
 * `identify()`/`reset()` braucht die Supabase-Session und lebt deshalb in
 * `PostHogIdentitySync` (`@/features/auth/posthog-identity-sync`), nicht
 * hier: `lib/` haengt nie von `features/` ab.
 */
export function PostHogAppProvider({ children }: { children: ReactNode }): ReactNode {
  if (!isPostHogConfigured() || !client) return children;
  return <PostHogProvider client={client}>{children}</PostHogProvider>;
}

/**
 * Union bekannter Feature-Flag-Keys aus dem PostHog-Dashboard. Neue Flags
 * werden hier ergaenzt, bevor sie im Code abgefragt werden — das verhindert
 * Tippfehler an der Aufrufstelle. Jeder Key hier muss 1:1 als Flag im
 * PostHog-Dashboard angelegt sein, sonst liefert `useFeatureFlag()` dauerhaft
 * nur `defaultValue`.
 *
 * - `test-feature`: End-to-End-Test der Integration selbst (sichtbar im
 *   Entwickler-Bereich der Einstellungen, `dev-tools-screen.tsx`). Kann
 *   geloescht werden, sobald kein Zweifel mehr an der Pipeline besteht.
 * - `workout-log`: Kraftsport & Workout-Log (#175) — DB-Schema steht
 *   (`supabase/schemas/19_workouts.sql`), UI/Feature-Code noch offen
 *   (`src/features/workouts/`, aktuell leerer Platzhalter). Flag existiert
 *   noch NICHT im Dashboard — vor der ersten Abfrage anlegen.
 * - `low-carb-tracking`: Netto-Kohlenhydrate & Ballaststoff-Fokus (#180) —
 *   eigener Unterordner `src/features/calorie-tracking/low-carb/` (Konvention
 *   fuer alle Tracking-Methoden: eigener Unterordner statt eigenes Feature).
 *   Flag existiert noch NICHT im Dashboard — vor der ersten Abfrage anlegen.
 * - `module-recipes` / `module-meal-planner` / `module-calories`: Remote-Gate
 *   zusaetzlich zur nutzereigenen `ModulePreferences`-Einstellung
 *   (`@/components/module-gate`, `defaultValue: false`). Ohne diese Flags im
 *   Dashboard bleiben Rezepte/Essensplan/Tagebuch fuer ALLE echten Nutzer
 *   verborgen, unabhaengig von ihrer eigenen Einstellung — bewusstes
 *   Einschalt-Gate, kein reiner Killswitch. Vorrat/Einkauf sind davon
 *   ausgenommen (bleiben rein nutzergesteuert).
 */
export type FeatureFlagKey =
  | 'test-feature'
  | 'workout-log'
  | 'low-carb-tracking'
  | 'module-recipes'
  | 'module-meal-planner'
  | 'module-calories';

/**
 * Fragt ein Feature-Flag typsicher ab. Kapselt `useFeatureFlag()` aus
 * `posthog-react-native` — Komponenten importieren ausschliesslich diesen
 * Hook, nie das SDK direkt.
 *
 * `defaultValue` greift in zwei Faellen: ohne konfigurierten API-Key
 * (`initPostHog()` war ein No-op) und beim allerersten App-Start, bevor
 * jemals ein Wert vom Server bestaetigt wurde. Danach liefert das SDK immer
 * sofort einen (ggf. leicht veralteten) gecachten Wert zurueck, nie ein
 * blockierendes Warten auf das Netzwerk — siehe "Offline-Verhalten" im
 * zugehoerigen Issue.
 *
 * `key` darf `undefined` sein (z. B. optionale Flag-Props wie in
 * `ModuleGate`) — der Hook wird trotzdem unconditional aufgerufen (Rules of
 * Hooks), das Ergebnis der SDK-Abfrage wird in dem Fall aber verworfen und
 * `defaultValue` direkt zurueckgegeben.
 */
export function useFeatureFlag(key: FeatureFlagKey | undefined, defaultValue: boolean): boolean {
  const value = usePostHogFeatureFlagSdk(key ?? '__no_flag_key__');
  if (key === undefined || value === undefined) return defaultValue;
  return value === true;
}

export { PostHog };
