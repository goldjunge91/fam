# Native Build

Die verbindliche Liste erlaubter Einstiege steht in
[AGENTS.md](../../AGENTS.md#erlaubte-build-einstiege). Alle Befehle in diesem
Dokument werden aus dem Repository-Root ausgeführt:

```bash
cd /Users/marco/Github.tmp/family_app/fam
```

`ios/` und `android/` sind lokale, ignorierte CNG-Ausgaben. Quellen sind
`app.json`, Dependencies, Assets und Config-Plugins. EAS lädt die nativen
Verzeichnisse nicht hoch und erzeugt sie im Build selbst. Änderungen gehören
in diese Quellen, niemals ausschließlich in generierte native Dateien.

Nach Änderungen an nativen Dependencies oder Plugins:

```bash
# Aktualisiert ios/ mit --no-clean; Pods, Build-Dateien und ccache bleiben erhalten.
FAM_HARNESS_UI=1 bun run native:prebuild -- --platform ios
# Android entsprechend:
FAM_HARNESS_UI=1 bun run native:prebuild -- --platform android
```

`native:dev` nutzt anschließend Expo `run:*`. Fehlt das native Projekt,
erzeugt Expo es automatisch. Existiert es bereits, muss es nach nativen
Änderungen explizit mit `native:prebuild` aktualisiert werden. Für reine
JS-/TS-Änderungen genügt `bun run start -- --dev-client`.

`withIosCcacheDir.js` erzeugt die Compiler-Wrapper und Podfile-Anpassungen bei
jedem Prebuild neu und aktiviert `apple.ccacheEnabled` für CocoaPods, auch
ohne `USE_CCACHE` im aufrufenden Terminal. `CCACHE_DIR` und der Compilerpfad gehören zum Build-Host;
`CCACHE_BASEDIR` und `CCACHE_CONFIGPATH` werden relativ zum erzeugten Wrapper
aufgelöst und funktionieren dadurch auch in einer verschobenen EAS-Kopie.
Ohne lokal konfigurierten ccache bleibt das Plugin inaktiv.

Alle eigenen Prebuild-Einstiege nutzen `--no-clean`, einschließlich Just,
CI und des geerbten `prebuildCommand` in `eas.json`. Nach dem Entfernen eines
Plugins können dessen native Änderungen bestehen bleiben und müssen gezielt
entfernt werden. Ein Clean-Prebuild wird nicht automatisch ausgeführt.

Für schnelle lokale Wiederholungsbuilds vorhandene Projekte über `native:dev`
bauen. EAS-Local verlangt weiterhin ein leeres
Arbeitsverzeichnis und erzeugt eine isolierte Projektkopie. Der externe ccache
bleibt dabei erhalten; EAS-Local ersetzt keinen inkrementellen Xcode-Build.

Quellen: [Expo CNG](https://docs.expo.dev/workflow/continuous-native-generation/),
[lokale Entwicklung](https://docs.expo.dev/guides/local-app-development/).

## 1. Status prüfen

```bash
bun run native:status
```

Bei einem Fingerprint-Mismatch zuerst die genaue Quelle anzeigen:

```bash
bun run native:status -- --diff
```

Ein Status-Mismatch blockiert `native:dev` nicht automatisch. Für gesperrte
Artefakte und Rebuilds muss die Native-Baseline jedoch wieder passen.

## 2. Development-Inner-Loop

```bash
# iOS Simulator
bun run native:dev -- --target ios-development-simulator

# iOS Gerät
bun run native:dev -- --target ios-development-device --device "Marco iPhone"

# Android Gerät oder Emulator
bun run native:dev -- --target android-development
```

Erlaubte Development-Targets:

```text
ios-development-simulator
ios-development-device
android-development
```

Nur mit ausdrücklicher Freigabe von Marco lokales iOS-DerivedData leeren:

```bash
bun run native:dev -- --target ios-development-simulator --no-build-cache
```

`--no-build-cache` umgeht nicht den Remote-Cache-Lookup aus `app.json` und
löscht keine Pods oder native Projekte.

## 3. Normaler Rebuild mit Cache

```bash
# iOS Produktion
bun run native:rebuild -- --target ios-production

# Android Preview
bun run native:rebuild -- --target android-preview

# Android Produktion
bun run native:rebuild -- --target android-production
```

Bei unveränderter Native-Konfiguration werden die lokale Prebuild-Vorbereitung
und unveränderte Pods übersprungen. EAS-Local benötigt eine frische Arbeitskopie
unter dem festen Workingdir; externer ccache bleibt erhalten. Der lokale
TestFlight-Aufruf ist im nächsten Abschnitt beschrieben.

Wenn `native:status -- --diff` einen absichtlichen Native-Drift zeigt, das
Prebuild einmalig freigeben:

```bash
bun run native:rebuild -- \
  --target ios-production \
  --approve-rebuild
```

`--approve-rebuild` ist nur für das notwendige Native-Prebuild erforderlich.
Nicht bei jedem normalen Build hinzufügen. Das Prebuild verwendet
`--no-clean`. Vorhandene native Projekte und Build-Dateien bleiben erhalten.
`pod install` läuft nur bei fehlenden/nicht synchronen Pods oder geänderten
Pod-Eingaben. Bei unveränderten Eingaben werden Prebuild und Pod-Installation
übersprungen. EAS generiert zusätzlich seine eigene isolierte Kopie.

## 4. Lokaler TestFlight-Build

Den Build über das Projekt-Skript starten:

```bash
bun run native:rebuild -- --target ios-preview-testflight
```

Das Target verwendet `eas build --local` und das Profil `preview-testflight`
aus `eas.json`. Die erzeugte IPA wird mit Fingerprint und SHA-256 in
`native-build-lock.json` registriert.

Bei Native-Drift zuerst `bun run native:status -- --diff` prüfen. Mit Freigabe
für das inkrementelle Prebuild:

```bash
bun run native:rebuild -- --target ios-preview-testflight --approve-rebuild
```

Das Prebuild verwendet `--no-clean`; vorhandene native Projekte und Caches
werden nicht durch ein Clean-Prebuild gelöscht.

**Der Build lädt nicht automatisch hoch.** Im interaktiven Terminal bietet das
Projekt-Skript anschließend den Upload zu App Store Connect an (Standard:
Nein). Ohne Terminal wird nur der passende Submit-Befehl ausgegeben. Upload
nur auf entsprechenden Auftrag: entweder die Abfrage bestätigen oder den
angezeigten Submit-Befehl mit dem Pfad der neu erzeugten IPA verwenden.

## 5. Registriertes Artefakt verwenden

Nur ein bereits registriertes und unverändertes Artefakt installieren:

```bash
bun run native:run -- --target ios-development-simulator
bun run native:run -- --target android-development
```

Kein automatischer Rebuild:

```bash
bun run native:run -- --target <target>
```

## 6. EAS-Artefakt wiederherstellen

```bash
bun run native:restore -- \
  --target ios-preview-testflight \
  --eas-build-id <EAS_BUILD_ID>
```

Ohne `--eas-build-id` wird die im `native-build-lock.json` registrierte
EAS-Build-ID verwendet.

## 7. Baseline aktualisieren

`native:baseline` kompiliert nicht. Es schreibt nur den aktuellen Fingerprint
der deklarativen CNG-Eingaben, auch ohne lokale Native-Projekte:

```bash
bun run native:baseline -- --approve-rebuild
```

Nur nach einer absichtlichen Native-Änderung verwenden. Nicht verwenden, um
einen unerklärten Drift zu verstecken. Für den Release-Graphen
`FAM_HARNESS_UI=0` verwenden. Eine neue Baseline macht vorhandene Binärartefakte
nicht gültig: diese behalten ihren ursprünglichen Fingerprint und müssen bei
abweichenden nativen Eingaben neu gebaut werden.

Die Umstellung von versionierten Native-Projekten auf CNG ändert den
Fingerprint absichtlich. Nach Freigabe für den Drift den erlaubten Build-Einstieg
mit `--approve-rebuild` verwenden. Der Projektbefehl für TestFlight steht in
Abschnitt 4.

## 8. Laufzeit messen

`native:dev`, `native:rebuild`, `native:run` und `native:restore` messen ihre
Laufzeit bereits selbst. Am Ende steht die Dauer im Terminal.

Für einen beliebigen einzelnen Build-Befehl:

```bash
just build-timer \
  --class C \
  --target custom-build \
  -- \
  node -e "process.exit(0)"
```

Die Klassen bedeuten:

```text
A   vollständiger Kaltlauf
B   Artefakt-/Restore-Pfad mit vorhandenem Cache
B'  normaler warmer Development-/Rebuild-Lauf
C   bewusst freigegebener oder cacheloser Lauf
```

Die Messwerte liegen lokal in:

```text
.build-metrics/builds.jsonl
```

Letzten Lauf anzeigen:

```bash
tail -n 1 .build-metrics/builds.jsonl | jq
```

Die Datei ist gitignored und kein Build-Artefakt. Sie enthält unter anderem
Target, Build-Klasse, Phasen, Gesamtdauer, Fingerprint, ccache-Delta, Git-SHA
und Exit-Code.

## Unterstützte Targets

```text
ios-development-simulator
ios-development-device
ios-preview-testflight
ios-production
android-development
android-preview
android-production
```
