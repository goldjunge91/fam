# Implementierungsplan: Maestro E2E-Journeys mit atomaren Subflows

## Überblick

Die Maestro-Suite wird nach dem offiziellen Modell „Design your test
architecture“ strukturiert: ausführbare Flows beschreiben vollständige User
Journeys, wiederverwendbare Subflows kapseln jeweils genau eine atomare
Aufgabe.

Die bisherige Struktur war falsch geschnitten. reach-dashboard-via-sign-in
war kein atomarer Subflow, sondern eine komplette versteckte Journey. Dieser
Gesamt-Subflow wird durch kleinere, klar benannte Subflows ersetzt. Die
Subflow-Architektur bleibt ausdrücklich erhalten.

Die vier verbindlichen iOS-Journeys sind:

1. Onboarding → Registrierung → Dashboard
2. Onboarding → erfolgreicher Login → Dashboard
3. Onboarding → falsches Passwort → falsche E-Mail → Passwort vergessen →
   erfolgreicher Login → Dashboard
4. Onboarding → Login → Dashboard → Abmelden → Kaltstart → Sign-in-Screen

iOS wird zuerst vollständig abgenommen. Android wird erst danach mit derselben
Architektur umgesetzt.

Dieser Plan ersetzt die vorherige Planung „ohne Subflows“. Die Beads-Aufgaben
bleiben der verbindliche Tracker; es gibt keine zusätzliche tasks/todo.md.

## Architektur nach Maestro-Prinzipien

### Journey-Flows

Journey-Flows liegen unter flows/ und werden von Maestro entdeckt. Sie sind die
sichtbaren Testfälle und beantworten jeweils eine konkrete User-Intention. Jeder
Journey-Flow ist vom Reset-Zustand aus ausführbar, enthält die komplette
fachliche Reihenfolge und endet mit einer aussagekräftigen Assertion.

Die Journey-Datei zeigt ihre komplette Komposition direkt. Sie darf atomare
Subflows aufrufen, versteckt aber keine vollständige Journey in einem einzigen
Subflow.

### Atomare Subflows

Subflows liegen getrennt unter subflows/ und werden nicht als Standalone-Tests
entdeckt. Jeder Subflow besitzt genau eine Verantwortung:

- launch-local-dev-client.yaml: Zustand zurücksetzen und Metro über den nativen
  Development Client öffnen
- onboarding-welcome.yaml: Welcome-Carousel bis zum Account-Schritt
- onboarding-sign-in.yaml: einen parametrisierten Login im Onboarding
  erfolgreich abschließen
- onboarding-sign-up.yaml: einen parametrisierten Registrierungsaccount
  erstellen und lokal bestätigen
- onboarding-finish.yaml: die optionalen Onboarding-Schritte bis zum Dashboard
- sign-out.yaml: aus dem Dashboard abmelden
- relaunch-to-sign-in.yaml: ohne State-Clear kalt starten und den Sign-in-Screen
  bestätigen
- launch-signed-in-dashboard.yaml: einen bewusst persistenten lokalen
  Loginzustand für gezielte Domain-Tests öffnen

Der bisherige reach-dashboard-via-sign-in.yaml wird entfernt, weil er Launch,
Welcome, Login und den gesamten Onboarding-Abschluss vermischt. Der bisherige
kombinierte sign-out-and-relaunch.yaml-Subflow wird in sign-out.yaml und
relaunch-to-sign-in.yaml zerlegt.

### JavaScript-Datenhelfer

runScript bleibt für Testdaten und lokale Backend-Interaktion erlaubt. Diese
Dateien sind keine Subflows und keine Journey-Runner. Sie liegen unter
.maestro/scripts/ und werden nicht über package.json gestartet.

Geeignete Aufgaben sind:

- eindeutige Registrierungsdaten erzeugen
- lokalen Inbucket-Code aus Port 54324 lesen
- Fixture-Daten für Haushalt-Tests vorbereiten

Die UI-Schritte bleiben in YAML und werden nicht durch API-Aufrufe ersetzt.

## Verbindliche Flow-Namen und Journeys

### Flow 1: Registrierung erfolgreich

Datei:
.maestro/ios/flows/auth/onboarding-registration-successful.yaml

Komposition:

```yaml
- runFlow: ../../subflows/launch-local-dev-client.yaml
- runFlow: ../../subflows/onboarding-welcome.yaml
- runFlow: ../../subflows/onboarding-sign-up.yaml
- runFlow: ../../subflows/onboarding-finish.yaml
- assertVisible: "^(Übersicht|Overview)$"
```
