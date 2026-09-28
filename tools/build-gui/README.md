# fam Builds

Die Tk-GUI startet lokale Expo/Xcode-Aktionen und EAS-Befehle. Sie verwaltet
keine Fingerprints, Baselines oder Artefakt-Locks.

## Abläufe

- **iOS Development Simulator → Lokal bauen: Simulator** führt
  `expo prebuild --no-clean` und `expo run:ios` aus. Die generierten
  `ios/Pods` bleiben im Projekt liegen. Expo/Xcode verwenden ihre vorhandenen
  lokalen Build-Daten wieder.
- **iOS TestFlight → Lokal bauen: TestFlight-Archiv** aktualisiert CNG mit
  `--no-clean`, synchronisiert danach die entfernte EAS Build-Nummer und
  erstellt ein Xcode-Archiv samt IPA. Xcode
  verwendet dauerhaft `build/cache/ios/DerivedData`; das Archiv und die IPA
  liegen pro Lauf separat unter `build/local/ios/<Zeitstempel>/`. Frühere
  Archive und Caches werden nicht gelöscht. Das Plugin `withIosCcacheDir`
  verwendet weiter den in der ccache-Konfiguration gesetzten externen Cache.
- **TestFlight hochladen: EAS** sendet die IPA des letzten lokalen Archivs mit
  `eas submit --path ...`.
- **TestFlight hochladen: Xcode** öffnet dasselbe `.xcarchive` mit Xcode. Im
  Organizer kann es geprüft und zu App Store Connect hochgeladen werden.
- **EAS Build starten** startet einen Cloud-Build mit dem ausgewählten EAS-Profil.
- **OTA-Update veröffentlichen** nutzt den Channel und die EAS-Umgebung des
  gewählten Ziels und setzt `FAM_UPDATE_CHANNEL` passend für `app.config.ts`.
  Eine Beschreibung ist erforderlich.
- **Letzten Simulator-Build installieren** installiert den letzten passenden
  EAS-Build.

Die lokale TestFlight-Signierung nutzt Xcodes automatische Signierung und den
Apple-Developer-Account, der in Xcode eingerichtet ist. EAS Submit braucht eine
EAS-Anmeldung. Für EAS Cloud-Builds und OTA ebenfalls.

## Start

```bash
python3 tools/build-gui/build_gui.py
```
