# Native Build Lock GUI

Die GUI ist ein Frontend für `scripts/native-build.ts`. Sie ruft keine direkten
`eas build`, `expo prebuild`, CocoaPods- oder Xcode-Befehle für den normalen Start auf.

## Aktionen

- `Lock prüfen` validiert Native-Fingerprint, Artefakt und SHA-256.
- `Simulator/Emulator starten` verwendet ausschließlich das bereits gelockte Artefakt (iOS-Simulator-`.app` bzw. Android-Emulator-APK).
- Das Ziel-Dropdown listet iOS- und Android-Targets getrennt (`iOS Development`, `iOS Preview-Simulator`, `iOS TestFlight`, `iOS Production`, `Android Development`, `Android Preview`, `Android Production`); `TestFlight hochladen` bleibt iOS-spezifisch, da für Android aktuell kein `eas submit`-Profil hinterlegt ist.
- `Artefakt wiederherstellen` lädt ein Artefakt über die gespeicherte oder eingegebene EAS Build-ID.
- `Rebuild (explizit freigeben)` ist die einzige GUI-Aktion, die Prebuild, CocoaPods und Kompilierung ausführt. Sie benötigt zusätzlich die Checkbox-Freigabe.
- `TestFlight hochladen` übermittelt ein vorhandenes IPA, ohne einen neuen Build zu starten.

Ein fehlendes oder nicht zum Fingerprint passendes Artefakt führt zu einem Fehler. Es
gibt keinen automatischen Kompilierungs-Fallback.

Start aus dem Projektroot:

```bash
python3 tools/build-gui/build_gui.py
```
