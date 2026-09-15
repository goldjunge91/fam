# Implementierungsplan: Maestro E2E-Journeys mit atomaren Subflows

## Ziel

Die iOS-Maestro-Suite folgt dem offiziellen Modell „Design your test
architecture“:

- Ausführbare Dateien unter `flows/` beschreiben vollständige User-Journeys.
- Wiederverwendbare Dateien unter `subflows/` erledigen jeweils genau eine
  atomare Aufgabe.
- JavaScript-Helfer für Testdaten und lokale Mailzustellung liegen unter
  `.maestro/scripts/`.
- `package.json` erhält keine Maestro- oder E2E-Aufrufe.
- Android wird erst nach dem grünen iOS-Kern-Checkpoint umgesetzt.

Die vier verbindlichen iOS-Journeys sind:

1. Onboarding → Registrierung → E-Mail-Bestätigung → Dashboard
2. Onboarding → erfolgreicher Login → Dashboard
3. Onboarding → falsches Passwort → falsche E-Mail → Passwort vergessen →
   erfolgreicher Login → Dashboard
4. Onboarding → Login → Dashboard → Abmelden → Kaltstart → Sign-in-Screen

## Architektur

### Journey-Flows

Journey-Flows liegen unter `.maestro/ios/flows/`. Jeder Flow ist einzeln aus
einem definierten Reset-Zustand ausführbar, zeigt die fachliche Reihenfolge
direkt und endet mit einer aussagekräftigen Assertion.

```text
.maestro/ios/flows/
├── auth/
│   ├── onboarding-registration-successful.yaml
│   ├── onboarding-login-successful.yaml
│   └── onboarding-invalid-credentials-forgot-password-login-successful.yaml
└── session/
    └── sign-out-and-relaunch.yaml
```

### Atomare Subflows

Subflows liegen unter `.maestro/ios/subflows/` und werden nicht als
Standalone-Tests entdeckt. Jeder Subflow besitzt genau eine Verantwortung:

- `launch-local-dev-client.yaml`: State zurücksetzen und den lokalen Metro-
  Dev-Client über `fam://expo-development-client/?url=...` öffnen
- `onboarding-welcome.yaml`: Welcome-Carousel bis zum Account-Schritt
- `onboarding-sign-in.yaml`: parametrisierten bestehenden Account im
  Onboarding anmelden
- `onboarding-sign-in-invalid.yaml`: genau einen fehlgeschlagenen Loginversuch
  ausführen und die sichere Fehlermeldung bestätigen
- `onboarding-sign-up.yaml`: Account über die echte UI registrieren und lokal
  per OTP bestätigen
- `onboarding-finish.yaml`: optionale Onboarding-Schritte bis zum Dashboard
- `sign-out.yaml`: aus dem Dashboard abmelden
- `relaunch-to-sign-in.yaml`: ohne State-Clear kalt starten und Sign-in prüfen
- `launch-signed-in-dashboard.yaml`: bewusst persistente Session für gezielte
  Domain-Flows öffnen

Der alte Gesamt-Subflow `reach-dashboard-via-sign-in.yaml` wird entfernt. Der
alte kombinierte `sign-out-and-relaunch.yaml`-Subflow wird in `sign-out.yaml`
und `relaunch-to-sign-in.yaml` aufgeteilt.

### JavaScript-Helfer

`runScript` bleibt auf Testdaten und lokale Backend-Interaktion beschränkt.
UI-Schritte bleiben deklaratives YAML. Die bisherigen Runner und Fixture-
Skripte werden nicht nach `scripts/` zurückverschoben und nicht in
`package.json` eingetragen.

```text
.maestro/scripts/
├── maestro.ts
├── android.ts
├── e2e-household-create.ts
├── e2e-household-join.ts
├── auth/
│   ├── generate-registration-data.js
│   └── read-local-confirmation-code.js
└── lib/
    ├── run-maestro.ts
    └── e2e-fixtures.ts
```

## Verbindliche Journeys

### 1. Registrierung erfolgreich

Datei: `.maestro/ios/flows/auth/onboarding-registration-successful.yaml`

```yaml
- runFlow: ../../subflows/launch-local-dev-client.yaml
- runFlow: ../../subflows/onboarding-welcome.yaml
- runFlow: ../../subflows/onboarding-sign-up.yaml
- runFlow: ../../subflows/onboarding-finish.yaml
- assertVisible: "^(Übersicht|Overview)$"
```

Der Registrierungs-Subflow erzeugt eindeutige Credentials, registriert über die
UI, liest den sechsstelligen Code aus dem lokalen Inbucket und bestätigt ihn in
`email-verification-code`. Der Flow endet nicht bei „Bestätigung ausstehend“.

### 2. Login erfolgreich

Datei: `.maestro/ios/flows/auth/onboarding-login-successful.yaml`

```yaml
- runFlow: ../../subflows/launch-local-dev-client.yaml
- runFlow: ../../subflows/onboarding-welcome.yaml
- runFlow:
    file: ../../subflows/onboarding-sign-in.yaml
    env:
      TEST_EMAIL: externer Wert
      TEST_PASSWORD: externer Wert
- runFlow: ../../subflows/onboarding-finish.yaml
- assertVisible: "^(Übersicht|Overview)$"
```

`TEST_EMAIL` und `TEST_PASSWORD` kommen aus der Laufzeitumgebung. Der Account
muss lokal bereits bestätigt sein.

### 3. Credential- und Recovery-Journey

Datei:
`.maestro/ios/flows/auth/onboarding-invalid-credentials-forgot-password-login-successful.yaml`

Der Journey-Flow zeigt direkt:

1. Setup und Welcome
2. falsches Passwort mit gültiger E-Mail und sichere Fehlermeldung
3. falsche E-Mail mit falschem Passwort und sichere Fehlermeldung
4. Passwort-vergessen öffnen, E-Mail eingeben und Reset-Link anfordern
5. „E-Mail unterwegs“ bestätigen
6. zum Onboarding-Login zurückkehren
7. parametrisierten erfolgreichen Login-Subflow ausführen
8. Onboarding abschließen und Dashboard bestätigen

Der aktuelle Produktflow ändert das Passwort nicht in diesem Screen. Dieser
Journey prüft deshalb bewusst die Reset-Anforderung und den anschließenden
Login mit dem unveränderten gültigen Passwort. Ein echter Deep-Link-
Passwortwechsel ist ein separater Scope.

### 4. Sign-out-and-relaunch

Datei: `.maestro/ios/flows/session/sign-out-and-relaunch.yaml`

```yaml
- runFlow: ../../subflows/launch-local-dev-client.yaml
- runFlow: ../../subflows/onboarding-welcome.yaml
- runFlow:
    file: ../../subflows/onboarding-sign-in.yaml
    env:
      TEST_EMAIL: externer Wert
      TEST_PASSWORD: externer Wert
- runFlow: ../../subflows/onboarding-finish.yaml
- assertVisible: "^(Übersicht|Overview)$"
- runFlow: ../../subflows/sign-out.yaml
- runFlow: ../../subflows/relaunch-to-sign-in.yaml
```

Nur der zweite Start nutzt keinen State-Clear. Der Flow bleibt trotzdem
einzeln ausführbar, weil er seine Session selbst aufbaut.

## Parameter und Startvertrag

Gemeinsame Werte werden per `env` und `runFlow.env` weitergereicht:

- `TEST_EMAIL`: bestätigter Login-Testaccount
- `TEST_PASSWORD`: Passwort des bestätigten Login-Testaccounts
- `WRONG_EMAIL`: nicht registrierte E-Mail
- `WRONG_PASSWORD`: absichtlich falsches Passwort
- `METRO_MANIFEST_URL`: URL-encodierter Metro-Endpunkt, standardmäßig
  `http%3A%2F%2F127.0.0.1%3A8081`
- `HOUSEHOLD_NAME`, `INVITE_TOKEN`: Fixture-Flows
- `INGREDIENT_NAME`: gezielte Domain-Flows

Der native Start bleibt:

```yaml
- openLink:
    link: "fam://expo-development-client/?url=${METRO_MANIFEST_URL}"
```

Dieser lokale Workflow setzt einen laufenden Metro-Server auf dem iOS-
Simulator voraus. Expo Go sowie `exp://` werden nicht verwendet.

## Registrierung und lokale E-Mail-Bestätigung

`supabase/config.toml` verwendet `auth.email.enable_confirmations = true`. Eine
UI-Registrierung liefert daher zunächst keine Session und zeigt
„Bestätigung ausstehend“.

Vor der vollständigen Registrierungs-Journey wird ein POC-Gate erfüllt:

1. eindeutige Adresse erzeugen
2. echte UI-Registrierung ausführen
3. lokale Inbucket-HTTP-API unter Port `54324` abfragen
4. den OTP-Code robust aus der Bestätigungsmail extrahieren
5. Code in `email-verification-code` eingeben
6. Session und Dashboard bestätigen

Wenn Inbucket nicht erreichbar ist, wird der Flow als blockiert behandelt.
`enable_confirmations` wird nicht global abgeschaltet und kein Remote-Projekt
verwendet.

## Aufgaben und Reihenfolge

Die Aufgaben werden im Beads-Epic `fam-uqat` verfolgt.

### Phase 1: iOS-Kern

- [ ] `fam-uqat.10`: Inbucket-Endpunkt, Code-Extraktion und lokaler
  Registrierungs-POC
- [ ] `fam-uqat.4`: atomare iOS-Subflows und positive Journey-Grundlage
- [ ] `fam-uqat.11`: kombinierter Credential-/Recovery-Flow
- [ ] `fam-uqat.12`: Sign-out-and-relaunch-Flow

Checkpoint vor Android:

- [ ] Registrierung endet nach echter Bestätigung im Dashboard
- [x] Erfolgreicher Login endet im Dashboard
- [ ] Recovery-Journey läuft vollständig bis zum Dashboard
- [ ] Sign-out-and-relaunch erreicht den Sign-in-Screen
- [ ] kein Gesamt-Journey-Subflow bleibt übrig
- [ ] `package.json` enthält keine Maestro-Aufrufe
- [ ] Marco bestätigt den iOS-Kern-Checkpoint

### Phase 2: iOS-Domain-Flows

- [ ] `fam-uqat.5`: bestehende iOS-Haushalt-, Shopping-, Inventory-, Recipe-
  und Meal-Planner-Flows auf atomare Start-Subflows umstellen
- [ ] `reach-dashboard-via-sign-in.yaml` entfernen
- [ ] Fixture-Runner unter `.maestro/scripts/` beibehalten und dokumentieren

### Phase 3: Android

- [ ] `fam-uqat.8`: iOS-Struktur nach grünem iOS-Checkpoint spiegeln
- [ ] Bundle-ID `com.goldjunge91.fam` und Android-Tastaturdialoge prüfen
- [ ] Android-Journeys jeweils aus eigenem Reset-Zustand ausführen

### Phase 4: Runner und Dokumentation

- [ ] `fam-uqat.2` und `fam-uqat.3`: direkte `.maestro/scripts/`-Aufrufe,
  Parameter, Tags, Metro-Voraussetzungen und iOS-first-Reihenfolge
  dokumentieren
- [ ] README und Developer Guide auf Journey-/Subflow-Pfade aktualisieren
- [ ] veraltete Pfadreferenzen entfernen

## Aktueller Abnahme-Stand (2026-09-16)

Die Zielstruktur ist umgesetzt und statisch geprüft:

- iOS- und Android-Journeys verwenden atomare Subflows; der alte
  `reach-dashboard-via-sign-in`-Subflow ist entfernt.
- Die alten iOS-Gesamt-Subflows für Sign-out und Dashboard-Aufbau sind entfernt.
- Runner, Fixture-Helfer und Auth-Skripte liegen unter `.maestro/scripts/`;
  `package.json` enthält keine Maestro- oder E2E-Einstiege.
- `README.md`, der Developer Guide und die Unistyles-Testdokumentation nennen
  die neuen Pfade und den ausschließlichen `fam://`-Dev-Client-Start.
- Maestro-Syntax aller Flow-Dateien, Typecheck, Biome und die fokussierten
  Navigationstests sind erfolgreich.

Die Runtime-Gates bleiben offen, bis die Geräte wieder erreichbar sind:

- Der iOS-Simulator wird von Maestro gelistet, liefert aber weiterhin
  `Device became unreachable during viewHierarchy`; deshalb sind nach dem
  letzten Simulator-Absturz keine neuen iOS-Journey-Abnahmen möglich.
- Die Registrierung benötigt zusätzlich eine laufende lokale Inbucket-/Supabase-
  Zustellung auf Port `54324`.
- Android wurde strukturell vorbereitet, aber entsprechend der iOS-first-Regel
  noch nicht auf einem Android-Gerät ausgeführt.

## Inkrementelle Umsetzung

Jede Scheibe folgt demselben Zyklus:

1. genau einen atomaren Subflow oder Journey-Teil implementieren
2. `maestro check-syntax` für die geänderten YAML-Dateien ausführen
3. den betroffenen iOS-Flow auf dem bekannten Simulator ausführen
4. die Accessibility-Hierarchie und das Journey-Ende prüfen
5. erst danach den nächsten Teil ergänzen

Die Reihenfolge ist bewusst iOS-first. Android wird nicht parallel begonnen,
weil Dialog-, Tastatur- und Deep-Link-Abweichungen sonst Fehler vervielfachen.

## Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
| --- | --- |
| Subflow enthält wieder eine komplette Journey | Single-Responsibility und sichtbare Komposition im Parent prüfen |
| Lokale OTP-Mail ist nicht erreichbar | Inbucket-POC als Gate; Auth-Vertrag nicht abschwächen |
| Welcome-Animation verschluckt Folgeklicks | `waitForAnimationToEnd` zwischen den Carousel-Schritten |
| Falsche Credentials lassen das Formular hängen | Felder über Test-IDs leeren und Fehler direkt assertieren |
| Reset-Anforderung wird mit Passwortwechsel verwechselt | Scope im Flow und in der Doku explizit markieren |
| Domain-Flow hängt an persistentem Zustand | Setup-Komposition oder bewusst benannter Session-Subflow |
| Android beginnt zu früh | Android bleibt hinter dem iOS-Checkpoint |
| Falscher Metro-Link | ausschließlich `fam://expo-development-client/?url=...` für den lokalen iOS-Simulator verwenden |

## Definition of Done

- [ ] Vier iOS-Journey-Flows sind vollständig, einzeln ausführbar und grün.
- [ ] Gemeinsame Schritte sind atomare Subflows mit klarer Verantwortung.
- [ ] Registrierung endet nach echter Bestätigung im Dashboard.
- [ ] Recovery prüft beide Credential-Fehler, Reset-Anforderung und Login.
- [ ] Sign-out-and-relaunch prüft Logout und eigenständigen Kaltstart.
- [ ] iOS-Domain-Flows verwenden keine versteckte Gesamt-Journey.
- [ ] Android wird erst nach iOS abgenommen.
- [ ] `package.json` enthält keine Maestro- oder E2E-Aufrufe.
- [ ] Keine alten Gesamt-Subflow-Pfade bleiben zurück.
- [ ] Geänderte YAML-Dateien sind syntaktisch gültig und fokussiert getestet.

## Quellen

- [Design your test architecture](https://docs.maestro.dev/maestro-flows/workspace-management/design-your-test-architecture)
- [Nested flows](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/nested-flows)
- [runFlow](https://docs.maestro.dev/api-reference/commands/runflow)
- [runScript](https://docs.maestro.dev/api-reference/commands/runscript)
- [HTTP requests](https://docs.maestro.dev/maestro-flows/javascript/make-http-requests)
- [Maestro best practices](https://maestro.dev/blog/maestro-best-practices-structuring-your-test-suite)
