# Implementation Plan: Build-Picker korrekt fertigstellen

Status: Plan zur Maintainer-Freigabe
Tasks: Beads (siehe Task List)
Classification: MEDIUM. Niedrigste ausreichende Lane empfohlen.
# Note von Marco
ML Kit muss für Testflight und Production aktiviert sein.
um im Simulator auf Vision zurückfallen.

## Overview

Der Picker bietet 8 iOS-Build-Varianten aus eas.json an. Er ist an drei
Stellen von dem entkoppelt, was tatsaechlich gebaut wird: die Shell-Allowlist
kennt 6 Profile, das lokale IPA wird unter einem Namen erwartet, den eas-cli
nicht vergibt, und der Submit-Weg setzt fuer Cloud-Builds eine EAS-Registrierung
voraus. Alle Befunde sind gegen die echten Build-Logs und das generierte
Xcode-Projekt geprueft, nicht aus dem Quelltext abgeleitet.

## Verifizierte Befunde

| # | Befund | Beleg |
|---|--------|-------|
| 1 | `development-device` und `preview` werden abgewiesen | `scripts/eas-ios-build.sh:39` allowlistet 6 Profile, Picker bietet 8 |
| 2 | Picker erwartet `fam.ipa` | `scripts/build-picker-logic.ts:107` |
| 3 | eas-cli vergibt `build-<timestamp>.ipa` | final8: `build-1790986068689.ipa` |
| 4 | `--output` kam im echten Lauf nie an | final8-Log enthaelt nur `--local` |
| 5 | lokaler Build hat keine EAS-Build-ID | final8-Log: kein `buildId`, kein Tracking |
| 6 | lokale Store-Varianten nutzen `--latest` | `build-picker-logic.ts:131`, braucht Registrierung |

## Versionierung: festgehaltene Grundlage

Zwei getrennte Werte, zwei getrennte Quellen. Beide am 2026-10-03 gegen
`app.json` und die gebaute IPA geprueft.

| Wert | Xcode-Feld | Quelle | Stand |
|------|-----------|--------|-------|
| App-Version | `CFBundleShortVersionString` | `app.json` → `expo.version`, handgepflegt | **0.0.6** |
| Build-Version | `CFBundleVersion` | EAS Remote Store (`appVersionSource: remote`) | **74** |

Belegt in der gebauten IPA
`build/local/eas/preview-testflight-local/build-1790986068689.ipa`:

```
CFBundleShortVersionString => 0.0.6
CFBundleVersion            => 74
```

### Wer besitzt welchen Wert

- **App-Version 0.0.6** ist handgepflegt in `app.json`
  (`app.json:expo.version`). Sie wird pro Release-Zyklus bewusst geaendert und
  ist der Wert, den Nutzer im Store sehen.
- **Build-Version 74** ist der EAS-Remote-Stand. `app.json` enthaelt zwar
  `ios.buildNumber: 2`, dieser Wert wird bei `appVersionSource: remote`
  jedoch ignoriert (Warnung im Build-Log, Zeile 10).

### Was der lokale Build damit tut

Er liest den Remote-Stand und schreibt ihn in die native `Info.plist`:

```
[CONFIGURE_XCODE_PROJECT] Updating versions in .../ios/fam/Info.plist
[CONFIGURE_XCODE_PROJECT] Updating versions in .../ExpoWidgetsTarget/Info.plist
[CONFIGURE_XCODE_PROJECT] Updating versions in .../targets/watch/Info.plist
[CONFIGURE_XCODE_PROJECT] Updating versions in .../targets/siri/Info.plist
```

Alle vier Targets (fam, ExpoWidgetsTarget, watch, siri) bekommen dieselbe
Build-Version. Ein Reservieren der naechsten Nummer wurde in keinem Lauf
geloggt; die Nummer blieb in final6/7/8 konstant bei 74.

### runtimeVersion

`app.json` setzt `runtimeVersion.policy: "appVersion"`. Die Runtime-Version
haengt damit an der App-Version 0.0.6, nicht an der Build-Version. Ein neuer
Build mit gleicher App-Version bleibt also OTA-kompatibel; ein App-Version-
Sprung bricht die OTA-Kompatibilitaet bewusst.

### Grenze der Beobachtung

Alle drei Laeufe final6/7/8 nutzten ein Profil mit `autoIncrement: false`.
Das Verhalten eines **lokalen** Builds mit `autoIncrement: true` ist
**nicht beobachtet** und darf nicht behauptet werden. Damit ist
`production-local` (derzeit `true`, siehe `eas.json:104`) eine offene Frage,
kein belegter Bug.

### Konsequenz fuer TestFlight

Jeder Upload braucht eine im Store noch freie Build-Version. Ob 74 dort
vergeben ist, ist lokal nicht feststellbar und muss vor dem Upload geprueft
werden (`npx eas-cli@latest build:version:list --platform ios`). Das ist
eine Vorpruefung, kein Teil der Picker-Logik.

## Entscheidung: Profil-Matrix (final)

Am 2026-10-03 von Marco verbindlich entschieden. Ersetzt alle vorherigen
Ueberlegungen zu diesem Thema.

### Die Regel

- **Simulator** nutzt Apple Vision (ML Kit baut nicht auf arm64-Simulatoren),
  und Simulator-Builds werden **nicht versioniert**.
- **Echtes Geraet** laeuft ueber TestFlight, nicht ueber ein Dev-Client-Profil.
- **Store und TestFlight** nutzen ML Kit.
- `appVersionSource` bleibt `remote`. Keine Versionsdatei.
  `autoIncrement` bleibt `true`, auch bei den `-local`-Varianten, die auf
  Store oder TestFlight zielen.

### Ziel-Matrix

| Ziel | Profil | Engine | Versionierung | Ort |
|------|--------|--------|---------------|-----|
| Simulator | `development` | Vision | **nein** | Cloud |
| Simulator | `development-local` | Vision | **nein** | lokal |
| TestFlight | `preview-testflight` | ML Kit | `true` | Cloud |
| TestFlight | `preview-testflight-local` | ML Kit | `true` | lokal |
| Store | `production` | ML Kit | `true` | Cloud |
| Store | `production-local` | ML Kit | `true` | lokal |

### Was entfaellt

- **`development-device`** entfaellt. Echtes Geraet laeuft immer ueber
  TestFlight. Nur zwei Stellen verweisen darauf: `eas.json:40` und
  `scripts/build-picker-logic.ts:46`.
- **`preview`** ist zu pruefen: kein Submit-Profil, nie gebaut, nur als
  Android-Emulator-Ziel in `tools/build-gui/build_gui.py:51` referenziert.
  Nicht mit dem EAS-Environment `preview` verwechseln (das braucht
  `preview-testflight`) und nicht mit `.env.preview`.

### Zwei Korrekturen am Ist-Stand

1. **`development` hat `autoIncrement: true`** und muss `false` werden.
   Ein Simulator-Build geht nie in einen Store.
2. **`production` nutzt heute Apple Vision** (`FAM_IOS_MLKIT_OCR` unset),
   waehrend `preview-testflight` ML Kit nutzt. Test und Auslieferung
   divergieren. Ziel ist ML Kit fuer beide.

### Risiko der ML-Kit-Umstellung bei production

`FAM_IOS_MLKIT_OCR=1` schaltet in `app.config.ts:60-75` mehr um als die
Engine: `useFrameworks: 'static'` und
`privacyManifestAggregationEnabled: false`. Ohne die Aggregations-Abschaltung
bricht der Archive-Schritt mit `Multiple commands produce
'...React-timing_privacy.bundle'` ab. Das ist die Fehlerklasse, die die
Builds final6 und final7 zerstört hat. Die Umstellung braucht deshalb einen
eigenen Verifikationslauf, bevor sie im Release-Pfad landet.

### Belegte Nebenwirkung von autoIncrement

`build/ios/build.js:43` in eas-cli 24.10.0 loest die Remote-Buildnummer
immer auf, wenn die Quelle `remote` ist. Damit reserviert auch ein lokaler
`-local`-Build eine Nummer. Das ist fuer die Store- und TestFlight-Varianten
gewollt: sie sollen eindeutige Nummern haben.

## Entscheidung: Picker-Aufbau nach Ziel (final)

Vorgabe von Marco, 2026-10-03. Der Picker fuehrt nach **Ziel**, nicht nach
Profil. Keine Wrapper-Scripte — rohe Befehle, sichtbar und einzeln.

### Die vier Ziele

1. **TestFlight** — Build erstellen und nach TestFlight laden.
2. **App Store** — Build erstellen und zu App Store Connect laden.
3. **Simulator ohne Installation** — Build erstellen, am Ende den
   Speicherort der App ausgeben.
4. **Simulator mit Installation** — Build erstellen, Simulator aus den
   vorhandenen Geraeten auswaehlen, App installieren und starten.

### Simulator-Build: die drei Schritte

```sh
FAM_IOS_MLKIT_OCR=0 bun --env-file=.env.development.local x expo prebuild --clean --platform ios --no-install

pod install --project-directory=ios

xcodebuild -workspace ios/fam.xcworkspace -scheme fam -configuration Debug \
  -destination "platform=iOS Simulator,id=<UDID>" -jobs 10 \
  -derivedDataPath build/cache/ios/<ziel>/DerivedData \
  COMPILER_INDEX_STORE_ENABLE=NO build
```

Reihenfolge: prebuild legt `ios/` an, `pod install` verlinkt die Pods,
`xcodebuild` baut. `--no-install` im prebuild ist gewollt, deshalb der
separate `pod install`.

### Speicherort der App

Der `-derivedDataPath` bestimmt die Ausgabe:

```
<derivedDataPath>/Build/Products/Debug-iphonesimulator/fam.app
```

Bei Ziel 3 ist genau dieser Pfad die Ausgabe am Ende.

### Ziel 4: Simulator-Auswahl

Verfuegbare Geraete als JSON:

```sh
xcrun simctl list devices available -j
```

Installieren und starten auf der gewaehlten UDID:

```sh
xcrun simctl install <UDID> <pfad>/fam.app
xcrun simctl launch <UDID> com.goldjunge91.fam1
```

Auf dieser Maschine verfuegbar: iPhone 17 Pro Max, iPhone 12 mini,
iPhone 11 Pro Max, iPad Pro 11-inch (M5), iPad mini (A17 Pro), iPad (A16),
iPad Air 13-inch (M3), iPad Air 11-inch (M3). Laufzeit ist iOS 26.2;
iOS 27.0 ist als nicht verfuegbar gelistet.

## Entscheidung: Logging und Zeitmessung (final)

Vorgabe von Marco, 2026-10-03: Jeder Picker-Lauf protokolliert sich selbst.
Ohne Log und Zeitmessung ist ein Build-Fehler spaeter nicht mehr belegbar,
weil genau die Ausgabe fehlt, die ihn erklaert.

### Was bereits gilt

| Anforderung | Umsetzung | Nachweis |
|-------------|-----------|---------|
| Logdatei je Lauf | `logs/build-<ziel>-<zeitstempel>.log`, zusaetzlich zum Terminal | `buildLogPath()` |
| Befehl vor Ausfuehrung sichtbar | `p.log.step()` plus `$ <befehl>` in der Logdatei | `runStep()` |
| Dauer je Schritt | `Fertig in 5s` bzw. `Fehlgeschlagen nach 5s (Exit-Code 1).` | `runStep()` |
| Gesamtdauer je Lauf | `Gesamtdauer: 1m 12s` | `main()` |
| Lesbare Dauer | 950ms / 5s / 1m 5s / 2m | `formatDuration()` |
| Rohes stdout und stderr | wird unveraendert in die Logdatei gespiegelt | `runStep()` |

`logs/` ist gitignored (`.gitignore:67`), die Logs sind Betriebsdaten, kein
Quellstand.

### Zwei Defekte, die die Fehler-Logs unbrauchbar machen

Beide sind gegen den Code belegt, nicht gegen eine Vermutung.

1. **Gepufferte Writes gehen bei Fehler verloren.** `logStream` ist ein
   asynchroner `fs.WriteStream`. Bei einem fehlgeschlagenen Schritt ruft der
   Picker `process.exit(1)`. Der Exit verdraengt Write-Requests, die noch im
   Puffer liegen. Genau die letzten Zeilen der Fehlermeldung fehlen im Log.
   Das ist der haeufigste Fall, in dem das Log gebraucht wird.
2. **Die Gesamtdauer fehlt bei genau diesem Fehler.** `Gesamtdauer` steht im
   `finally`-Block von `main()`. `process.exit(1)` in `runStore()` und
   `runSimulator()` beendet den Prozess vorher, der Block laeuft nie.

### Verbindliche Regel

- Jeder Schritt wird mit Ergebnis **und** Dauer protokolliert, Erfolg wie
  Fehlschlag.
- Vor jedem Abbruch wird der Log geschlossen, damit der Inhalt vollstaendig
  auf der Platte liegt.
- Die Gesamtdauer wird auch im Fehlerfall geschrieben.
- Fehlermeldungen nennen die Ursache, nicht nur "Upload fehlgeschlagen".
  Gehoert zu fam-h4kt.

### Zuordnung

Beide Defekte laufen in fam-ae6d. Die Zeitmessung selbst ist bereits belegt
durch `formatDuration()`-Tests in `test/build-picker.test.ts`.

## Architecture Decisions

- **Allowlist aus eas.json ableiten.** Die Profilnamen stehen schon dort;
  eine zweite Liste in der Shell kann nur veralten. `base` ausgenommen.
- **Artefaktnamen nicht vorhersagen.** Entweder `--output` durchreichen
  (dann entsteht `fam.ipa`) oder den echten Namen aus dem Log-Verzeichnis
  aufloesen. Entscheidung faellt in fam-y9bv.
- **Profil-Matrix statt Einzelregeln.** Siehe Entscheidungs-Abschnitt.
  Simulator = Vision ohne Versionierung, Store/TestFlight = ML Kit mit
  Versionierung, Quelle bleibt `remote`.
- **Tote Versionsfelder aus `app.json` entfernen.** `ios.buildNumber: "2"`
  und `android.versionCode: 5` werden bei `remote` ignoriert (Warnung im
  Build-Log) und stiften nur Verwirrung.

## Task List

Reihenfolge folgt der Abhaengigkeitskette. Beads sind die massgebliche Liste.
Der Picker wird nach Ziel aufgebaut (fam-cp90), nicht nach Profil.

### Phase 1: Simulator-Build (rohe Befehle)

- [ ] **fam-cp90** prebuild + pod install + xcodebuild als drei sichtbare Schritte
- [ ] **fam-cp90** Ziel 3: Speicherort der `.app` am Ende ausgeben
- [ ] **fam-cp90** Ziel 4: Simulator aus `simctl list devices available -j` waehlen,
      installieren (`simctl install`) und starten (`simctl launch`)

### Checkpoint: Simulator

- [ ] Ein Simulator-Build laeuft mit `FAM_IOS_MLKIT_OCR=0` durch
- [ ] Ziel 3 nennt einen existierenden `.app`-Pfad
- [ ] Ziel 4 installiert auf der gewaehlten UDID und startet die App

### Phase 2: Store-Ziele

- [ ] **fam-y9bv** Artefaktweg fuer Store-Builds klaeren (`--output` oder aufloesen)
- [ ] **fam-v1fk** lokales IPA zuverlaessig aufloesen
- [ ] **fam-h4kt** Submit-Weg je Ziel belegen (`--path` vs `--latest`)
- [ ] **fam-cp90** Ziel 1: TestFlight-Build und Upload
- [ ] **fam-cp90** Ziel 2: App-Store-Build und Upload

### Checkpoint: Store

- [ ] TestFlight-Upload endet mit einer Buildnummer im Store
- [ ] App-Store-Upload endet mit einem Build in App Store Connect
- [ ] Fehlermeldung nennt die Ursache, nicht nur "Upload fehlgeschlagen"

### Phase 3: Profile aufraeumen

- [ ] **fam-bmq5** `development` auf `autoIncrement: false`
- [ ] **fam-bmq5** `preview-testflight-local` auf `autoIncrement: true`
- [ ] **fam-bmq5** tote Versionsfelder aus `app.json` entfernen
- [ ] **fam-tuaj** `development-device` entfernen
- [ ] **fam-ik1o** `preview` pruefen und entfernen
- [ ] **fam-gije** `production` auf ML Kit
- [ ] **fam-rdm1** Allowlist aus `eas.json` ableiten (entfaellt, wenn die
      Wrapper-Scripte durch rohe Befehle ersetzt sind)

### Checkpoint: Fertig

- [ ] Kein Verweis auf entfernte Profile in scripts/, tools/ oder GUI
- [ ] Jedes Ziel im Picker hat einen belegten Weg
- [ ] Review mit Marco, dann PR

## Risks and Mitigations

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| `--output` lokal nicht unterstuetzt | Mittel | fam-y9bv prueft zuerst; Rueckfall ist Aufloesen aus dem Log |
| ML Kit bei production bricht Archive | Hoch | Eigenes Verifikations-Bead; erst TestFlight-Build gruen, dann production |
| Lokale Store-Builds verbrauchen Nummern | Niedrig | Bewusst akzeptiert; sie sollen eindeutige Nummern haben |
| Submit scheitert an fehlender Registrierung | Mittel | fam-h4kt belegt den Weg je Profil |
| PostHog-dSYM-Timeout blockiert erneut | Niedrig | eigenes Bead fam-j3kv, unabhaengig |

## Open Questions

- Soll `--output` genutzt werden, oder ist Aufloesen aus dem Log ehrlicher?
- Soll der Picker nach einem Cloud-Build die EAS-Build-ID anzeigen?
- Ist `preview` wirklich tot, oder wird der Android-Emulator dort gebraucht?

## Nicht Teil dieses Plans

- **fam-j3kv** PostHog-dSYM-Upload entkoppeln. Ursache der Fehlschlaege 6/7.
- **fam-gw93** Buildnummer-Lifecycle. Beruehrt dasselbe Thema wie fam-bmq5.

## Befund: lokale EAS-Builds brauchen ein Workingdir ausserhalb des Projekts

Am 2026-10-03 belegt. Sieben lokale TestFlight-Builds brachen ab mit:

```text
Could not find target with id 'undefined' in project.pbxproj
```

### Ursache

Der Aufruf steckt in `getTargetDependencies`
(`node_modules/@expo/config-plugins/build/ios/Target.js`). Die Funktion liest
bei einer Dependency nur `dep.target`:

```js
const { target: targetId } = project.getPBXGroupByKeyAndType(value, 'PBXTargetDependency');
const [, target] = findNativeTargetById(project, targetId);
```

CocoaPods schreibt bei statischen Frameworks jede Pod-Dependency **ohne**
`target`-Feld; die Ziel-ID steht nur im `targetProxy`
(`PBXContainerItemProxy.remoteGlobalIDString`). Im generierten Projekt von
`fam` betrifft das `Pods-fam`, `Pods-siri` und `Pods-ExpoWidgetsTarget`.
`targetId` ist damit `undefined`, und `findNativeTargetById` wirft.

Statische Frameworks setzt der ML-Kit-Pfad: `app.config.ts` setzt bei
`FAM_IOS_MLKIT_OCR=1` `useFrameworks: 'static'`, und Expo schreibt
`EXPO_USE_PRECOMPILED_MODULES` in `ios/Podfile.properties.json`. TestFlight
braucht ML Kit, also braucht TestFlight diese Konstellation — und genau sie
trifft den Bug.

Drei Kopien von `@expo/config-plugins` liegen im Baum (57.0.9, 55.0.11,
10.0.3). Keine liest `targetProxy`. Ein Downgrade von `expo-updates` behebt
den Fehler deshalb nicht — verifiziert: gleiche Fehlermeldung mit
`expo-updates` 57.0.23.

### Warum `scripts/eas-ios-build.sh` durchlaeuft

Das Skript arbeitet nicht im Projektverzeichnis, sondern in einem frischen
shallow Clone unter `/Volumes/Programme/temp_bin/eas-local/<profil>/work`
und setzt drei Variablen:

```bash
export EAS_LOCAL_BUILD_WORKINGDIR="$eas_working_directory"
export TMPDIR="$eas_tmp_dir/"
export EAS_LOCAL_BUILD_ARTIFACTS_DIR="$local_build_env_project_root/build/local/eas/$profile"
```

Dort liegt kein `ios/` und kein `node_modules`. eas-cli installiert selbst und
liest das lokale `ios/` nie. Das Skript erreicht deshalb die Credentials-
Einrichtung; der Picker mit `cwd: projectRoot` crasht vorher.

### Regel

Lokale EAS-Builds laufen im Workingdir unter `/Volumes/Programme/temp_bin`,
nicht im Projekt. Das gilt fuer den Build **und** fuer den Submit, weil das
Artefaktverzeichnis `EAS_LOCAL_BUILD_ARTIFACTS_DIR` sonst neben dem Projekt
landet. `build/local/` bleibt gitignored (`.gitignore:86`).

Umgesetzt in `easLocalBuildEnv()` und `easLocalBuildEnvVars()`
(`scripts/build-picker-logic.ts`), verdrahtet in `runStore()`.

### Nicht die Ursache

Diese drei Kandidaten sind widerlegt. Jeder wurde gemessen, nicht geraten:

- **`ios/` loeschen.** Ohne `ios/` schlaegt dieselbe Funktion frueher fehl mit
  `scheme 'fam' does not exist`. Der Fehler wandert nur.
- **`021ed24d` (Expo-Patch-Upgrade).** Gleiche Fehlermeldung vor und nach dem
  Downgrade auf 57.0.23.
- **Cloud-Builds.** Ein `eas-cli build --profile preview-testflight` ohne
  `--local` bricht nach 8 Sekunden mit derselben Meldung ab, weil eas-cli
  das lokale `ios/` auch fuer Cloud-Builds liest.
