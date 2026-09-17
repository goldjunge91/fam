# iOS: Logout und Kaltstart öffnen erneut das Welcome-Onboarding

Status: Offen  
Beads: `fam-uqat.12.1`  
Übergeordnete Aufgabe: `fam-uqat.12`  
Entdeckt: 2026-09-16

## Kurzfassung

Nach einem vollständig abgeschlossenen Onboarding mit Dashboard und einem
anschließenden Logout startet die iOS-App bei einem Kaltstart ohne State-Clear
wieder im Welcome-Carousel. Erwartet wird der öffentliche Sign-in-Screen.

Damit verletzt die App den Routing-Vertrag für ein bereits bekanntes Gerät:

```text
vollständiges Onboarding → Dashboard → Logout → Kaltstart ohne State-Clear
  erwartet: Sign-in-Screen mit sign-in-email
  beobachtet: Welcome-Carousel mit „Willkommen“
```

## Reproduktion

Voraussetzungen:

- iOS-Development-Build `com.goldjunge91.fam1`
- laufendes Metro unter `127.0.0.1:8081`
- lokales Supabase
- bestätigter Login-Testaccount
- Maestro auf dem iOS-Simulator

Flow starten:

```bash
MAESTRO_DRIVER_STARTUP_TIMEOUT=180000 \
  bun .maestro/scripts/maestro.ts test \
  --device 2A1E0602-8F28-4C1C-9993-2DAF3E9C76A5 \
  .maestro/ios/flows/session/sign-out-and-relaunch.yaml
```

Der Flow läuft bis zum Logout erfolgreich durch. Beim anschließenden
`launchApp` mit `clearState: false` schlägt die Prüfung auf `sign-in-email` fehl.
Die Maestro-Hierarchie zeigt stattdessen den ersten Welcome-Schritt.

Beispielartefakt:

```text
/Users/marco/.maestro/tests/2026-09-16_202841
```

Maestro-Fehler:

```text
Assertion is false: id: sign-in-email is visible
```

## Technische Einordnung

Der erwartete Zustand ist bereits im Code und in den Domain-Tests beschrieben:

- `src/features/onboarding/domain/app-entry.ts` leitet ohne Session bei
  `hasSeenOnboarding === true` nach `/sign-in`.
- `src/features/onboarding/domain/app-entry.test.ts` prüft diesen Fall als
  Routing-Vertrag.
- `src/features/onboarding/onboarding-completion.ts` speichert den globalen
  Marker `fam_onboarding_completed_v1` in SecureStore.
- `src/features/auth/sign-out.ts` löscht Account-spezifische lokale Daten,
  sollte aber den globalen Onboarding-Marker nicht entfernen.

Der Befund ist deshalb eher ein App-Routing- oder Persistenzfehler als ein
Maestro-Selector-Problem. Mögliche Ursachen sind:

1. `persistOnboardingCompleted()` schreibt den SecureStore-Marker nicht
   dauerhaft. Schreibfehler werden aktuell still abgefangen.
2. `hasSeenOnboarding()` liest nach Logout oder Kaltstart nicht mehr den zuvor
   gespeicherten Marker.
3. Der Expo-Router behält nach dem Logout einen Onboarding-Routezustand, obwohl
   der Routing-Guard bereits den öffentlichen Sign-in-Zustand bestimmen könnte.

Die Ursache ist noch nicht abschließend lokalisiert.

## Aktueller Maestro-Workaround

`relaunch-to-sign-in.yaml` wartet derzeit optional auf `Willkommen` und führt
bei dessen Sichtbarkeit den Welcome-Subflow aus. Das ermöglicht die Diagnose
und bringt den Test anschließend zum Sign-in-Screen, ist aber keine Behebung
des App-Fehlers. Nach der Korrektur muss der Workaround entfernt oder auf den
minimal erforderlichen Relaunch-Schritt zurückgeführt werden.

## Behebungskriterien

- Nach abgeschlossenem Onboarding bleibt der Onboarding-Marker über Logout
  und Kaltstart ohne State-Clear erhalten.
- Ein ausgeloggter, bereits bekannter Nutzer landet direkt auf `/sign-in`.
- `sign-in-email` ist nach dem Relaunch sichtbar, ohne Welcome-Schritte im
  Session-Flow.
- SecureStore-Fehler beim Schreiben oder Lesen werden nicht still verschluckt
  und sind gezielt testbar.
- Der Maestro-Flow
  `.maestro/ios/flows/session/sign-out-and-relaunch.yaml` läuft ohne den
  Welcome-Workaround bis zum Sign-in-Assert grün.
- Der iOS-Checkpoint ist grün, bevor Android-Flows ausgeführt werden.

## Abgrenzung

Der Befund betrifft den iOS-Logout-/Kaltstart-Routingpfad. Expo Go, das
`exp://`-Schema, Metro-Bundling und die getrennten Auth-Flows sind nicht die
Ursache dieses konkreten Fehlers.
