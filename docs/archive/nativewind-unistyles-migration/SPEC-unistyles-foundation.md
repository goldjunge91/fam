# Modul-Spec: unistyles-foundation

Status: bereit für Implementierung
Beads: `fam-978.4` bis `fam-978.6`
Abhängigkeiten: `migration-contract`

## Objective

Unistyles v3 wird auf dem vorhandenen Expo-SDK-57-/React-Native-0.86-Stack
reproduzierbar integriert. Die Foundation stellt die Runtime bereit, ohne die
noch nicht migrierten Verbraucher vorzeitig zu brechen.

## Source- und Kompatibilitätsprüfung

Vor jeder Dependency- oder Native-Änderung werden die offiziellen Unistyles-v3-
Quellen und die versionierten Expo-SDK-57-Dokumente geprüft. Festzuhalten sind:

- exakte `react-native-unistyles`-Version und Peer-Kompatibilität mit React 19,
  React Native 0.86, Reanimated 4 und `react-native-nitro-modules`;
- Babel-Plugin, Importpfad und erforderliche Initialisierungsreihenfolge;
- New-Architecture-Annahme und der aktuelle Repository-Zustand;
- `react-native-edge-to-edge`-Erfordernis für Android und die passende
  Expo-/Config-Plugin-Konfiguration;
- repo-konforme Installation mit `bun`, Lockfile-Ergebnis und native
  Fingerprint-Auswirkung.

Unbestätigte Versions- oder Config-Annahmen werden nicht in Produktionscode
überführt.

### Verifizierte Werte (fam-978.4, 2026-09-13)

Quellen: lokale Unistyles-Docs unter
`docs/react-native-unistyles/v3/start/getting-started.mdx` und
`docs/react-native-unistyles/v3/start/configuration.mdx`, npm-Registry.

| Prüfpunkt | Ergebnis | Status |
| --- | --- | --- |
| `react-native-unistyles` Version | `3.3.0` (latest) | ✓ |
| `react-native-nitro-modules` Version | `^0.37.0` (Projekt), latest `0.37.1` — Pin auf `0.37.1` für fam-978.5 | ✓ |
| RN Mindestversion | `>=0.78.0`, Projekt: `0.86.3` | ✓ |
| Expo SDK Mindestversion | `53+`, Projekt: `~57.0.19` | ✓ |
| New Architecture | **Pflicht** (Fabric). `newArchEnabled` im Projekt: `not set` — muss in `app.json` auf `true` gesetzt werden | ⚠ Aktion nötig |
| `react-native-edge-to-edge` | Optional seit v3.1.0. Empfehlung: `edgeToEdgeEnabled=true` in `android/gradle.properties`. Expo SDK 54+ aktiviert es automatisch — bei SDK 57 prüfen | ⚠ prüfen |
| Babel-Plugin | `['react-native-unistyles/plugin', { root: 'src' }]` — aktuelles `babel.config.js` hat noch kein Unistyles-Plugin | Aktion in fam-978.5 |
| Metro | Kein neuer allgemeiner Adapter erforderlich | ✓ |
| Expo-Router Einstiegspunkt | `package.json` `"main": "expo-router/entry"` → muss auf `"main": "index.ts"` umgestellt werden; `index.ts` importiert `expo-router/entry` + `./unistyles` | Aktion in fam-978.5 |
| Initialisierungsreihenfolge | `StyleSheet.configure` in `src/components/theme/index.ts` muss vor jedem `StyleSheet.create`-Aufruf laufen | Aktion in fam-978.7 |
| Install-Befehl | `bun add react-native-unistyles@3.3.0 react-native-nitro-modules@0.37.1` — nitro-modules ist bereits im Projekt, Update auf gepinnte Version | fam-978.5 |
| Native Rebuild | `expo prebuild --clean` nach Installation wegen Nitro-Modules-Native-Code; Dev-Client-Rebuild zwingend | fam-978.6 |

#### New Architecture Detail

Expo SDK 57 setzt New Arch nicht automatisch voraus. Für fam-978.5 muss
`"newArchEnabled": true` in `app.json` unter `expo` ergänzt werden.
Alternativ wird der Wert in `app.config.ts` gesetzt, falls eine solche Datei
eingeführt wird — das Projekt hat aktuell nur `app.json`.

#### Edge-to-Edge Detail

`android/gradle.properties` ist im Projekt noch nicht vorhanden (kein
generiertes `android/`-Verzeichnis im Repo). Die Einstellung wird beim nächsten
`expo prebuild` in der generierten `android/gradle.properties` gesetzt.
Expo SDK 54+ setzt `edgeToEdgeEnabled=true` automatisch — da SDK 57 verwendet
wird, ist dies im prebuild-Output zu verifizieren (fam-978.6).

## Zielaufbau

- `package.json` und `bun.lock` führen Unistyles in der verifizierten Version.
- `babel.config.js` aktiviert die v3-Integration gemäß offizieller Quelle.
- `metro.config.js` enthält keinen neuen allgemeinen Adapter. Eine temporäre
  Legacy-Verbindung bleibt nur so lange bestehen, wie Verbraucher sie brauchen.
- `src/components/theme/index.ts` besitzt die einzige `StyleSheet.configure`-
  Stelle. Eine zusätzliche globale Theme-Datei ist nicht zulässig.
- Native Artefakte werden über den bestehenden Expo-/Build-Workflow erzeugt,
  nicht durch handgeschriebene Ersatzdateien.

## Übergang

Die Foundation darf Unistyles und die alte Runtime kurzfristig gleichzeitig
auflösen. Diese Übergangsgrenze ist zeitlich auf die Verbraucher-Migration
begrenzt. Keine neue Komponente darf währenddessen NativeWind erweitern.

## Success Criteria

1. Die Version und alle Peer-/Native-Annahmen sind gegen Primärquellen belegt.
2. Ein minimaler Unistyles-Import und eine konfigurierte StyleSheet-Auflösung
   sind in der Expo-/Jest-Toolchain reproduzierbar.
3. Der native Fingerprint-Diff ist absichtlich und dokumentiert.
4. Kein bestehender Verbraucher verliert durch die Foundation allein seine
   laufende Funktion.

## Verification

- fokussierter Config-/Import-Test oder reproduzierbarer Metro-/Typecheck-
  Nachweis;
- `bun run check` und `bun run typecheck`;
- `bun run native:status -- --diff`;
- erforderlicher Dev-Client-Rebuild nach Dependency-/Native-Änderung.
