/**
 * Unsichtbarer Screenshot-Tour-Driver für den opt-in Capture-Modus.
 * Er wartet auf Session und Demo-Daten, öffnet deine Screens und hält jeden
 * davon sichtbar, bis das Bash-Skript das fertig gespeicherte PNG bestätigt.
 * Ohne shots.json bleibt er vollständig inaktiv.
 */
import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useSession } from '@/features/auth/session-provider';
import {
  announce,
  announceExpectedScreenshotCount,
  buildScreenshotTour,
  loadShotsFlag,
  normalizeScreenshotPath,
  SCREENSHOT_ABORT_MESSAGE,
  type ShotsConfig,
  TOUR_STATUS,
  waitForScreenshotCapture,
  waitForScreenshotFixture,
} from '@/lib/screenshots';

// Alle kontrollierten Abbrüche verwenden dieselbe, in screenshots.ts gepflegte Meldung.
const ABORT_MESSAGE = SCREENSHOT_ABORT_MESSAGE;

// Diese Wartefunktion reagiert auch während eines Timeouts auf einen Unmount.
function delay(ms: number, signal: AbortSignal): Promise<void> {
  // Ein bereits abgebrochener Lauf erzeugt keinen neuen Timer.
  if (signal.aborted) return Promise.reject(new Error(ABORT_MESSAGE));

  // Die Promise endet durch den Timer oder durch das AbortSignal.
  return new Promise((resolve, reject) => {
    // Der Timer erfüllt die normale Wartezeit.
    const timer = setTimeout(resolve, ms);
    // Der Listener beendet eine noch offene Wartezeit.
    signal.addEventListener(
      'abort',
      () => {
        // Der Timer wird nach einem Abbruch nicht mehr gebraucht.
        clearTimeout(timer);
        // Der Fehler beendet die aktuelle Tour kontrolliert.
        reject(new Error(ABORT_MESSAGE));
      },
      { once: true },
    );
  });
}

// Diese Funktion bestätigt nach replace den tatsächlich aktiven Expo-Router-Pfad.
async function waitForRoute(
  // Dieser Pfad gehört zum aktuellen Tour-Schritt.
  expectedPath: string,
  // Das Signal stoppt die Prüfung beim Unmount.
  signal: AbortSignal,
  // Der Getter liest immer den neuesten React-Pfad.
  currentPath: () => string,
): Promise<void> {
  // Nach zehn Sekunden gilt die Navigation als fehlgeschlagen.
  const deadline = Date.now() + 10_000;

  // Die Schleife prüft den Pfad bis zum Erfolg oder zur Deadline.
  while (Date.now() <= deadline) {
    // Ein Abbruch beendet die Navigation sofort.
    if (signal.aborted) throw new Error(ABORT_MESSAGE);
    // Normalisierte Pfade verhindern Unterschiede durch zusätzliche Slashes.
    if (normalizeScreenshotPath(currentPath()) === normalizeScreenshotPath(expectedPath)) return;
    // Das kurze Intervall wartet auf den nächsten Router-Render.
    await delay(50, signal);
  }

  // Ein falscher Screen darf nie unter dem erwarteten Namen gespeichert werden.
  throw new Error(`Screenshot route did not become active: ${expectedPath}`);
}

// Diese Funktion führt alle aktiven Einträge deiner TypeScript-Liste aus.
export async function runScreenshotTour(
  // Das Signal steuert den Lebenszyklus des gesamten Laufs.
  signal: AbortSignal,
  // Die Konfiguration stammt aus der temporären shots.json.
  config: ShotsConfig,
  // Die Rezept-ID steht für optional aktivierte dynamische Routen bereit.
  recipeId: string,
  // Der Getter bestätigt den sichtbaren Pfad nach jeder Navigation.
  currentPath: () => string,
): Promise<void> {
  // Auskommentierte Einträge in buildScreenshotTour sind nicht enthalten.
  const tour = buildScreenshotTour(recipeId);
  // Diese Pause lässt Layout, Daten und Animationen fertig werden.
  const settleMs = Math.max(0, config.settleMs ?? 1_600);
  // Dieses Limit greift nur, wenn simctl keine Fertigmeldung liefert.
  const captureTimeoutMs = Math.max(1_000, config.captureTimeoutMs ?? 60_000);

  // Bash erfährt die erwartete Anzahl direkt aus deiner Liste.
  announceExpectedScreenshotCount(tour.length);
  // Starting unterscheidet die Initialisierung von einem Screen-Namen.
  await announce(TOUR_STATUS.STARTING);
  // Sichtbar im Metro-Log, damit "Screens wechseln zu schnell" gezielt über settleMs tunbar ist.
  console.log(`[ScreenshotTour] settleMs=${settleMs} captureTimeoutMs=${captureTimeoutMs}`);

  // Jeder aktive Tour-Schritt wird genau einmal verarbeitet.
  for (const step of tour) {
    // Der Umweg über Home macht Wechsel zwischen Stack-Routen zuverlässig.
    if (step.path !== '/') {
      // Replace hält die automatische Tour aus dem Navigationsverlauf heraus.
      router.replace('/');
      // Die Tour wartet auf das wirklich sichtbare Dashboard.
      await waitForRoute('/', signal, currentPath);
      // Der Zwischenstopp erhält kurz Zeit zum Stabilisieren.
      await delay(Math.min(1_200, settleMs), signal);
    }

    // Das von dir definierte href öffnet den Ziel-Screen.
    router.replace(step.href);
    // Der erwartete Pfad muss vor dem Capture sichtbar sein.
    await waitForRoute(step.path, signal, currentPath);
    // Der Screen erhält seine Beruhigungszeit, optional pro Schritt überschrieben (z. B. Rezepte).
    await delay(step.settleMs ?? settleMs, signal);
    // Der Name gibt Bash die Aufnahme frei.
    await announce(step.name);

    // Erst die Bestätigung von simctl verhindert die Verschiebung um einen Screen.
    await waitForScreenshotCapture(step.name, signal, captureTimeoutMs);
  }

  // Done wird erst nach der letzten vollständig bestätigten PNG-Datei gemeldet.
  await announce(TOUR_STATUS.DONE);
}

// Das Modul-Flag verhindert doppelte Touren durch mehrfache Root-Mounts.
let started = false;

// Diese unsichtbare Komponente verbindet Tour, Session und App-Lebenszyklus.
export function ScreenshotDriver() {
  // Die Session schützt vor Navigation in noch gesperrte App-Routen.
  const { session, isLoading } = useSession();
  // Pathname enthält den aktuell gerenderten Expo-Router-Pfad.
  const pathname = usePathname();
  // Die Ref vermeidet einen veralteten Pfad in der asynchronen Tour.
  const pathnameRef = useRef(pathname);
  // Jeder Render aktualisiert den von der Tour gelesenen Pfad.
  pathnameRef.current = pathname;

  // Der Effekt startet erst nach Abschluss des Session-Ladens.
  useEffect(() => {
    // Ohne Benutzer oder bei bereits gestarteter Tour bleibt der Driver inaktiv.
    if (started || isLoading || !session?.user.id) return;
    // Das Flag wird vor der ersten asynchronen Operation gesetzt.
    started = true;
    // Der Controller beendet offene Wartephasen beim Unmount.
    const controller = new AbortController();

    // Die IIFE hält den React-Effekt selbst synchron.
    void (async () => {
      // Nur die vom Bash-Skript abgelegte Flag-Datei aktiviert die Tour.
      const config = await loadShotsFlag();
      // Im normalen App-Betrieb bleibt die Komponente ein No-op.
      if (!config?.enabled) return;

      // Vor der ersten Route wartet fam auf vollständige lokale Demo-Daten.
      const fixture = await waitForScreenshotFixture(controller.signal, {
        // Das optionale Fixture-Limit kommt aus der validierten Flag-Datei.
        timeoutMs: config.fixtureTimeoutMs,
      });
      // Die Tour erhält die Demo-ID und immer den neuesten sichtbaren Pfad.
      await runScreenshotTour(
        controller.signal,
        config,
        fixture.recipeId,
        () => pathnameRef.current,
      );
      // Kontrollierte Abbrüche bleiben still, echte Fehler werden an Bash gemeldet.
    })().catch(async (error: unknown) => {
      // Ein Unmount ist kein technischer Capture-Fehler.
      if (error instanceof Error && error.message === ABORT_MESSAGE) return;
      // Die Konsole enthält die technische Ursache für die Diagnose.
      console.error('[ScreenshotTour] fehlgeschlagen:', error);
      // Bash kann durch Error sofort abbrechen und das Staging verwerfen.
      await announce(TOUR_STATUS.ERROR);
    });

    // Der Cleanup beendet Timer, Fixture-Warten und Capture-Warten.
    return () => controller.abort();
    // Nur Session-Ladezustand und Benutzer-ID beeinflussen den Startzeitpunkt.
  }, [isLoading, session?.user.id]);

  // Der Driver rendert keine sichtbare Oberfläche.
  return null;
}
