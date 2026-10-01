# Einkaufslisten-Absturz und TestFlight-Build: Stand vom 2026-10-01

Status: teilweise offen
Erstellt: 2026-10-01
Letzte Aktualisierung: 2026-10-01, nach dem lokalen `iphoneos`-Build
Bezug: Commits `ac66cd33`, `1098688c`, `75e5e279`, `cae70f14`, `5d466e43` auf `main`

Dieses Dokument fasst den Arbeitsstand eines Agenten-Threads zusammen: welche
Änderungen committet sind, welche wirkungslos waren und was als Arbeitsstand im
Working Tree liegt.

Der Thread hatte zwei getrennte Baustellen: einen App-Absturz auf Android
(Einkaufsliste) und eine TestFlight-Build-Kette auf iOS (Prebuild, Siri-Extension,
ML Kit, Frameworks).

## 1. Committete Änderungen

Alle vier Commits liegen auf `main` und `origin/main`, es gibt keinen unpusheten
Commit. Der Working Tree ist bis auf dieses Dokument sauber.

**Abweichung vom urspruenglichen Thread-Verlauf:** Waehrend der Arbeit an diesem
Dokument gingen die Hook-Aenderungen in `plugins/withIosSimulatorArm64.js`
verloren, vermutlich durch einen Rebase zwischen zwei Threads. Sie sind in
Abschnitt 2 und 3 beschrieben, aber nicht mehr im Code.

### `ac66cd33` - Prebuild-Cache aus dem TypeScript-Programm ausgeschlossen

`tsconfig.json` fing über `**/*.ts` rund 32.500 entpackte Paketquellen in
`build/` mit, statt 1.200 in `src/`. Daraus folgten ein Notfall im
Language-Server, die Meldung "No inputs were found in config file" und ein Abbruch
von `tsc --noEmit` mit TS6053. Alle Folgefehler (840 Verstöße, davon 580 in
einer unbeteiligten Datei) waren Kaskaden desselben Problems.

Hinweis: `.gitignore` allein genügt hier nicht, der Language-Server respektiert
es nicht. Für Jest war `build/` bereits in `jest.config.js` ausgeschlossen.

### `1098688c` - Zutaten-Transfer bricht bei einem Artikel nicht ab

Betrifft `src/features/meal-planner/missing-ingredients-screen.android.tsx` und
`src/features/meal-planner/missing-ingredients-screen.test.tsx`.

Dies ist der eigentliche Fix für die wiederkehrende Fehlermeldung beim Hinzufügen
von Artikeln zur Einkaufsliste, **nicht** für den nativen Absturz.

`handleAddSelected` rethrowte den Fehler eines einzelnen Artikels ungehandelt.
Der `onPress`-Promise blieb unbeaufsichtigt, dadurch stoppte der Transfer beim
ersten Fehler und der Nutzer bekam keinerlei Rückmeldung.

- Fehlgeschlagene Artikel werden gezählt statt weitergereicht, die übrigen
  werden weiter geschrieben.
- `setAddedCount` zählt die tatsächlich geschriebenen Artikel statt der Auswahl,
  damit die Erfolgsmeldung bei Teilerfolg stimmt.
- Teilerfolg und Komplettausfall werden sichtbar angezeigt, mit "n von m" statt
  einer irreführenden Erfolgsmeldung.
- Ein eigener `isSubmitting`-Zustand sperrt den Button über die gesamte Dauer,
  statt am flackernden `isPending` der Mutation.
- Zwei Regressionstests für Teilerfolg und Komplettausfall ergänzt.

### `75e5e279` - TestFlight-Abbruch im Prebuild mit leerem `ios/`

Fehler: `withMainAppSiriIntent: Siri App Intents target not found`.

Lokal fiel das nie auf, weil `ios/` aus einem früheren Lauf existierte. Der
Cloud-Build startet mit leerem `ios/`. Eine Umstellung der Plugin-Reihenfolge
löst das nicht: config-plugins lässt pro Mod nur einen Provider zu, sie
verschiebt das Problem nur auf `withSiriBuildNumber` (vorher fehlt der Target,
nachher kollidiert der Mod-Provider).

- `plugins/withMainAppSiriIntent.js` entfällt (108 Zeilen gelöscht). Die
  Swift-Quelle wandert nach `targets/siri/_shared/`, wo `@bacons/apple-targets`
  sie in genau zwei Targets einbindet. Ein globales `targets/_shared` wäre in
  allen Extension-Targets gelandet, auch in watch.
- `plugins/withSiriBuildNumber.js` entfällt (22 Zeilen gelöscht).
  `CURRENT_PROJECT_VERSION` für `siri` setzt jetzt der CocoaPods-`post_integrate`-
  Hook in `withIosSimulatorArm64`. Der Hook läuft nach dem Prebuild und sieht alle
  Targets. Der Wert wird aus dem `fam`-Target gelesen statt aus `app.json`, weil
  `appVersionSource` auf `remote` steht und EAS die Build-Nummer im generierten
  Projekt setzt.
- `.easignore` schließt `ios/Pods` und lokale Build-Caches vom Upload aus. Ein
  mitgeliefertes `Pods` aus einer lokalen Installation erzeugte doppelte
  Build-Produkte.

  **Einschraenkung:** `ios/` ist ueber `.gitignore` ausgeschlossen und wird
  deshalb nie hochgeladen. Die Eintraege `ios/Pods`, `ios/build` und
  `ios/DerivedData` sind damit derzeit wirkungslos. Sie schuetzen erst dann,
  wenn `ios/` einmalig versioniert oder der Upload um `ios/` erweitert wird.

Verifiziert: Prebuild mit leerem `ios/` läuft durch, `siri` baut im Debug und im
Release, beide Intents liegen im Binary, `siri` übernimmt die App-Buildnummer
(`1` = `1`), alle vier Targets haben aktive Provisioning Profiles, 7 von 7
Siri-Konventionstests grün, Typecheck und Biome grün.

### `cae70f14` - Privacy-Manifest-Aggregation im ML-Kit-Zweig ab

Fehler im Archive-Schritt:

```text
error: Multiple commands produce '.../React-timing_privacy.bundle'
  note: Target 'React-timing-framework-React-timing_privacy'
  note: Target 'React-timing-library-React-timing_privacy'
```

Nur der ML-Kit-Pfad aktiviert `useFrameworks: static`, weil `expo-mlkit-ocr` ein
XCFramework liefert. CocoaPods erzeugt dabei pro React-Pod zwei Targets, eine
`-framework-` und eine `-library-`-Variante. Mit aktiver
`privacy_file_aggregation_enabled` schreiben beide in dasselbe
`*_privacy.bundle`-Verzeichnis und der Build bricht ab.

Die Aggregation wird deshalb nur in diesem Zweig abgeschaltet
(`privacyManifestAggregationEnabled: false` in den `expo-build-properties`-
Optionen). Der Apple-Vision-Pfad ohne `useFrameworks` ist nicht betroffen. Ohne
die Aggregation bleibt jede App für die DSGVO-Deklaration selbst zuständig, was
der Zustand vor dem ML-Kit-Pfad bereits war.

**Der Commit hat den EAS-Build nicht gefixt.** Der anschliessende Build
`a9383488` brach mit demselben `React-*_privacy.bundle`-Fehler ab. Die Properties
landen korrekt in `ios/Podfile.properties.json`
(`"apple.privacyManifestAggregationEnabled": "false"`), loesen den Konflikt aber
nicht auf. Der Fix bleibt als belegter Fehlversuch im Bestand und ist nicht
zurueckgenommen, weil er die Aggregation abschaltet und damit in die
DSGVO-Deklaration eingreift - das ist eine bewusste Entscheidung und keine
Agenten-Korrektur.

## 2. Nicht funktionierende Änderungen

### Verifiziert wirkungslos: `plugins/withIosSimulatorArm64.js`

Uncommittet, 48 zusätzliche Zeilen. Zwei zusammenhängende Versuche im
`post_integrate`-Hook.

**Versuch 1, wirkungslos:** Die doppelten XCFramework-Aggregate-Targets entfernen
für die fünf betroffenen Pods `ExpoModulesCore`, `ExpoModulesJSI`,
`hermes-engine`, `React-Core-prebuilt` und `ReactNativeDependencies`. Die
Aggregate blieben bestehen, der Fehler `Multiple commands produce
.../ExpoModulesCore.framework` trat weiter auf.

### Versuch 2, teilweise erfolgreich, anschliessend verloren gegangen

Statt des ganzen Aggregates nur die `[CP] Copy XCFrameworks`-Phase aus der
`framework`-Variante entfernen. Das loeste die Framework-Dopplung und den
darauf folgenden `no such module 'ExpoModulesCore'`-Fehler. Der `iphoneos`-Build
kam darueber hinaus und scheiterte an zwei Script-Phasen:

```text
PhaseScriptExecution [CP-User] [RNDeps] Replace React Native Dependencies ...
  (in target 'ReactNativeDependencies-framework')
PhaseScriptExecution [CP] Copy XCFrameworks (in target 'opencv-rne')
```

Beide betrafen Targets, deren Kopierphase der Hook angefasst hatte. Ob der Hook
dort zu viel entfernte, wurde nicht geklaert. **Dieser Stand ist nicht mehr im
Working Tree** - `plugins/withIosSimulatorArm64.js` enthaelt weder
`duplicated_xcframeworks` noch `SUPPORTED_PLATFORMS`. Vermutlich durch einen
Rebase zwischen zwei Threads verloren gegangen. Beide Aenderungen muessen fuer
einen weiteren Versuch neu geschrieben werden.

### Neu belegt: der Watch-Target baut mit dem falschen SDK

Der Watch-Fehler ist im EAS-Log nie aufgetaucht, im lokalen `iphoneos`-Build
dagegen sofort:

```text
error: The stickers icon set, app icon set, or icon stack named "AppIcon"
       did not have any applicable content.
```

`actool` lief mit `--platform iphoneos --target-device iphone --target-device ipad`
gegen ein `platform: watchos` deklariertes Icon. Ursache: Das Target traegt
`SDKROOT = watchos` und `TARGETED_DEVICE_FAMILY = 4`, wird aber ueber "Embed
Watch Content" mit dem App-SDK gebaut, wodurch `xcodebuild -sdk iphoneos` das
SDKROOT ueberschreibt. Mit `-sdk watchos` baut das Target fehlerfrei.

Der Ansatz `SUPPORTED_PLATFORMS = watchos` fuer das `watch`-Target im Hook ist
verloren gegangen, siehe oben. Der Icon-Eintrag selbst war nicht die Ursache; zwei
Aenderungsversuche an `AppIcon.appiconset/Contents.json` (`idiom: watch-marketing`
und ein expliziter `platform`-Schluessel) wurden zurueckgenommen, der Bestand ist
unveraendert.

### Zurückgenommen, erzeugt aber einen neuen Fehler: `EXPO_USE_PRECOMPILED_MODULES: false`

Der Fehler lautet:

```text
ExpoModulesCore-library depends upon ReactCodegen-library,
which does not define modules
```

Darauf brechen `siri` und `ExpoWidgetsTarget` an fehlenden Modulen:

```text
error: no such module 'ExpoModulesCore'
  node_modules/expo-sqlite/ios/Exceptions.swift:1:8
```

Der Precompiled-Modus muss bleiben. Zurueckgenommen.

### Zurückgenommen: Aggregate entfernen statt Kopierphase

Der erste Versuch entfernte die kompletten `X-library`-Aggregate-Targets statt
nur deren Kopierphase. `ExpoSQLite-library` braucht `ExpoModulesCore-library`
als Swift-Modul und brach mit `no such module 'ExpoModulesCore'` ab. Die
Aggregate-Targets sind kein Relikt, sie sind eine echte Alternative, die andere
Pods referenzieren.

### Falsche Diagnosen, die verworfen wurden

Ein Sub-Agent vermutete den SQLCipher-Key-File-Mirror
(`src/lib/db/database-key-file-store.ts`) als Absturzursache. Das Crash-Log
`~/Library/Logs/DiagnosticReports/fam-2026-09-29-233506.ips` widerlegte das: Es
enthält keine SQLite-, Dateisystem- oder Encryption-Frames.

Tatsächliche Absturmlage, zwei getrennte Fehler:

| Fehler                 | Ort                                                                                            | Auslöser                     |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| Nativer Absturz        | `expo-notifications` (`PushTokenModule.definition()`, `NotificationCenterManager.addDelegate`) | App-Start                    |
| Wiederkehrende Meldung | `handleAddSelected` in `missing-ingredients-screen.android.tsx`                                | Hinzufügen zur Einkaufsliste |

Der native Crash ist **nicht** im Einkaufslisten-Code. Die Keychain- und
App-Group-Arbeit aus `d383e57e` ist davon getrennt und weiterhin gültig.

Das Crash-Log zeigt `EXC_BAD_ACCESS` / `SIGSEGV` mit
`KERN_INVALID_ADDRESS at 0x0000beadde795580`, also Memory Corruption oder
Use-after-free waehrend der native-Module-Registrierung. Nicht verifiziert ist,
ob die restlichen Logs (`0x8badf00d`, also Watchdog-Kills bei
`backgrounding`) dieselbe Wurzel haben.

### Weitere verworfene Diagnosen aus der TestFlight-Kette

Vier Fehldiagnosen, jeweils durch Messung widerlegt:

1. **Apple-Server nicht erreichbar.** Der erste EAS-Abbruch meldete "internal
   server error from Apple's App Store Connect". `curl` auf
   `api.appstoreconnect.apple.com` liefert 401 (ohne Auth), auf
   `developer.apple.com` 200. Apple antwortet.
2. **`keychain-access-groups` als Ursache des Siri-Abbruchs.** Der Vorschlag, die
   Gruppe aus `targets/siri/expo-target.config.js:13` zu entfernen, wurde nicht
   umgesetzt. `siri` war das einzige Target mit Keychain-Gruppe **und** das
   einzige, das scheiterte, die Kausalitaet liess sich aber nicht belegen.
3. **`--local` gegen Cloud als Achse.** Der Unterschied war die
   Authentifizierungsmethode, nicht der Compileort. Der Cookie-Login
   synchronisiert `capability identifiers`, der API-Key-Pfad ueberspringt sie.
   `scripts/eas-ios-build.sh:55` erzwingt `--non-interactive` und nimmt damit
   immer den API-Key-Pfad.
4. **EAS baue einen veralteten Git-Stand.** Nach dem Push von `75e5e279` blieb
   `Could not find target with id 'undefined'` bestehen. Die Ursache lag lokal in
   der Credential-Vorbereitung, nicht im Repository-Stand.

### Falsch platziert, formal behoben, sachlich wirkungslos

`privacyManifestAggregationEnabled` stand zunächst nach `config.ios` statt in den
Plugin-Optionen, wodurch `ios/Podfile.properties.json` weiterhin `"true"`
enthielt. `cae70f14` hat die Platzierung korrigiert, die lokale
`ios/Podfile.properties.json` zeigt jetzt
`"apple.privacyManifestAggregationEnabled": "false"`. Der Build bricht damit
aber weiterhin ab, siehe oben.

### Unverifizierte Ansätze

Kein Commit, kein Beleg, bisher nicht umgesetzt:

- `use_frameworks!` auf `linkage => :static` plus `forceStaticLinking` für genau
  die fünf problematischen Pods.
- `use_frameworks!` nur für ML Kit, die fünf Module einzeln als statische Pods
  deklarieren.
- Die `-framework`-Aggregate gezielt im `post_install`-Hook entfernen.

Ein dritter Ansatz ist inzwischen umgesetzt und scheitert an einer anderen Stelle:
die `-framework`-Aggregate gezielt im `post_integrate`-Hook bereinigen. Siehe
Abschnitt 2.

Alle lösen das Kernproblem nicht vollständig: Die Doppelung entsteht aus
`use_frameworks: static` in Kombination mit den vorkompilierten Expo-Modulen,
und ML Kit lässt sich nicht ohne `use_frameworks` linken.

## 3. Nicht verifizierter Arbeitsstand

Nicht committet, nicht gebaut, nicht getestet.

| Datei                                                       | Änderung                                                                             | Status                                                                                                                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (keine)                                                     | Die Hook-Versuche aus Abschnitt 2 sind nicht mehr im Working Tree                    | `plugins/withIosSimulatorArm64.js` enthaelt weder `duplicated_xcframeworks` noch `SUPPORTED_PLATFORMS`. Der Zwischenstand ist verloren, vermutlich durch einen Rebase zwischen zwei Threads |
| `eas.json` (staged)                                         | `preview-testflight-local`: `autoIncrement` `false` zu `true`                        | sinnvoll, App Store Connect lehnt belegte Buildnummern ab. Commit-Text liegt fertig in `.git-commit-msg-eas.txt`                                                                            |
| `docs/architecture/LOCAL_NATIVE_BUILDS.md` (staged)         | 15 Zeilen Doku zum AutoIncrement                                                     | passt zu `eas.json`                                                                                                                                                                         |
| `package.json`                                              | `expo-app-intents: ^0.0.1` hinzugefügt                                               | ungenutzt, kein einziger Import im Code. Vermutlich Research-Reste zu `siri.md`                                                                                                             |
| `targets/watch/content.swift`                               | SwiftUI-Refactor, `ShoppingCategorySection` extrahiert, Sections aus dem `List`-Body | nicht gebaut                                                                                                                                                                                |
| `src/features/ocr/capture/receipt-scanner-dummy-screen.tsx` | `display` zu `title`, `subheading` zu `heading`, tote Styles entfernt                | nicht getestet                                                                                                                                                                              |
| `.zed/settings.json`                                        | 259 Zeilen Editor-Konfiguration, Biome-LSP                                           | themenfremd                                                                                                                                                                                 |
| `bun.lock`                                                  | Folge von `expo-app-intents`                                                         | abhängig von `package.json`                                                                                                                                                                 |

Untracked-Artefakte: keine mehr. `siri.md`,
`mlkit_img_bon_50".json.save`, `scripts/eas-ios-build-frozen.sh`,
`scripts/list-profiles.sh`, `docs/mockups/watch-einkaufsliste/` und `.zed/tasks.json`
existieren nicht mehr; ihre Inhalte sind in `5d466e43` bzw. `cae70f14` committet
worden.

- `siri.md` - Export der Expo-Dokumentation zu `expo-app-intents`
- `mlkit_img_bon_50".json.save` - Dateiname enthält ein kaputtes Zeichen
- `scripts/eas-ios-build-frozen.sh` - Workaround für `--freeze-credentials`, in
  `package.json` nicht verdrahtet
- `scripts/list-profiles.sh` - liest lokale Provisioning Profiles
- `docs/mockups/watch-einkaufsliste/`
- `.zed/tasks.json`
- `.git-commit-msg-eas.txt` - fertiger Commit-Text für den `eas.json`-Fix

## 4. Offenes Kernproblem

Der TestFlight-Build laeuft nicht durch. Nach den Korrekturen aus Abschnitt 2
bleiben zwei Script-Phase-Fehler, die beim `iphoneos`-Build auftreten:

```text
PhaseScriptExecution [CP-User] [RNDeps] Replace React Native Dependencies ...
  (in target 'ReactNativeDependencies-framework' from project 'Pods')
PhaseScriptExecution [CP] Copy XCFrameworks (in target 'opencv-rne' from project 'Pods')
```

Beide betreffen Targets, deren `[CP] Copy XCFrameworks`-Phase der Hook in
`plugins/withIosSimulatorArm64.js` entfernt hat. Dieser Stand ist allerdings
verloren gegangen (siehe Abschnitt 2), die beiden Zeilen sind damit kein
reproduzierbarer Ausgangspunkt, sondern eine Notiz, was zuletzt gesehen wurde.

Ursache der ursprünglichen Doppelung: `use_frameworks!` mit
`linkage => :static` (wegen ML Kit) zusammen mit `EXPO_USE_PRECOMPILED_MODULES:
true` erzeugt für fünf Pods je zwei Aggregate-Targets mit identischer
`[CP] Copy XCFrameworks`-Phase, die in dasselbe Verzeichnis schreiben.

Der ML-Kit-Weg ist die Ursache. Der Privacy-Manifest-Fix aus `cae70f14` hat nur
den anderen Fehler (Bundle-Dopplung) beseitigt, nicht die Framework-Dopplung.

Belegte Ausgangslage des lokalen Builds, in dieser Reihenfolge:

1. Prebuild mit leerem `ios/` läuft durch.
2. `siri` und `ExpoWidgetsTarget` bauen, alle CocoaPods-Pods sind aufgeloest
   (`Pods-siri` wird erzeugt, `ExpoSQLite` importierbar).
3. Fünf Frameworks sind doppelt, jeweils als `X-framework` und `X-library`.
4. Nach Entfernen der Kopierphase der framework-Variante: zwei Script-Phasen
   schlagen fehl.

### Naechste Schritte

1. Die beiden Hook-Aenderungen neu schreiben, weil der Zwischenstand verloren
   gegangen ist: Kopierphase der framework-Variante entfernen und `watch` auf
   `SUPPORTED_PLATFORMS = watchos` setzen.
2. Die beiden Script-Phase-Fehler einzeln isolieren, um festzustellen, ob der
   Hook die Ursache ist oder ob `opencv-rne` unabhaengig davon scheitert.
3. Falls der Hook zu viel entfernt: die Kopierphase nur fuer die Pods entfernen,
   die tatsaechlich kollidieren, statt pauschal fuer alle fuenf.
4. Den ML-Kit-Pfad als direkte XCFramework-Einbindung ohne `use_frameworks`
   neu denken. Das waere der Weg, der die Doppelung an der Wurzel beseitigt,
   erfordert aber eine Aenderung an der OCR-Anbindung.
