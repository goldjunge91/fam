# Native Build Lock GUI

Die GUI ist ein Frontend für `scripts/native-build.ts`. Sie ruft keine direkten
`eas build`, `expo prebuild`, CocoaPods- oder Xcode-Befehle für den normalen Start auf.

## Aktionen

- `Lock prüfen` validiert Native-Fingerprint, Artefakt und SHA-256.
- `Mismatch zurückführen (prüfen)` startet automatisch den Fingerprint-Diff. Bei
  einem echten Mismatch wählt die GUI danach den Rebuild vor, lässt ihn aber
  erst nach der ausdrücklichen Checkbox-Freigabe starten.
- `Lock-Diff anzeigen` zeigt denselben Diff ohne den Rebuild-Schritt.
- `Dev-Loop starten` verwendet für Development-Targets `native:dev`, setzt beim
  iOS-Simulator den lokalen Packager-Host und übergibt das ausgewählte Gerät.
  Der Lock-Mismatch wird sichtbar geloggt, blockiert den Inner Loop aber nicht.
- `Simulator/Emulator starten` verwendet ausschließlich das bereits gelockte Artefakt (iOS-Simulator-`.app` bzw. Android-Emulator-APK).
- Das Ziel-Dropdown listet iOS- und Android-Targets getrennt (`iOS Development`, `iOS Preview-Simulator`, `iOS TestFlight`, `iOS Production`, `Android Development`, `Android Preview`, `Android Production`); `TestFlight hochladen` bleibt iOS-spezifisch, da für Android aktuell kein `eas submit`-Profil hinterlegt ist.
- Für `iOS TestFlight` kann `Letzten EAS-Build prüfen` die aktuelle EAS-Build-ID,
  den Status und die Metadaten anzeigen. `Letzten TestFlight-Build
  wiederherstellen` fragt die ID bei Bedarf automatisch ab und verwendet danach
  den bestehenden `native:restore`-Pfad.
- TestFlight-IPAs werden niemals als Simulator-Artefakte angeboten. Ein
  Simulator benötigt ein eigenes `ios-development-simulator`- oder
  `ios-preview-simulator`-Artefakt.
- `Artefakt wiederherstellen` lädt ein Artefakt über die gespeicherte oder eingegebene EAS Build-ID.
- `Rebuild (explizit freigeben)` ist die einzige GUI-Aktion, die Prebuild, CocoaPods und Kompilierung ausführt. Sie benötigt zusätzlich die Checkbox-Freigabe.
- `TestFlight hochladen` übermittelt ein vorhandenes IPA, ohne einen neuen Build zu starten.

Ein fehlendes oder nicht zum Fingerprint passendes Artefakt führt beim
gesperrten Start zu einem Fehler. Der Development-Loop ist davon getrennt und
kompiliert über `native:dev` inkrementell, wenn das ausgewählte Development-
Target noch gebaut werden muss.

## Logs und Metriken

Jeder GUI-Lauf wird vollständig nach `tools/build-gui/logs/` geschrieben. Die
Anzeige kann zwischen allen Zeilen, Fehlern/Warnungen, Build-Phasen und Aktionen
umschalten. Abgeschlossene Läufe werden zusätzlich in `.build-metrics/gui-runs.jsonl`
gespeichert und beim nächsten GUI-Start wieder in der Laufhistorie angeboten.
Mit `Log öffnen` lässt sich der vollständige Lauf direkt im macOS-Standardeditor
öffnen. Nach einem fehlgeschlagenen iOS-Lauf liest die GUI zusätzlich die von
Expo erzeugten `.expo/xcodebuild-error.log` und `.expo/xcodebuild.log`, zeigt die
relevanten Compilerfehler dedupliziert an und nennt den ersten Root-Cause-Fehler.
Nur Logs, die während des aktuellen Laufs aktualisiert wurden, werden verknüpft.

Zusätzlich schreibt die GUI pro Lauf eine JSONL-Zeile nach
`.build-metrics/gui-runs.jsonl` mit Target, Aktion, Fingerprint, Laufzeit,
Exit-Code, Logpfad sowie den gefundenen Xcode-Rohlogs und Fehlerauszügen. Die
vorhandene `scripts/build-timer.ts`-Metrik bleibt davon getrennt und misst
weiterhin explizit gestartete Build-Kommandos.

Start aus dem Projektroot:

```bash
python3 tools/build-gui/build_gui.py
```
