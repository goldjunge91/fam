# Passwort-Reset: Implementierungs- und Nachweisbericht

Stand: 29. Oktober 2026

## Aktueller Status

Der Code für die vorzeitige Navigation, zwei zusätzlich während der Simulatorprüfung gefundene Expo-Router-Races und die verbleibende App-Entry-Readiness-Lücke ist umgesetzt. Die fokussierten automatisierten Prüfungen sind grün.

Die Geräteabnahme ist nach der letzten Readiness-Änderung noch offen. Erforderlich sind drei neue, vollständig aufgezeichnete Läufe mit drei frischen Recovery-Links. `fam-fc36` bleibt deshalb `in_progress` und darf noch nicht geschlossen werden.

## Ausgangsfehler

Ein aus abgemeldetem Zustand gestarteter Passwort-Reset übertrug die Recovery-Session erfolgreich in den primären Supabase-Client. Die Recovery-Route navigierte anschließend jedoch zu früh zu `/`. Während der lokale Account und später Profil, Haushalte und initialer Haushaltssync noch vorbereitet wurden, konnte kurz `Etwas ist schiefgelaufen` erscheinen.

## Umgesetzte Änderungen

### 1. Identitätsgenaues Warten nach erfolgreichem Reset

`src/features/auth/components/recovery-password-form.tsx`

- Sichert `recoveryUserId` vor `savePassword`, weil der Store die ID beim erfolgreichen Abschluss löscht.
- Verzögert nur den Abschluss `ok/signed-in`.
- Prüft weiterhin die exakte wiederhergestellte Nutzer-ID.
- Bewahrt die sofortige Navigation für `existing-session`.
- Bewahrt `sign-in-required`, Transferunsicherheit, fehlende Recovery-Identität, Validierungs- und Updatefehler sowie den manuellen Weiter-Pfad.
- Löscht den ausstehenden Navigationszustand vor `router.replace('/')`.

### 2. Globalen Expo-Router-Race beseitigt

`src/features/auth/screens/password-recovery-screen.tsx`

Die Simulatorprüfung reproduzierte:

```text
Attempted to navigate before mounting the Root Layout component
```

Ursache war `router.setParams` während eines Deep-Link-/Navigator-Reconnects, bevor der globale Expo-Router-Ref bereit war.

Änderung:

- Recovery-Parameter werden über das lokale Navigation-Objekt der gemounteten Route mit `useNavigation().setParams` entfernt.
- Der globale Router wird für diese Parameterbereinigung nicht mehr verwendet.

### 3. Wiederholten Recovery-Effect beseitigt

Nach dem lokalen `setParams` zeigte die Simulatorprüfung einen zweiten Fehler:

```text
Maximum update depth exceeded
```

Eine inaktive Recovery-Route konnte mit ihren ursprünglichen lokalen Parametern erneut verbunden werden. Dadurch wurde derselbe Link mehrfach verarbeitet.

Änderung:

- Die Kombination aus `token_hash` und `type` wird pro gemounteter Route als bereits bearbeiteter Schlüssel gespeichert.
- Derselbe Parametersatz wird nur einmal verarbeitet.
- Ein anderer frischer Link bleibt weiterhin verarbeitbar.

### 4. Vollständige App-Entry-Readiness geteilt

Der erste formal aufgezeichnete Simulatorlauf nach den beiden Router-Fixes zeigte keinen Fehlerbildschirm, aber noch etwa 1,4 Sekunden `Start wird vorbereitet` zwischen Speichern und Übersicht. `SessionProvider.accountReady` war früher erfüllt als die eigentliche App-Entry-Entscheidung.

Neu angelegt:

- `src/features/onboarding/app-entry-readiness.tsx`

Der `AppEntryReadinessProvider` besitzt jetzt gemeinsam:

- Profilabfrage
- lokale Haushaltsabfrage
- initialen Haushaltssync
- `resolveAppEntry`
- Retry der betroffenen Queries
- identitätsgebundene Readiness für den aktuell vorbereiteten Nutzer

Integration:

- `src/features/app-shell/app-providers.tsx`
- `src/features/app-shell/app-providers.android.tsx`
- `src/app/(app)/_layout.tsx`

Die App-Layout-Route konsumiert dieselbe Entscheidung, die auch den Recovery-Abschluss freigibt. Dadurch wird keine zweite, abweichende Ready-Berechnung in der Recovery-Komponente gepflegt.

### 5. Navigation genau einmal

`RecoveryPasswordForm` verwendet nun einen gemeinsamen, ref-geschützten Navigationspfad für:

- automatische Navigation nach vollständiger Readiness
- manuelles Weiter
- unmittelbaren `existing-session`-Abschluss

Damit kann ein gleichzeitiges manuelles Weiter und ein Readiness-Update nicht zwei Root-Navigationen auslösen.

## Betroffene Dateien

- `src/features/auth/components/recovery-password-form.tsx`
- `src/features/auth/screens/password-recovery-screen.tsx`
- `src/features/auth/screens/password-recovery-screen.test.tsx`
- `src/features/onboarding/app-entry-readiness.tsx` neu
- `src/app/(app)/_layout.tsx`
- `src/features/app-shell/app-providers.tsx`
- `src/features/app-shell/app-providers.android.tsx`
- `src/features/app-shell/app-providers.test.tsx`
- `src/features/navigation/app-layout-startup.test.tsx`

Andere Änderungen im gemeinsam genutzten Arbeitsbaum wurden nicht bearbeitet.

## Testgetriebene Nachweise

### Ursprüngliches Readiness-Gate

- Bug-Condition-Matrix: elf nicht bereite Providerzustände hielten die Erfolgsansicht ohne automatische Navigation.
- Erster passender Ready-Zustand navigierte genau einmal zu `/`.
- Erneuter Render navigierte kein zweites Mal.
- Preservation-Prüfung für `existing-session`, `sign-in-required`, Transferunsicherheit, fehlende Recovery-ID, Validierung, Updatefehler, SessionProvider und RootNavigator.
- Zwischenstand: 4 Suites, 63 Tests grün.

### Globaler Router-Race

RED:

- 1 fehlgeschlagener, 22 bestandene Tests.
- Fehler direkt am Produktionsaufruf `router.setParams` bei absichtlich nicht bereitem globalem Router.

GREEN:

- 1 Suite, 23 Tests grün.

### Reconnect-/Update-Depth-Race

RED:

- Der Test beobachtete vier lokale `setParams`-Aufrufe für denselben Link statt genau eines.

GREEN:

- 1 Suite, 23 Tests grün.
- Derselbe Link wird nach einem Rerender nicht erneut verifiziert.

### Vollständige App-Entry-Readiness

RED, `test_logs/test_1355_29-10-26.log`:

- 1 fehlgeschlagener, 23 bestandene Tests, 24 gesamt.
- Die Erfolgsansicht war sichtbar, `router.replace('/')` wurde aber trotz noch nicht bereitem App Entry bereits einmal aufgerufen.

GREEN, `test_logs/test_1359_29-10-26.log`:

```text
Test Suites: 5 passed, 5 total
Tests:       59 passed, 59 total
Snapshots:   0 total
```

Geprüfte Dateien:

- `src/features/auth/screens/password-recovery-screen.test.tsx`
- `src/features/navigation/app-layout-startup.test.tsx`
- `src/features/app-shell/app-providers.test.tsx`
- `src/features/app-shell/account-provider-gate.test.tsx`
- `src/features/onboarding/domain/app-entry.test.ts`

Weitere Prüfungen:

- Biome auf allen neun betroffenen Implementierungs- und Testdateien: grün.
- IDE-Diagnostik auf allen neun Dateien: keine Befunde.
- Pfadbezogenes `git diff --check`: grün.
- Projektweiter Typecheck: Die Auth-/Readiness-Dateien sind fehlerfrei. Offen bleibt ausschließlich ein parallel entstandener Readonly-Array-Fehler in `src/features/brochures/components/brochure-filter-sheet.test.tsx`; dieser wurde nicht verändert.

## Simulator- und Agent-Device-Arbeit

Verwendete Umgebung:

- Device Hub iPhone 12 mini
- iOS 26.2
- Laufzeit-Clone `0EA1E894-BD5C-4F8E-A9BC-8813B16CF2ED`
- App `fam v0.0.6 (1)`
- Bundle `com.goldjunge91.fam1`
- bereits laufender Metro-Server

Durchgeführt:

- Agent-device mit der bestehenden `default`-Session verbunden.
- Installierte App gefunden und mit dem bereits laufenden Metro-Server verbunden.
- Metro, Device Hub, Simulator und Builds weder gestartet noch gestoppt.
- Reset-Formular, Speichern, Zielansicht und Menüinteraktion automatisiert geprüft.
- Automatisierte `simctl recordVideo`-Ausgabe scheiterte an Schreibrechten des Device-Hub-Prozesses auf dem externen Volume.
- Ein macOS-Fenstermitschnitt wurde als Nachweis verworfen, weil Device Hub den Vordergrund verlor und fremde Desktop-Inhalte sichtbar wurden.
- Danach wurde ausschließlich der Device-Hub-eigene Recorder verwendet.

## Bisherige Lauf-Evidenz

Repository-lokale Kopie:

- `build/tmp/password-reset-device-evidence/run-1-device-hub.mp4`
- Dauer: 75,606667 Sekunden
- Größe: 2.877.347 Bytes

Dieser Lauf gehört zur vorherigen Readiness-Version und ist nach der letzten Implementierungsänderung nicht mehr als finale Abnahme gültig.

Beobachtungen:

- Kein Frame zeigte `Etwas ist schiefgelaufen`.
- Das wiederhergestellte Konto erreichte die Übersicht.
- Das Navigationsmenü war bedienbar.
- Die Aufnahme zeigte noch den `Start wird vorbereitet`-Loader statt einer durchgehenden Erfolgsansicht.
- Dieser Befund führte zum neuen gemeinsamen App-Entry-Readiness-Provider.

Es wurden keine Recovery-Links, Token, Passwörter oder Sessionwerte in Bead-Notizen oder diesem Bericht gespeichert.

## Reviews und Skill-Prüfung

- `expo-overview` wurde als Expo-Einstieg verwendet.
- `using-agent-skills` bestätigte den Ablauf Debugging, TDD, Review und Verifikation.
- `expo-skill-eval` wurde geprüft und bewusst nicht ausgeführt. Es bewertet Expo-Skills in separaten Fixture-Apps und ist kein E2E-Prüfer für diese bestehende App. Seine Standardpfade außerhalb `/Volumes/Programme` widersprechen außerdem der Dateisystemgrenze dieses Repositories.
- Ein erster Luna-Max-Start scheiterte ausschließlich an einer ungültigen Modell-ID.
- Der korrigierte unabhängige Review lief mit GPT 5.6 Luna und Max-Effort und endete mit `APPROVED`, ohne blockierende Befunde.
- Optionale Reviewhinweise betrafen einen weiteren frischen Tokenfall, eine manuell/automatische Navigationskombination und eine frühere exakte Passwortargument-Assertion. Der Doppel-Navigationsfall wurde im späteren Readiness-Schritt abgedeckt.
- Die abschließende Readiness-Implementierung wurde von einem GPT-5.6-Luna-Subagenten mit Max-Effort ausgeführt und anschließend lokal gegen Diff, Tests, Diagnostik und Architektur geprüft.

## Nicht durchgeführt

- Kein neuer nativer Build.
- Kein Start oder Stop von Metro oder Device Hub.
- Keine Datenbank- oder Schemaänderung.
- Keine neue Abhängigkeit.
- Kein Branchwechsel, Rebase, Reset, Checkout oder Stash.
- Kein Commit und kein Push.
- `fam-fc36` wurde nicht geschlossen.

## Offene Abschlusskriterien

1. Drei neue, getrennte Device-Hub-Läufe mit drei frischen, unbenutzten Recovery-Links auf der finalen Implementierung.
2. Pro Lauf durchgehende Aufnahme vom Speichern bis zur vollständig geladenen, bedienbaren Zielansicht.
3. Pro Lauf sichtbar bestätigen:
   - Erfolgsansicht bleibt bis zur Zielbereitschaft stehen.
   - Kein Frame zeigt `Etwas ist schiefgelaufen`.
   - Kein Frame zeigt `Start wird vorbereitet`.
   - Das richtige wiederhergestellte Konto ist aktiv.
   - Übersicht und mindestens eine Interaktion funktionieren.
4. Bereinigte Evidenz mit `bd update fam-fc36 --append-notes="..."` ergänzen.
5. `fam-fc36` erst nach allen drei erfolgreichen Läufen schließen.

## Verwendete Expo-Dokumentation

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Expo Router SDK 57 API](https://docs.expo.dev/versions/v57.0.0/sdk/router/)
- [Expo Router URL-Parameter](https://docs.expo.dev/router/reference/url-parameters/)
- [Expo-Dokumentationsindex für Agents](https://docs.expo.dev/llms.txt)

Die Dokumentationsinhalte wurden zusammengefasst und nicht wörtlich übernommen.
