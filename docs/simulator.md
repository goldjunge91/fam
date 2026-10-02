# iOS Simulator

Development-Build lokal über Expo/Xcode erstellen und starten. Vollständige
Befehle für Simulator, echtes iPhone und TestFlight stehen in der
[Build-Anleitung](architecture/LOCAL_NATIVE_BUILDS.md). Für den Simulator:

```bash
env FAM_HARNESS_UI=1 FAM_IOS_MLKIT_OCR=1 FAM_UPDATE_CHANNEL=development USE_CCACHE=1 \
  bun --env-file=.env.development.local run expo prebuild --no-clean --platform ios

env FAM_HARNESS_UI=1 FAM_IOS_MLKIT_OCR=1 FAM_UPDATE_CHANNEL=development \
  bun --env-file=.env.development.local run expo run:ios --scheme fam
```

Für einen bestimmten Simulator `--device "iPhone 17"` an den zweiten Befehl
anhängen. Für ein verbundenes iPhone dessen Gerätenamen oder UDID übergeben:

```bash
env FAM_HARNESS_UI=1 FAM_IOS_MLKIT_OCR=1 FAM_UPDATE_CHANNEL=development \
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
