import { File, Paths } from 'expo-file-system';
import type { Href } from 'expo-router';
import { getDatabase } from '@/lib/db/client';
import type { SqlDatabase } from '@/lib/db/types';

// Ein Tour-Schritt beschreibt Dateiname, Navigationsziel und erwarteten aktiven Pfad.
export type ScreenshotTourStep = {
  name: string;
  href: Href;
  path: string;
  // Überschreibt die globale settleMs für Screens, die spürbar länger laden (z. B. Rezepte).
  settleMs?: number;
};

// Dieser Zustand beschreibt die für Screenshots benötigten lokalen Demo-Daten.
export type FixtureReadiness = {
  householdId: string;
  recipeId: string;
};

// Diese Funktion bringt Pfade für zuverlässige Vergleiche in ein einheitliches Format.
export function normalizeScreenshotPath(path: string): string {
  // Führende und abschließende Schrägstriche werden vor dem Neuaufbau entfernt.
  const trimmed = path.trim().replace(/^\/+|\/+$/g, '');
  // Die Root-Route bleibt '/', alle anderen Pfade erhalten genau einen führenden Slash.
  return trimmed ? `/${trimmed}` : '/';
}

/** Hier definierst du selbst, welche Screens in welcher Reihenfolge aufgenommen werden. */
export function buildScreenshotTour(recipeId: string): readonly ScreenshotTourStep[] {
  // Nur nicht auskommentierte Einträge werden vom Driver und vom Bash-Skript verarbeitet.
  return [
    // Der erste Screenshot zeigt das Dashboard unter der Root-Route.
    { name: '01-home', href: '/', path: '/' },
    // Der zweite Screenshot zeigt die Angebotsübersicht.
    { name: '02-brochures', href: '/brochures', path: '/brochures' },
    // Der dritte Screenshot zeigt den gemeinsamen Vorrat.
    { name: '03-inventory', href: '/fridge', path: '/fridge' },
    // TODO: Do not delete we comment this out to make the run faster.
    // Die folgenden Beispiele können einzeln wieder aktiviert werden.
    { name: '04-shopping-list', href: '/shopping-list', path: '/shopping-list' },
    { name: '05-meal-planner', href: '/meal-planner', path: '/meal-planner' },
    // Rezepte laden Bilder/Daten nach und brauchen daher länger als die globale settleMs.
    { name: '06-recipes', href: '/recipes', path: '/recipes', settleMs: 2_000 },
    // { name: '07-recipe-catalog', href: '/recipe/catalog', path: '/recipe/catalog' },
    {
      name: '08-recipe-detail',
      href: { pathname: '/recipe/[id]', params: { id: recipeId } },
      path: `/recipe/${recipeId}`,
      settleMs: 2_000,
    },
    // {
    //   name: '09-guided-cooking',
    //   href: { pathname: '/recipe/cook', params: { id: recipeId } },
    //   path: '/recipe/cook',
    // },
    // { name: '10-diary', href: '/diary', path: '/diary' },
    // { name: '11-profile', href: '/profile', path: '/profile' },
    // { name: '12-settings', href: '/settings', path: '/settings' },
  ];
}

export function isFixtureReady(value: FixtureReadiness): boolean {
  return value.householdId.length > 0 && value.recipeId.length > 0;
}

// Diese Meldung wird auch vom Driver zur Abbrucherkennung verwendet, daher exportiert
// statt als lokales Duplikat in ScreenshotDriver.tsx gepflegt zu werden.
export const SCREENSHOT_ABORT_MESSAGE = 'Screenshot tour aborted';

// Diese Steuerstatus-Werte werden vom Driver veröffentlicht und vom Bash-Skript per case erkannt.
export const TOUR_STATUS = {
  STARTING: '__starting__',
  DONE: '__done__',
  ERROR: '__error__',
} as const;

// Diese Funktion erzeugt einen einheitlich erkennbaren Abbruchfehler.
function createAbortError(): Error {
  const error = new Error(SCREENSHOT_ABORT_MESSAGE);
  // Der standardisierte Name macht den Fehler auch für andere Aufrufer erkennbar.
  error.name = 'AbortError';
  // Der vorbereitete Fehler wird an die wartende Funktion zurückgegeben.
  return error;
}

// Diese Funktion liest eine nutzbare Haushalts- und Rezeptkombination aus SQLite.
async function readFixtureReadiness(db: SqlDatabase): Promise<FixtureReadiness> {
  // Die Abfrage nimmt die erste nicht gelöschte Rezept-Fixture eines aktiven Haushalts.
  const fixture = await db.getFirstAsync<{ household_id: string; recipe_id: string }>(
    `select h.id as household_id, r.id as recipe_id
     from households h
     inner join recipes r on r.household_id = h.id
     where h.deleted_at is null and r.deleted_at is null
     limit 1`,
  );

  // Fehlende Datensätze werden als leere IDs dargestellt.
  return {
    householdId: fixture?.household_id ?? '',
    recipeId: fixture?.recipe_id ?? '',
  };
}

// Diese öffentliche Funktion öffnet die Datenbank und delegiert die eigentliche Prüfung.
export async function getScreenshotFixtureReadiness(): Promise<FixtureReadiness> {
  // Die bestehende App-Datenbank wird ohne eigene Verbindung wiederverwendet.
  return readFixtureReadiness(await getDatabase());
}

// Diese Funktion wartet während des App-Starts auf vollständig synchronisierte Demo-Daten.
export async function waitForScreenshotFixture(
  // Das Signal beendet die Wartephase beim Unmount oder App-Neustart.
  signal: AbortSignal,
  // Intervall und Zeitlimit können vom Capture-Skript angepasst werden.
  options: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<FixtureReadiness> {
  // Ohne Angabe wird die Datenbank zweimal pro Sekunde geprüft.
  const intervalMs = options.intervalMs ?? 500;
  // Nach 30 Sekunden gilt die Fixture standardmäßig als nicht verfügbar.
  const timeoutMs = options.timeoutMs ?? 30_000;
  // Die absolute Deadline verhindert eine unbegrenzte Warteschleife.
  const deadline = Date.now() + timeoutMs;
  console.log(`[ScreenshotTour] warte auf Fixture (timeoutMs=${timeoutMs}).`);
  // Der zuletzt gesehene Fehler landet im finalen Timeout, statt spurlos verworfen zu werden.
  let lastError: unknown;

  // Die Schleife endet bei Erfolg, Abbruch oder überschrittener Deadline.
  while (Date.now() <= deadline) {
    // Ein externer Abbruch wird sofort an den Driver weitergegeben.
    if (signal.aborted) throw createAbortError();
    // Kurzzeitige Datenbankfehler während des Starts werden bis zur Deadline toleriert.
    try {
      // Jeder Durchlauf liest den aktuellen lokalen Fixture-Zustand neu.
      const readiness = await getScreenshotFixtureReadiness();
      // Vollständige Daten beenden das Warten sofort.
      if (isFixtureReady(readiness)) {
        console.log('[ScreenshotTour] Fixture ist bereit.');
        return readiness;
      }
    } catch (error) {
      // The session/database may still be initializing. Keep waiting until the deadline.
      lastError = error;
    }
    // Zwischen zwei Prüfungen wartet die Tour, ohne den JavaScript-Thread zu blockieren.
    await new Promise<void>((resolve, reject) => {
      // Der Timer setzt die Schleife nach dem konfigurierten Intervall fort.
      const timer = setTimeout(resolve, intervalMs);
      // Ein Abbruch löscht den Timer und beendet die Promise mit dem Abbruchfehler.
      signal.addEventListener(
        'abort',
        () => {
          // Der offene Timer wird beim Abbruch nicht mehr benötigt.
          clearTimeout(timer);
          // Der Fehler beendet die gesamte Fixture-Wartephase.
          reject(createAbortError());
        },
        { once: true },
      );
    });
  }

  // Eine fehlende Fixture ist ein harter Tourfehler und wird dem Skript gemeldet.
  // Cause enthält den letzten Datenbankfehler, falls das Timeout nicht nur an fehlender Sync-Zeit lag.
  throw new Error('Screenshot fixture was not ready before the tour timeout.', {
    cause: lastError,
  });
}

// Diese Optionen stammen aus der temporären shots.json im App-Container.
export type ShotsConfig = {
  // Nur der explizite Wert true aktiviert die Tour.
  enabled: boolean;
  // Das Capture-Skript setzt diesen Zeitstempel beim Arming des Laufs.
  armedAt: number;
  // Dieses Limit wartet auf die Bestätigung einer vollständig gespeicherten PNG-Datei.
  captureTimeoutMs?: number;
  // Dieses Limit wartet vor Tourbeginn auf die Demo-Fixture.
  fixtureTimeoutMs?: number;
  // Diese Zeit lässt Layout, Daten und Animationen vor dem Capture zur Ruhe kommen.
  settleMs?: number;
};

// Diese Funktion validiert die untypisierten Daten aus shots.json.
export function parseShotsConfig(value: unknown): ShotsConfig | null {
  // Nicht-Objekte und Werte ohne enabled-Feld sind keine gültige Konfiguration.
  if (!value || typeof value !== 'object' || !('enabled' in value)) return null;
  // Der Record erlaubt die sichere Prüfung einzelner unbekannter Felder.
  const candidate = value as Record<string, unknown>;
  // Jeder andere enabled-Wert als true lässt die Tour ausgeschaltet.
  if (candidate.enabled !== true) return null;
  // Ohne Zeitstempel kann eine alte oder manuell abgelegte Datei keinen Lauf starten.
  if (typeof candidate.armedAt !== 'number' || !Number.isFinite(candidate.armedAt)) return null;

  // Dieser lokale Parser akzeptiert nur endliche, nicht negative Millisekunden.
  const optionalMilliseconds = (name: string): number | undefined => {
    // Das gewünschte Feld wird über seinen Namen aus der Konfiguration gelesen.
    const raw = candidate[name];
    // Ein fehlendes optionales Feld verwendet später seinen Standardwert.
    if (raw === undefined) return undefined;
    // NaN markiert vorhandene, aber ungültige Werte für die gemeinsame Prüfung.
    return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : NaN;
  };
  // Das Speicherlimit schützt vor einem hängenden simctl-Aufruf.
  const captureTimeoutMs = optionalMilliseconds('captureTimeoutMs');
  // Das Fixture-Limit schützt vor einer nie fertig synchronisierten Datenbank.
  const fixtureTimeoutMs = optionalMilliseconds('fixtureTimeoutMs');
  // Die Beruhigungszeit bestimmt den Abstand zwischen Navigation und Freigabe.
  const settleMs = optionalMilliseconds('settleMs');
  // Sobald ein konfigurierter Zahlenwert ungültig ist, wird die gesamte Datei verworfen.
  if ([captureTimeoutMs, fixtureTimeoutMs, settleMs].some((value) => Number.isNaN(value))) {
    return null;
  }

  // Nur geprüfte Werte gelangen in den laufenden Screenshot-Driver.
  return {
    enabled: true,
    armedAt: candidate.armedAt,
    captureTimeoutMs,
    fixtureTimeoutMs,
    settleMs,
  };
}

// Die Flag-Datei schaltet den Screenshot-Modus für genau einen App-Start ein.
const FLAG_FILE = new File(Paths.document, 'shots.json');
// Ein liegengebliebenes Flag aus einem abgebrochenen Lauf darf später keinen normalen App-Start aktivieren.
export const SCREENSHOT_FLAG_MAX_AGE_MS = 30_000;
// Die Statusdatei meldet dem Bash-Skript den aktuell freigegebenen Screen.
const STATUS_FILE = new File(Paths.document, 'shot-current.txt');
// Die Zähldatei teilt dem Skript die Länge deiner aktuellen Tourliste mit.
const EXPECTED_FILE = new File(Paths.document, 'shot-expected.txt');
// Die Bestätigungsdatei meldet der App, dass simctl das aktuelle PNG beendet hat.
const CAPTURED_FILE = new File(Paths.document, 'shot-captured.txt');
// Diese Funktion unterscheidet ein frisch vom Capture-Skript gesetztes Flag von einem Altbestand.
export function isRecentScreenshotFlag(
  timestamp: number | undefined,
  now = Date.now(),
  maxAgeMs = SCREENSHOT_FLAG_MAX_AGE_MS,
): boolean {
  // Fehlende oder ungültige Dateizeiten werden sicherheitshalber abgelehnt.
  if (
    timestamp === undefined ||
    !Number.isFinite(timestamp) ||
    !Number.isFinite(now) ||
    !Number.isFinite(maxAgeMs) ||
    maxAgeMs < 0
  ) {
    return false;
  }

  // Ein Flag darf weder aus der Zukunft stammen noch älter als das Startfenster sein.
  const ageMs = now - timestamp;
  return ageMs >= 0 && ageMs <= maxAgeMs;
}

/** Liest die Opt-in-Datei; ungültige oder deaktivierte Dateien lassen die Tour aus. */
export async function loadShotsFlag(): Promise<ShotsConfig | null> {
  // Dateizugriff und JSON-Parsing werden gemeinsam fehlertolerant behandelt.
  try {
    // Ohne vom Skript gesetzte Flag-Datei bleibt die App vollständig im Normalbetrieb.
    if (!FLAG_FILE.exists) return null;
    const config = parseShotsConfig(JSON.parse(await FLAG_FILE.text()));
    // Ein abgebrochener Capture-Lauf darf bei einem späteren normalen Start nicht nachwirken.
    if (!config || !isRecentScreenshotFlag(config.armedAt)) {
      console.warn('[ScreenshotTour] shots.json verworfen: ungültig oder nicht frisch armiert.');
      FLAG_FILE.delete();
      return null;
    }
    console.log(
      `[ScreenshotTour] shots.json akzeptiert (Arming vor ${Date.now() - config.armedAt}ms).`,
    );
    return config;
  } catch {
    // Unlesbare oder unvollständige Dateien deaktivieren den Modus sicher.
    console.warn('[ScreenshotTour] shots.json konnte nicht gelesen werden.');
    return null;
  }
}

// Diese Funktion veröffentlicht einen Screen-Namen oder einen Steuerstatus an Bash.
export async function announce(name: string): Promise<void> {
  // Das Überschreiben hält immer nur den neuesten Tourzustand bereit.
  STATUS_FILE.write(name);
  console.log(`[ScreenshotTour] Status: ${name}`);
}

// Diese Funktion veröffentlicht die Anzahl der aktuell aktivierten Tour-Einträge.
export function announceExpectedScreenshotCount(count: number): void {
  // Bash vergleicht diese Zahl nach dem Lauf mit den tatsächlich erzeugten PNGs.
  EXPECTED_FILE.write(String(count));
}

/** Hält die aktuelle Route sichtbar, bis simctl das vollständig gespeicherte PNG bestätigt. */
export async function waitForScreenshotCapture(
  // Der Name muss exakt mit dem aktuell freigegebenen Tour-Eintrag übereinstimmen.
  name: string,
  // Das Signal beendet die Wartephase, wenn der Driver unmountet wird.
  signal: AbortSignal,
  // Das großzügige Limit greift nur bei einem hängenden oder ausgefallenen Capture.
  timeoutMs = 60_000,
): Promise<void> {
  // Die absolute Deadline begrenzt die Dateiabfrage zuverlässig.
  const deadline = Date.now() + timeoutMs;
  console.log(`[ScreenshotTour] warte auf Capture-Bestätigung für ${name}.`);
  // Die Schleife prüft regelmäßig die vom Skript geschriebene Bestätigung.
  while (Date.now() <= deadline) {
    // Ein App-Abbruch beendet das Warten sofort.
    if (signal.aborted) throw createAbortError();
    // Gleichzeitiges Schreiben und Lesen wird als vorübergehender Zustand behandelt.
    try {
      // Erst der passende Name beweist, dass genau das aktuelle PNG fertig ist.
      if (CAPTURED_FILE.exists && (await CAPTURED_FILE.text()).trim() === name) {
        console.log(`[ScreenshotTour] Capture bestätigt: ${name}`);
        return;
      }
    } catch {
      // The shell may be replacing the acknowledgement while it is read.
    }
    // Das kurze Polling-Intervall reagiert schnell und belastet den Thread kaum.
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  // Ohne Bestätigung darf die App nicht unbemerkt zum nächsten Screen wechseln.
  console.error(`[ScreenshotTour] Capture-Timeout für ${name} nach ${timeoutMs}ms.`);
  throw new Error(`Screenshot was not captured before the timeout: ${name}`);
}
