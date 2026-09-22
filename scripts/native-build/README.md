# Native Build

Alle Befehle in diesem Dokument werden aus dem Repository-Root ausgeführt:

```bash
cd /Users/marco/Github.tmp/family_app/fam
```

Die Native-Build-Scripts verwenden vorhandene Native-Konfiguration, Pods, ccache,
DerivedData und das feste EAS-Workingdir weiter. Ein Prebuild oder `pod install`
läuft nur, wenn der Native-Fingerprint oder der CocoaPods-Zustand es verlangt.

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

Nur lokales iOS-DerivedData leeren:

```bash
bun run native:dev -- --target ios-development-simulator --no-build-cache
```

`--no-build-cache` umgeht nicht den Remote-Cache-Lookup aus `app.json` und
löscht keine Pods oder native Projekte.

## 3. Normaler Rebuild mit Cache

```bash
# Preview-TestFlight
bun run native:rebuild -- --target ios-preview-testflight

# iOS Produktion
bun run native:rebuild -- --target ios-production

# Android Preview
bun run native:rebuild -- --target android-preview

# Android Produktion
bun run native:rebuild -- --target android-production
```

Bei unveränderter Native-Konfiguration werden Prebuild und unveränderte Pods
übersprungen. ccache, DerivedData und das feste EAS-Workingdir werden weiter
verwendet.

Wenn `native:status -- --diff` einen absichtlichen Native-Drift zeigt, das
Prebuild einmalig freigeben:

```bash
bun run native:rebuild -- \
  --target ios-preview-testflight \
  --approve-rebuild
```

`--approve-rebuild` ist nur für das notwendige Native-Prebuild erforderlich.
Nicht bei jedem normalen Build hinzufügen. Das Prebuild verwendet kein
`--clean`. Auf iOS wird `pod install` nur bei fehlenden oder nicht synchronen
Pods bzw. geänderten Pod-Eingaben ausgeführt.

## 4. TestFlight mit Fastpath und Fallback

Der einzige öffentliche TestFlight-Einstieg ist der Workflow-Runner:

```bash
bash .codex/skills/ios-build-workflow/scripts/run-ios-build.sh testflight
```

Der Ablauf ist:

1. Native-Baseline und vorhandene Artefakte prüfen.
2. Warmen iOS-Fastpath mit ccache, Pods und Release-DerivedData versuchen.
3. Nur bei Fastpath-Exit-Code `42` den kontrollierten `native:rebuild` ausführen.
4. Das frische IPA erneut prüfen und genau dieses IPA hochladen.

Der Fastpath wird nicht direkt aufgerufen. Ein Konfigurationsfehler, zum
Beispiel eine nicht eingehängte externe Build-Platte, wird nicht still durch
einen anderen Build ersetzt.

Für Simulator und TestFlight zusammen:

```bash
bash .codex/skills/ios-build-workflow/scripts/run-ios-build.sh both
```

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
der vorhandenen Native-Projekte:

```bash
bun run native:baseline -- --approve-rebuild
```

Nur nach einer absichtlichen Native-Änderung verwenden. Nicht verwenden, um
einen unerklärten Drift zu verstecken.

## 8. Laufzeit messen

`native:dev`, `native:rebuild`, `native:run` und `native:restore` messen ihre
Laufzeit bereits selbst. Am Ende steht die Dauer im Terminal.

Für einen beliebigen einzelnen Build-Befehl:

```bash
bun run build:timer -- \
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
