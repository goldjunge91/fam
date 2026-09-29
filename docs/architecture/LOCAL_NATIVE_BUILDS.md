# Lokale Native-Builds

Native Apps werden in diesem Projekt lokal mit Expo, Xcode und Android Gradle
gebaut. Die Befehle in dieser Anleitung werden vom Repository-Root ausgeführt.
Nach einem frischen Clone zuerst `bun install --frozen-lockfile` ausführen.
Bun-, Expo-, CocoaPods-, Node-, EAS- und temporäre lokale Build-Caches liegen
danach unter `build/cache/`; lokale EAS-Artefakte liegen unter `build/local/`.
Auf Macs muss der Clone unter `/Volumes/Programme` liegen. CI legt dieselben
Caches relativ zum Runner-Workspace an.

## Watch-Target lokal bauen

Das Watch-Target wird zusammen mit dem iOS-Host über das `fam`-Workspace-Scheme
gebaut. Der Befehl aktualisiert CNG, installiert CocoaPods für alle Targets und
startet danach Xcode:

```bash
bun run ios:watch
```

Der Befehl läuft aus dem Repository-Root. Er baut `fam` einschließlich der
expliziten Watch-Abhängigkeit und prüft, dass sowohl `fam.app` als auch
`watch.app` erzeugt wurden. DerivedData, Modul-Caches, temporäre Dateien,
CocoaPods-Cache und Build-Ergebnis liegen unter `build/cache/`.

## iOS lokal bauen

Die kurzen Befehle erledigen CNG-Prebuild und CocoaPods-Installation selbst.
`ios/` bleibt generierter CNG-Code und wird bei jedem Lauf mit `--no-clean`
aktualisiert:

```bash
bun run start
bun run ios
bun run ios:dev
bun run ios:preview
bun run ios:watch
```

Für einen vollständigen Neuaufbau des iOS-Hosts samt Siri, Watch und Widgets:

```bash
bun run ios --clean --no-build-cache --device generic
```

Der Wrapper führt `expo prebuild --clean`, CocoaPods-Installation und danach
`expo run:ios --scheme fam` aus. Das `fam`-Scheme baut seine Siri-, Watch- und
Widget-Abhängigkeiten mit. `--device generic` kompiliert für den Simulator,
ohne ein Gerät zu starten oder die App zu installieren. Das Config-Plugin setzt
`CODE_SIGNING_ALLOWED=YES` für die generierten Host- und Extension-Targets, weil
Expo rohe Xcode-Buildsettings nicht als `run:ios`-Argumente weiterreicht.

`ios` und `ios:dev` bauen und installieren den Development-Client mit Expo.
`ios:preview` verwendet `.env.preview` und eine lokale Release-Konfiguration;
es erstellt kein signiertes Store-Archiv. `ios:watch` baut das `fam`-Scheme,
prüft das Host-App-Produkt sowie `watch.app` und schreibt alle Xcode-Ausgaben
unter `build/cache/ios/watch-build/`.

### Google ML Kit im OCR-Inspector auf einem iPhone testen

Die normalen Development-Befehle bauen die Apple-Vision-Variante. Für Google
ML Kit den iPhone-Dev-Client so neu bauen und starten:

```bash
bun run ios:mlkit -- --device "<iPhone-Name oder UDID>"
```

Danach im OCR-Inspector „Google ML Kit“ wählen und die Erkennung erneut
ausführen. „Ausgeführt mit“ und das kopierte JSON nennen den Anbieter des
abgeschlossenen Laufs. Die Google-ML-Kit-Konfiguration ist für ein physisches
iPhone vorgesehen; der normale Simulator-Build verwendet Apple Vision.

## iOS Release- und TestFlight-Builds

Die lokalen EAS-Profile verwenden dieselben Konfigurationen wie Cloud-EAS,
überschreiben aber `autoIncrement` auf `false`, damit lokale Builds die remote
verwaltete Buildnummer nicht ändern. EAS-Arbeitsordner und Artefakte bleiben im
Repo:

```bash
bun run eas:ios:simulator:local
bun run eas:ios:testflight:local
bun run eas:ios:production:local
```

Der lokale TestFlight-/Release-Build benötigt Expo-Zugang und die in EAS
hinterlegten iOS-Zugangsdaten. Die IPA wird in
`build/local/eas/preview-testflight-local/` abgelegt.

Cloud-Builds laufen auf der EAS-Infrastruktur und nutzen die regulären
versionserhöhenden Profile:

```bash
bun run eas:ios:simulator
bun run eas:ios:testflight
bun run eas:ios:production
```

`eas.json` verwendet für alle Profile denselben CNG-Prebuild-Befehl. Der
`withIosSimulatorArm64`-Config-Plugin ergänzt beim Pod-Install den direkten
Xcode-Target-Dependency-Pfad vom Siri-Target zu seinem CocoaPods-Aggregat.
Lokale EAS-, Cloud-EAS- und CI-Builds verwenden denselben Config-Plugin-Pfad;
der CI-Simulator-Build ruft `bun run ios:watch` als kanonischen Prebuild-,
Pods- und Xcode-Ablauf auf.

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
