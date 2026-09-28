# Lokale Native-Builds

Native Apps werden in diesem Projekt lokal mit Expo, Xcode und Android Gradle
gebaut. Die Befehle in dieser Anleitung werden vom Repository-Root ausgeführt.

## iOS Development-App lokal bauen

Im Repository-Root, zuerst CNG aktualisieren, dann lokal kompilieren und
installieren:

```bash
env FAM_HARNESS_UI=1 FAM_IOS_MLKIT_OCR=0 FAM_UPDATE_CHANNEL=development USE_CCACHE=1 \
  bun --env-file=.env.development.local run expo prebuild --no-clean --platform ios

env FAM_HARNESS_UI=1 FAM_IOS_MLKIT_OCR=0 FAM_UPDATE_CHANNEL=development \
  bun --env-file=.env.development.local run expo run:ios --scheme fam
```

Für einen bestimmten Simulator oder ein verbundenes iPhone dessen Namen oder
UDID an `--device` übergeben:

```bash
env FAM_HARNESS_UI=1 FAM_IOS_MLKIT_OCR=0 FAM_UPDATE_CHANNEL=development \
  bun --env-file=.env.development.local run expo run:ios --scheme fam \
  --device "<Gerätename oder UDID>"
```

Der zweite Befehl führt den Compile mit Xcode auf diesem Mac aus. `ios/` wird
von Expo als CNG-Ausgabe generiert und ist nicht eingecheckt. `--no-clean`
erhält den vorhandenen nativen Ordner samt Pods und Build-Daten.

Nach dem Prebuild kann der Dev-Shortcut mit explizitem Update-Kanal verwendet
werden:

```bash
FAM_UPDATE_CHANNEL=development bun run ios:dev
```

`bun run ios:preview` erzeugt nur eine lokale Release-Konfiguration, kein
TestFlight-Archiv. Für die Geräteeinrichtung eines iPhones den direkten
`expo run:ios --device ...`-Befehl oben verwenden.

### Google ML Kit im OCR-Inspector auf einem iPhone testen

Die normalen Development-Befehle bauen die Apple-Vision-Variante. Für Google
ML Kit muss der iPhone-Dev-Client mit `FAM_IOS_MLKIT_OCR=1` neu gebaut werden:

```bash
env FAM_HARNESS_UI=1 FAM_IOS_MLKIT_OCR=1 FAM_UPDATE_CHANNEL=development USE_CCACHE=1 \
  bun --env-file=.env.development.local run expo prebuild --no-clean --platform ios

env FAM_HARNESS_UI=1 FAM_IOS_MLKIT_OCR=1 FAM_UPDATE_CHANNEL=development \
  bun --env-file=.env.development.local run expo run:ios --scheme fam \
  --device "<iPhone-Name oder UDID>"
```

Danach im OCR-Inspector „Google ML Kit“ wählen und die Erkennung erneut
ausführen. „Ausgeführt mit“ und das kopierte JSON nennen den Anbieter des
abgeschlossenen Laufs. Die Google-ML-Kit-Konfiguration ist für ein physisches
iPhone vorgesehen; der normale Simulator-Build verwendet Apple Vision.

## iOS TestFlight-Archiv lokal erstellen

Der folgende Ablauf aktualisiert CNG, erhöht die lokale Xcode-Buildnummer und
erstellt ein signiertes Xcode-Archiv auf diesem Mac. Er verwendet weder EAS
Build noch EAS zur Versionssynchronisierung. DerivedData wird unter
`build/cache/ios/DerivedData` wiederverwendet. Das Archiv bleibt unter
`build/local/ios/` erhalten.

```bash
mkdir -p build/local/ios build/cache/ios/DerivedData
BUILD_DIR="$(mktemp -d build/local/ios/manual.XXXXXX)"

env FAM_HARNESS_UI=0 FAM_IOS_MLKIT_OCR=1 EXPO_PUBLIC_DEV_TOOLS=1 \
  EXPO_PUBLIC_USE_RN_FETCH=1 SENTRY_DISABLE_AUTO_UPLOAD=false \
  FAM_UPDATE_CHANNEL=preview-testflight USE_CCACHE=1 \
  bun run expo prebuild --no-clean --platform ios

(cd ios && agvtool next-version -all)

env FAM_UPDATE_CHANNEL=preview-testflight EXPO_PUBLIC_DEV_TOOLS=1 \
  EXPO_PUBLIC_USE_RN_FETCH=1 SENTRY_DISABLE_AUTO_UPLOAD=false FAM_IOS_MLKIT_OCR=1 \
  node_modules/.bin/dotenv -o -e .env.preview -- xcodebuild archive \
  -workspace ios/fam.xcworkspace -scheme fam -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$BUILD_DIR/fam.xcarchive" \
  -derivedDataPath build/cache/ios/DerivedData -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=SW8RP7PA3W

open -a Xcode "$BUILD_DIR/fam.xcarchive"
```

`agvtool next-version -all` erhöht die lokale `CURRENT_PROJECT_VERSION` in
Xcode. `eas.json` verwaltet die Versionsnummer für EAS unabhängig davon und
wird von diesem lokalen Ablauf nicht abgefragt. Vor dem Upload die erhöhte
Buildnummer in App Store Connect auf Eindeutigkeit prüfen. Xcode Organizer kann
das geöffnete Archiv exportieren und separat zu App Store Connect hochladen;
dafür ist ein lokal eingerichtetes Apple-Entwicklungskonto erforderlich.

## Android lokal bauen

Development-Emulator: CNG mit der Development-Umgebung aktualisieren und dann
den lokalen Expo-Runner verwenden:

```bash
FAM_HARNESS_UI=1 FAM_UPDATE_CHANNEL=development \
  bun --env-file=.env.development.local run expo prebuild \
  --no-clean --platform android
FAM_UPDATE_CHANNEL=development bun run android
```

`bun run android` startet lokal `expo run:android` und schreibt ein Lauf-Log
nach `logs/`. Für einen lokalen Android Release-Variant-Build:

```bash
FAM_HARNESS_UI=0 FAM_UPDATE_CHANNEL=preview \
  bun --env-file=.env.preview run expo prebuild --no-clean --platform android
FAM_UPDATE_CHANNEL=preview bun run android:release
```

Für eine lokale Release-APK zuerst CNG mit `.env` aktualisieren, dann den Build
explizit freigeben:

```bash
FAM_HARNESS_UI=0 FAM_UPDATE_CHANNEL=preview \
  bun --env-file=.env run expo prebuild --no-clean --platform android
bun run android:apk --approve-rebuild
```

Das APK-Skript aktualisiert standardmäßig den Android-`versionCode` in
`app.json`. `--approve-rebuild` ist ein verbliebener projektspezifischer
Freigabeschalter dieses Skripts, kein Fingerprint-Lock. Details zu gezielten
Optionen stehen in `scripts/build-android-apk.ts`.

## Grenzen der lokalen Store-Builds

Lokal dokumentiert und implementiert sind der iOS-Development-Build für
Simulator und iPhone, das iOS-TestFlight-Archiv sowie Android Development und
eine Release-APK. `bun run android:apk` erstellt eine APK,
kein Store-AAB. Dafür gibt es in den lokalen Skripten derzeit keinen
Production-Store-Befehl.

## Fingerprint und Cache

Der frühere projektinterne Fingerprint-Lock mit Baseline, Statusbefehl,
Freigabeflag und registrierten Artefakten wurde entfernt. Es gibt keine
Befehle wie `native:status`, `native:rebuild` oder `native:dev`.

`app.json` aktiviert zusätzlich Expos Build-Cache-Provider `eas` für lokale
Builds über `expo run`. Für iOS sucht Expo nur bei Simulator-Builds anhand des
Fingerprints nach einem wiederverwendbaren Binary; physische iOS-Builds nutzen
diesen Cache nicht. Android `expo run:android` prüft den Cache unabhängig vom
Gerät. Bei einem Cache-Miss kompiliert Xcode beziehungsweise Gradle lokal.
Diese Cache-Abfrage kontaktiert EAS-Server, ist aber kein EAS Build. Ein
Cache-Treffer ersetzt weder einen frischen Compile noch den Nachweis auf dem
Zielgerät.

## Update-Kanal

`FAM_UPDATE_CHANNEL` setzt in `app.config.ts` den Header
`expo-channel-name`. Er bestimmt, welchen EAS-Update-Kanal die installierte
App abfragt. Er entscheidet nicht, wo Expo/Xcode den nativen Build kompiliert.

Build-Erfolg und Geräteverhalten sind getrennte Nachweise: Native Funktionen
müssen zusätzlich auf der Zielplattform geprüft werden.
