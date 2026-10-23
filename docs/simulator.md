# iOS Simulator

Development-Build lokal über Expo/Xcode erstellen und starten. Vollständige
Befehle für Simulator, echtes iPhone und TestFlight stehen in der
[Build-Anleitung](architecture/LOCAL_NATIVE_BUILDS.md). Für den Simulator:

```bash
env FAM_HARNESS_UI=1 FAM_IOS_MLKIT_OCR=0 FAM_UPDATE_CHANNEL=development USE_CCACHE=1 \
  bun --env-file=.env.development.local run expo prebuild --no-clean --platform ios

env FAM_HARNESS_UI=1 FAM_IOS_MLKIT_OCR=0 FAM_UPDATE_CHANNEL=development \
  bun --env-file=.env.development.local run expo run:ios --scheme fam
```

Für einen bestimmten Simulator `--device "iPhone 17"` an den zweiten Befehl
anhängen. Für ein verbundenes iPhone dessen Gerätenamen oder UDID übergeben:

```bash
env FAM_HARNESS_UI=1 FAM_IOS_MLKIT_OCR=0 FAM_UPDATE_CHANNEL=development \
  bun --env-file=.env.development.local run expo run:ios --scheme fam \
  --device "<Gerätename oder UDID>"
```

`expo run:ios` kompiliert mit Xcode auf diesem Mac. Für lokale Simulator-Builds
kann Expo zusätzlich den in `app.json` aktivierten Remote-Cache prüfen; bei
einem Cache-Miss wird lokal kompiliert. iPhone-Builds werden lokal erstellt.

Falls Metro nicht bereits läuft, separat starten:

```bash
bun start
```

`ios/` bleibt generierte, ignorierte CNG-Ausgabe. Änderungen an nativen Modulen
oder Config-Plugins erfordern einen neuen Development-Build. Reine JS-/TS-
Änderungen lädt Metro neu.

## Wiederholbare iOS-Builds

Die beiden nicht-interaktiven Bun-Befehle bauen lokal und schreiben jeweils ein
vollständiges Log nach `logs/builds/`:

```bash
bun run build:simulator
bun run build:testflight -- eas
bun run build:testflight -- xcode
```

`build:simulator` verwendet das lokale EAS-Profil `development-local` und
liefert nur die fertige `.app`. Die App wird weder installiert noch gestartet.
Die EAS-Remote-Version wird vor dem Build geprüft und die tatsächliche
`CFBundleVersion` aus der fertigen App protokolliert.

`build:testflight -- eas` verwendet `preview-testflight-local`, erzeugt eine
lokale `.ipa` und übergibt genau diese Datei mit `eas submit --path` an das
Submit-Profil `preview-testflight`. `--latest` wird für lokale Builds nicht
verwendet.

`build:testflight -- xcode` verwendet den bestehenden lokalen Xcode-Ablauf mit
ML Kit, synchronisiert die Remote-Buildnummer in die nativen Targets, erzeugt
ein Release-Archiv und lädt es über `ExportOptions-upload.plist` hoch. Die
Remote-Buildnummer muss vor einem Xcode-Archiv eindeutig für diesen Upload
reserviert sein. Der Ablauf verwendet nicht stillschweigend
`app.json` als Ersatzquelle.

Erfolgreiche Logs folgen diesem Schema:

```text
logs/builds/YYYYMMDD-HHmmss-simulator-v<app-version>-b<build-number>.log
logs/builds/YYYYMMDD-HHmmss-testflight-eas-v<app-version>-b<build-number>.log
logs/builds/YYYYMMDD-HHmmss-testflight-xcode-v<app-version>-b<build-number>.log
```

Bei einem Fehler vor der Artefakterzeugung bleiben Version und Buildnummer als
`unknown` im Lognamen erhalten. Die Logs enthalten außerdem Profil, Upload-Weg,
Befehle, Artefaktpfad, Dauer, Exit-Code und redigierte Prozessausgabe.

Die Befehle benötigen macOS mit Xcode, CocoaPods, Bun, EAS-Login und den für
den jeweiligen Upload erforderlichen Apple-Credentials. Lokale EAS-Builds
können Remote-Buildnummern verbrauchen, auch wenn der anschließende Upload
fehlschlägt.
