# Einkaufslisten-Absturz und TestFlight-Build: Stand vom 2026-10-01

Status: teilweise offen
Erstellt: 2026-10-01
Bezug: Commits `ac66cd33`, `1098688c`, `75e5e279`, `cae70f14` auf `main`

Dieses Dokument fasst den Arbeitsstand eines Agenten-Threads zusammen: welche
Änderungen committet sind, welche wirkungslos waren und was als Arbeitsstand im
Working Tree liegt.

Der Thread hatte zwei getrennte Baustellen: einen App-Absturz auf Android
(Einkaufsliste) und eine TestFlight-Build-Kette auf iOS (Prebuild, Siri-Extension,
ML Kit, Frameworks).

## 1. Committete Änderungen

Alle vier Commits liegen auf `main` und `origin/main`, es gibt keinen unpusheten
Commit.

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

Verifiziert: Prebuild mit leerem `ios/` läuft durch, `siri` baut im Debug und im
Release, beide Intents liegen im Binary, `siri` übernimmt die App-Buildnummer
(`1` = `1`), alle vier Targets haben aktive Provisioning Profiles, 7 von 7
Siri-Konventionstests grün, Typecheck und Biome grün.

### `cae70f14` - Privacy-Manifest-Aggregation im ML-Kit-Zweig ab (aktueller HEAD)

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

## 2. Nicht funktionierende Änderungen

### Verifiziert wirkungslos: `plugins/withIosSimulatorArm64.js`

Uncommittet, 33 zusätzliche Zeilen. Der Versuch, die doppelten XCFramework-
Aggregate im `post_integrate`-Hook zu entfernen, für die fünf betroffenen Pods
`ExpoModulesCore`, `ExpoModulesJSI`, `hermes-engine`, `React-Core-prebuilt` und
`ReactNativeDependencies`.

**Hat nicht funktioniert.** Die Aggregat-Targets bleiben bestehen, der Fehler
`Multiple commands produce .../ExpoModulesCore.framework` tritt weiter auf. Der
Code liegt unverändert im Working Tree.

### Zurückgenommen, erzeugt aber einen neuen Fehler: `EXPO_USE_PRECOMPILED_MODULES: false`

Der Fehler lautet:

```text
ExpoModulesCore-library depends upon ReactCodegen-library,
which does not define modules
```

Darauf brechen `siri` und `ExpoWidgetsTarget` an fehlenden Modulen. Der
Precompiled-Modus muss bleiben.

### Falsche Diagnose, die verworfen wurde

Ein Sub-Agent vermutete den SQLCipher-Key-File-Mirror
(`src/lib/db/database-key-file-store.ts`) als Absturzursache. Das Crash-Log
`~/Library/Logs/DiagnosticReports/fam-2026-09-29-233506.ips` widerlegte das.

Tatsächliche Absturmlage, zwei getrennte Fehler:

| Fehler                 | Ort                                                                                            | Auslöser                     |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| Nativer Absturz        | `expo-notifications` (`PushTokenModule.definition()`, `NotificationCenterManager.addDelegate`) | App-Start                    |
| Wiederkehrende Meldung | `handleAddSelected` in `missing-ingredients-screen.android.tsx`                                | Hinzufügen zur Einkaufsliste |

Der native Crash ist **nicht** im Einkaufslisten-Code. Die Keychain- und
App-Group-Arbeit aus `d383e57e` ist davon getrennt und weiterhin gültig.

### Falsch platziert, inzwischen behoben

`privacyManifestAggregationEnabled` stand zunächst nach `config.ios` statt in den
Plugin-Optionen, wodurch `ios/Podfile.properties.json` weiterhin `"true"`
enthielt. Das ist mit `cae70f14` korrigiert, die lokale
`ios/Podfile.properties.json` zeigt jetzt
`"apple.privacyManifestAggregationEnabled": "false"`.

### Unverifizierte Ansätze

Kein Commit, kein Beleg, bisher nicht umgesetzt:

- `use_frameworks!` auf `linkage => :static` plus `forceStaticLinking` für genau
  die fünf problematischen Pods.
- `use_frameworks!` nur für ML Kit, die fünf Module einzeln als statische Pods
  deklarieren.
- Die `-framework`-Aggregate gezielt im `post_install`-Hook entfernen.

Alle drei lösen das Kernproblem nicht: Die Doppelung entsteht aus
`use_frameworks: static` in Kombination mit den vorkompilierten Expo-Modulen,
und ML Kit lässt sich nicht ohne `use_frameworks` linken.

## 3. Nicht verifizierter Arbeitsstand

Nicht committet, nicht gebaut, nicht getestet.

| Datei                                                       | Änderung                                                                             | Status                                                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `plugins/withIosSimulatorArm64.js`                          | 33 Zeilen, doppelte Aggregate entfernen                                              | wirkungslos, siehe Abschnitt 2                                                                                   |
| `eas.json` (staged)                                         | `preview-testflight-local`: `autoIncrement` `false` zu `true`                        | sinnvoll, App Store Connect lehnt belegte Buildnummern ab. Commit-Text liegt fertig in `.git-commit-msg-eas.txt` |
| `docs/architecture/LOCAL_NATIVE_BUILDS.md` (staged)         | 15 Zeilen Doku zum AutoIncrement                                                     | passt zu `eas.json`                                                                                              |
| `package.json`                                              | `expo-app-intents: ^0.0.1` hinzugefügt                                               | ungenutzt, kein einziger Import im Code. Vermutlich Research-Reste zu `siri.md`                                  |
| `targets/watch/content.swift`                               | SwiftUI-Refactor, `ShoppingCategorySection` extrahiert, Sections aus dem `List`-Body | nicht gebaut                                                                                                     |
| `src/features/ocr/capture/receipt-scanner-dummy-screen.tsx` | `display` zu `title`, `subheading` zu `heading`, tote Styles entfernt                | nicht getestet                                                                                                   |
| `.zed/settings.json`                                        | 259 Zeilen Editor-Konfiguration, Biome-LSP                                           | themenfremd                                                                                                      |
| `bun.lock`                                                  | Folge von `expo-app-intents`                                                         | abhängig von `package.json`                                                                                      |

Untracked-Artefakte:

- `siri.md` - Export der Expo-Dokumentation zu `expo-app-intents`
- `mlkit_img_bon_50".json.save` - Dateiname enthält ein kaputtes Zeichen
- `scripts/eas-ios-build-frozen.sh` - Workaround für `--freeze-credentials`, in
  `package.json` nicht verdrahtet
- `scripts/list-profiles.sh` - liest lokale Provisioning Profiles
- `docs/mockups/watch-einkaufsliste/`
- `.zed/tasks.json`
- `.git-commit-msg-eas.txt` - fertiger Commit-Text für den `eas.json`-Fix

## 4. Offenes Kernproblem

Der Fehler `Multiple commands produce .../ExpoModulesCore.framework` ist nicht
gelöst.

Ursache: `use_frameworks!` mit `linkage => :static` (wegen ML Kit) zusammen mit
`EXPO_USE_PRECOMPILED_MODULES: true` erzeugt für fünf Pods je zwei
Aggregate-Targets mit identischer `[CP] Copy XCFrameworks`-Phase, die in
dasselbe Verzeichnis schreiben.

Der ML-Kit-Weg ist die Ursache. Der Privacy-Manifest-Fix aus `cae70f14` hat nur
den anderen Fehler (Bundle-Dopplung) beseitigt, nicht die Framework-Dopplung.

Mögliche nächste Schritte:

1. Das generierte Xcode-Projekt inspizieren, um zu klären, ob sich die Doppelung
   überhaupt ohne Framework-Aggregate auflösen lässt.
2. Den ML-Kit-Pfad als direkte XCFramework-Einbindung ohne `use_frameworks`
   neu denken.
