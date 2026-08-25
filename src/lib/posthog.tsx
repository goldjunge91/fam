import PostHog, { PostHogProvider } from 'posthog-react-native';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

import { env } from '@/lib/env';

let client: PostHog | undefined;
let attempted = false;
let initializationError: string | undefined;

export type FeatureFlagValues = Record<string, boolean | string> | undefined;

const FEATURE_FLAG_RELOAD_TIMEOUT_MS = 15_000;

const FeatureFlagContext = createContext<FeatureFlagValues>(undefined);

function FeatureFlagProvider({
  posthog,
  children,
}: {
  posthog: PostHog | undefined;
  children: ReactNode;
}) {
  const [flags, setFlags] = useState<FeatureFlagValues>(() => posthog?.getFeatureFlags());

  useEffect(() => {
    if (!posthog) {
      setFlags(undefined);
      return;
    }

    setFlags(posthog.getFeatureFlags());
    return posthog.onFeatureFlags(setFlags);
  }, [posthog]);

  return <FeatureFlagContext.Provider value={flags}>{children}</FeatureFlagContext.Provider>;
}

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
    client = new PostHog(apiKey, {
      host: env.posthogHost,
      // Erfasst App-Lifecycle (Open, Background, Install/Update) mit IP & Gerätedaten
      captureAppLifecycleEvents: true,
    });
  } catch (err) {
    initializationError = err instanceof Error ? err.message : String(err);
    console.error('[posthog] Client-Konstruktion fehlgeschlagen — Tracking bleibt aus:', err);
  }
}

/** Ob `initPostHog()` erfolgreich einen API-Key konfiguriert hat. */
export function isPostHogConfigured(): boolean {
  return client !== undefined;
}

/** Liefert den letzten Konstruktorfehler fuer die Diagnose im Dev-Bereich. */
export function getPostHogInitializationError(): string | undefined {
  return initializationError;
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
 * Laedt Flags ueber die oeffentliche Promise-API des SDK neu. PostHog liefert
 * bei HTTP- und Netzwerkfehlern `undefined`, statt die Promise abzulehnen.
 * Deshalb wird dieser Zustand als Diagnosefehler behandelt. Die zusaetzliche
 * Frist garantiert, dass der Debug-Button auch dann wieder freigegeben wird,
 * wenn SDK-Initialisierung oder Storage wider Erwarten haengen bleiben.
 */
export async function reloadPostHogFeatureFlags(): Promise<FeatureFlagValues> {
  const activeClient = getPostHogClient();
  if (!activeClient) {
    throw new Error('PostHog ist nicht konfiguriert. API-Key fehlt im Build.');
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const flags = await Promise.race([
      activeClient.reloadFeatureFlagsAsync(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error('PostHog-Flag-Abruf hat nach 15 Sekunden nicht geantwortet.'));
        }, FEATURE_FLAG_RELOAD_TIMEOUT_MS);
      }),
    ]);

    if (flags === undefined) {
      throw new Error(
        'PostHog hat keine Flags geliefert. Pruefe Project API Key, Host und Netzwerk.',
      );
    }
    return flags;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

/**
 * Haengt den konfigurierten PostHog-Client in den Provider-Baum ein. Der
 * interne Flag-Context bleibt auch ohne SDK-Client montiert, damit alle
 * Feature-Flag-Hooks ohne SDK-Warnung auf ihren Default-Wert fallen.
 *
 * Rendert absichtlich nur den Client-Wrapper, keine Login/Logout-Logik —
 * `identify()`/`reset()` braucht die Supabase-Session und lebt deshalb in
 * `PostHogIdentitySync` (`@/features/auth/posthog-identity-sync`), nicht
 * hier: `lib/` haengt nie von `features/` ab.
 */
export function PostHogAppProvider({ children }: { children: ReactNode }): ReactNode {
  const activeClient = isPostHogConfigured() ? client : undefined;
  if (!activeClient) {
    return <FeatureFlagProvider posthog={undefined}>{children}</FeatureFlagProvider>;
  }
  return (
    <PostHogProvider
      client={activeClient}
      autocapture={{ captureTouches: true, captureScreens: false }}>
      <FeatureFlagProvider posthog={activeClient}>{children}</FeatureFlagProvider>
    </PostHogProvider>
  );
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
  | 'shopping-category-feedback-alpha'
  | 'workout-log'
  | 'low-carb-tracking'
  | 'module-recipes'
  | 'module-meal-planner'
  | 'module-calories';

/**
 * Fragt den rohen Zustand eines Feature-Flags ab: `true`/`false` sobald ein
 * Wert bestaetigt ist, `undefined` solange noch keiner vorliegt. Kapselt
 * den SDK-Client-Store — Komponenten importieren ausschliesslich diese Hooks,
 * nie das SDK direkt.
 *
 * `undefined` greift in zwei Faellen: ohne konfigurierten API-Key
 * (`initPostHog()` war ein No-op) und beim allerersten App-Start, bevor
 * jemals ein Wert vom Server bestaetigt wurde. Danach liefert das SDK immer
 * sofort einen (ggf. leicht veralteten) gecachten Wert zurueck, nie ein
 * blockierendes Warten auf das Netzwerk — siehe "Offline-Verhalten" im
 * zugehoerigen Issue.
 *
 * Aufrufer, die den offenen Zustand von einem echten `false` unterscheiden
 * muessen (z. B. `ModuleGate`, das waehrend des Ladens optimistisch rendert),
 * nutzen diesen Hook. Wer nur einen Boolean will, nimmt `useFeatureFlag()`.
 *
 * `key` darf `undefined` sein (z. B. optionale Flag-Props wie in
 * `ModuleGate`) — der Hook wird trotzdem unconditional aufgerufen (Rules of
 * Hooks), das Ergebnis der SDK-Abfrage wird in dem Fall aber verworfen und
 * `undefined` zurueckgegeben.
 */
export function useFeatureFlagState(key: FeatureFlagKey | undefined): boolean | undefined {
  const flags = useContext(FeatureFlagContext);
  const value = key === undefined ? undefined : flags?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Fragt ein Feature-Flag als Boolean ab. `defaultValue` greift, solange kein
 * Wert bestaetigt ist (siehe `useFeatureFlagState`). Fuer Aufrufer, die den
 * noch nicht geladenen Zustand nicht gesondert behandeln muessen.
 */
export function useFeatureFlag(key: FeatureFlagKey | undefined, defaultValue: boolean): boolean {
  return useFeatureFlagState(key) ?? defaultValue;
}

/**
 * Fragt alle aktiven Feature-Flags als Key-Value-Map ab.
 * Liest den vom SDK aktualisierten internen Flag-Store.
 */
export function useFeatureFlags() {
  return useContext(FeatureFlagContext);
}

export { PostHog };
