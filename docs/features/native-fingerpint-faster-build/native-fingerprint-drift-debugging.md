# Native-Fingerprint-Drift (ios) — Debugging & Root Cause

## Symptom

`bun run native:status` (bzw. die Native-Build-Lock-GUI, `tools/build-gui/build_gui.py`) meldet einen ios-Fingerprint-Mismatch, obwohl `app.json`, `package.json`, `bun.lock` und alle git-getrackten Dateien unter `ios/`/`android/` byte-identisch zum Baseline-Commit sind:

```
Native Build Lock: ios-Fingerprint stimmt nicht mit dem Lock überein. Native Änderung,
Config-/Dependency-Änderung oder falsche Baseline erkannt.
Erwartet: cb526d17…, aktuell: 6166b126…
```

## GELÖST (2026-08-30)

**Root Cause:** `ios/fam.xcodeproj/project.xcworkspace/` — ein Verzeichnis, das Xcode automatisch beim Öffnen des `.xcodeproj` lokal neu erzeugt (nicht zu verwechseln mit dem regulär getrackten `ios/fam.xcworkspace/`). Es war:

- nicht in `.gitignore` gelistet,
- nicht in `.fingerprintignore` gelistet,
- und wurde von `@expo/fingerprint`s eingebauten `DEFAULT_IGNORE_PATHS` **nicht** erfasst, obwohl ein ähnlich aussehendes Pattern das vermuten ließ.

Jeder Entwickler, der das Projekt lokal in Xcode öffnet, erzeugt diesen Ordner neu → der Fingerprint driftet → der Lock-Mechanismus schlägt Alarm, obwohl sich kein Code geändert hat.

### Wie es gefunden wurde

Datei-für-Datei-Diffs gegen den Baseline-Commit reichten nicht (alles war identisch). Der entscheidende Schritt war, `@expo/fingerprint`s eigene Diff-API zu nutzen statt weiter zu raten:

1. Isolierten `git worktree` exakt auf dem Baseline-Commit angelegt, dort `bun install` laufen lassen → Fingerprint berechnet → ergab **exakt** den erwarteten Hash. Damit war klar: die Baseline selbst ist korrekt, der Unterschied liegt lokal.
2. Vollen Fingerprint (mit `debug: true`, alle Einzel-Quellen inkl. ihrer Hashes) aus beiden Ständen gespeichert und mit `diffFingerprints()` verglichen. Der Diff zeigte exakt einen echten Unterschied: den oben genannten Ordner.

### Fix

1. `.gitignore`: `ios/fam.xcodeproj/project.xcworkspace/` und `ios/fam.xcodeproj/xcuserdata/` ergänzt.
2. `.fingerprintignore`: dieselben Pfade ergänzt (Gitignore allein reicht **nicht** — `@expo/fingerprint` scannt das Dateisystem unabhängig davon).
3. `bun run native:baseline -- --approve-rebuild` einmalig ausgeführt → `native-build-lock.json` mit neuen, korrekten ios-/android-Hashes aktualisiert.
4. Verifiziert: erneuter `diffFingerprints()`-Lauf zeigte danach keine relevante Abweichung mehr.

Bestehende gelockte Artefakte (z. B. `ios-development-simulator`) galten danach als veraltet und brauchten einen echten Rebuild — das ist erwartetes Verhalten des Lock-Mechanismus, kein neuer Bug.

### Verifiziert per echtem Rebuild

`bun run native:rebuild -- --target ios-development-simulator --approve-rebuild` erfolgreich durchgelaufen (`Build Succeeded`, Artefakt neu gelockt unter `native-artifacts/ios-development-simulator/fam.app`). Anschließender `native:status`-Lauf bestätigt:

```
Native Build Lock: Native Baseline ist unverändert.
Native Build Lock: Artefakt gültig: ios-development-simulator
```

Andere, bereits vorher registrierte Targets (z. B. `ios-preview-testflight`) zeigen weiterhin `... gehört zu einem anderen Fingerprint` — erwartungsgemäß, da die Baseline-Änderung **alle** vorher gelockten Artefakte betrifft, nicht nur das gerade neu gebaute. Sie brauchen bei Bedarf denselben Rebuild- bzw. Restore-Schritt.

### Exakter Mechanismus (unabhängig nachverifiziert)

`isIgnoredPath()` aus `@expo/fingerprint` gegen die echten `DEFAULT_IGNORE_PATHS` getestet:

- Das Pattern `'**/ios/**/project.xcworkspace'` hat **kein** abschließendes `/**` und matcht deshalb nur das Verzeichnis selbst, nicht die Dateien darin (`contents.xcworkspacedata`, `xcshareddata/IDEWorkspaceChecks.plist` landeten trotzdem im Fingerprint).
- Das Pattern `'**/ios/*.xcworkspace/xcuserdata/**/*'` verlangt ein `ios/<name>.xcworkspace/` auf oberster Ebene und greift bei `fam.xcodeproj/xcuserdata/` nicht.

Nach dem Fix sind beide Pfade nicht mehr unter den Fingerprint-Sources.

Ebenfalls bestätigt (`sourcer/Bare.js:74`): `.gitignore` wird von `@expo/fingerprint` nur als Hash-Quelle (`bareGitIgnore`) eingelesen, **nie** als Ignore-Regel ausgewertet. Der `.fingerprintignore`-Eintrag ist also zwingend zusätzlich nötig — und jede `.gitignore`-Änderung verändert selbst den Fingerprint.

### Timing-Falle beim Baselinen

Fingerprint erst messen, wenn `prebuild` **und** `pod install` fertig sind. Am 2026-08-30 wurde ein Fingerprint mitten im Prebuild, noch ohne aktualisierte `Podfile.lock`, in den Lock geschrieben und war zwei Minuten später bereits wieder falsch (nachdem `pod install` die `Podfile.lock` geschrieben hatte). Zusätzlich: `baseline()` lässt `lock.artifacts` unverändert — dadurch zeigen bereits registrierte Artefakte danach auf einen alten Fingerprint, und `native:status` schlägt für sie weiterhin fehl, bis sie neu gebaut/registriert werden.

## Vorgehen bei einem erneuten Mismatch

**Nicht** wieder bei `.fingerprintignore`-Inhalt, Env-Loading oder Node-vs-Bun-Runtime raten — das ist bereits ausgeschlossen (siehe Ausschlussverfahren unten). Stattdessen direkt:

1. Isolierten `git worktree` auf dem letzten bekannten Baseline-Commit anlegen.
2. Dort `bun install` + vollen Fingerprint (`createFingerprintAsync(root, { platforms: ['ios'], debug: true })`) speichern.
3. Denselben Snapshot im Hauptarbeitsverzeichnis erzeugen.
4. `diffFingerprints()` beide vergleichen (Sources vorher nach `hash` sortieren — die Funktion setzt sortierte Arrays voraus).

Das liefert in Minuten die exakte abweichende Quelle statt eines stundenlangen Ausschlussverfahrens.

**Sinnvolle Folgeidee (noch nicht umgesetzt):** `native:status` um genau diesen Diff-Mechanismus erweitern, damit ein Mismatch die abweichende Quelle sofort mit ausgibt statt nur "stimmt nicht überein". Dafür müsste der volle Fingerprint (nicht nur der Hash-String) in `native-build-lock.json` mitgespeichert werden.

## Fortsetzung (2026-08-30, Fastpath-Plan Phase 0–2)

Restarbeit aus `docs/native-fingerprint-fastpath-plan.html` (Phase 1) abgearbeitet:

- **Diff-Werkzeug gebaut** (`bun run native:status -- --diff`): `scripts/native-build.ts` speichert bei jedem `native:baseline`/`native:rebuild` einen vollen Fingerprint-Snapshot (alle Sources inkl. Hashes, `debug: true`) nach `.native-fingerprint-cache/<platform>.json` (gitignored, maschinenlokal). Bei einem Mismatch vergleicht `--diff` diesen Snapshot per `diffFingerprints()` gegen den aktuellen Stand und nennt die abweichende Quelle direkt — kein Ausschlussverfahren mehr nötig für den Fall "gleiche Maschine, Snapshot vorhanden".
- **Veraltete Artefakteinträge entfernt statt als Dauerfehler stehen zu lassen**: `.gitignore`/`package.json` wurden im Zuge dieser Arbeit geändert (beide sind Fingerprint-Quellen) und haben den Hash erwartungsgemäß erneut verschoben. Beide bisher registrierten Artefakte (`ios-development-simulator`, `ios-preview-testflight`) zeigten danach auf einen veralteten Fingerprint. Die physischen Dateien unter `native-artifacts/` (gitignored) bleiben unangetastet; nur die Lock-Einträge wurden entfernt (`native-build-lock.json` → `"artifacts": {}`). Re-Registrierung bei Bedarf über `native:rebuild` bzw. `native:restore`.
- **Baseline neu geschrieben** über `bun run native:baseline -- --approve-rebuild` — reine Fingerprint-Berechnung, kein Build.
- **Inner-Loop-Pfad ergänzt** (`bun run native:dev -- --target <dev-target>`, Phase 2): läuft über `expo run:ios`/`expo run:android` statt `eas build --local`, ohne `prebuild --clean`. Ein Baseline-Mismatch blockiert dort nicht mehr hart, sondern wird nur als Warnung ausgegeben (`warnOnBaselineMismatch()`) — der Lock bleibt für `native:rebuild`/`native:run`/CI weiterhin hart.
- **Zeitmessung angelegt** (`scripts/build-timer.ts`, `bun run build:timer -- --class <A|B|B'|C> --target <target> -- <befehl>`): schreibt Dauer + Kontext (Fingerprint, Git-SHA, ccache-Delta) nach `.build-metrics/builds.jsonl` (gitignored). Phasenaufteilung (prebuild/podInstall/compile/install) ist noch nicht verdrahtet — offener Folgeschritt.

**Nicht ausgeführt:** die eigentlichen Baseline-Messläufe (3× kalt, 3× warm je Plattform, Phase-0-Abnahmekriterium) und ein echter `native:dev`-Testlauf. Beides braucht reale, mehrminütige native Builds auf dem Zielrechner — bewusst nicht aus einer Hintergrund-Session heraus gestartet.

## Fortsetzung (2026-08-30, Phase 3 ohne Messung)

Auf ausdrücklichen Wunsch ("fahre fort ohne Messung") Phase 3 des Plans so weit wie ohne echten Build und ohne neue native Dependency möglich umgesetzt:

- **B5 ccache verdrahtet**: `USE_CCACHE=1` wird jetzt für `pod install` und `eas build --local` (iOS) sowie für `native:dev` (iOS) gesetzt (`iosBuildEnv()` in `scripts/native-build.ts`). Das ist die im Plan explizit genannte pragmatische Variante (Env-Var statt `expo-build-properties`-Plugin) — Letzteres ist keine installierte Dependency und würde einen Dev-Client-Rebuild erzwingen (AGENTS.md: native Dependencies immer melden, nie still installieren), daher bewusst nicht hinzugefügt.
  - Nebenbefund beim Lesen von `ios/fam.xcodeproj/project.pbxproj`: der App-Target-Compiler ist für Debug bereits über `CC`/`CXX`/`LD`/`LDPLUSPLUS` auf `react-native/scripts/xcode/ccache-clang(++).sh` verdrahtet (RN-eigener Mechanismus, unabhängig vom Podfile). Die Lücke betraf also nur die CocoaPods-Kompilierung (`ccache_enabled?()` in `ios/Podfile`), nicht den App-Code selbst.
- **B6 Android-ABI reduziert, nur für den Inner Loop**: `native:dev` setzt `ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a` als Env-Var (Gradle liest `ORG_GRADLE_PROJECT_*` automatisch als Projekt-Property) — offiziell dokumentierter Override-Mechanismus, keine Änderung an `android/gradle.properties` nötig. Die globale 4-ABI-Matrix bleibt für `native:rebuild`/Release-Targets unverändert.
- **B6 Gradle-Cache & Heap dauerhaft gemacht**: neues Config-Plugin `plugins/withAndroidGradleTuning.js` (nutzt `expo/config-plugins` → `withGradleProperties`, keine neue Dependency) setzt `org.gradle.caching=true` und hebt `org.gradle.jvmargs` von `-Xmx2048m` auf `-Xmx6144m -XX:MaxMetaspaceSize=1024m` — übersteht damit `expo prebuild --clean` (B8), anders als eine direkte Bearbeitung von `android/gradle.properties`. Das aktuell eingecheckte `android/gradle.properties` wurde zusätzlich direkt gespiegelt, damit der Effekt auch ohne Rebuild sofort gilt. `org.gradle.configuration-cache` bewusst **nicht** gesetzt — RN-Plugin-Kompatibilität ist laut Plan noch nicht verifiziert, das braucht einen echten Testbuild.
- **B7 aufgeräumt**: `EXPO_USE_PRECOMPILED_MODULES=1` aus `scripts/native-build.ts` entfernt (redundant, der generierte Podfile setzt es selbst; seit SDK 56 ohnehin Default).
- **Debug-Build-Settings verifiziert statt geändert**: `ONLY_ACTIVE_ARCH=YES` steht im Debug-Target bereits; `DEBUG_INFORMATION_FORMAT` ist in Debug nicht explizit gesetzt und fällt damit bereits auf Xcodes eigenen Default (`dwarf`) zurück. Kein manueller `project.pbxproj`-Eingriff nötig oder vorgenommen.
- **Precompiled Modules verifiziert statt angenommen**: kein Package/keine Config setzt `ios.buildReactNativeFromSource` oder einen `autolinking.ios.buildFromSource`-Override — `Podfile.properties.json` bestätigt den Precompiled-Pfad ist aktiv.
- Baseline nach den Config-/Plugin-Änderungen erneut mit `native:baseline -- --approve-rebuild` geschrieben (reine Fingerprint-Berechnung).

**Weiterhin offen, braucht einen echten Build:** `org.gradle.configuration-cache` (Kompatibilität testen), alle Phase-0-Messungen, ein realer `native:dev`-Lauf zur Verifikation der ccache-/ABI-Env-Vars.

## Phase-0-Messung iOS (2026-08-30, echte Läufe)

Auf Wunsch echte `native:dev`-Läufe gegen den Simulator gefahren und mit `scripts/build-timer.ts` gemessen (`.build-metrics/builds.jsonl`, 11 Zeilen). Zentraler Methodik-Befund dabei: **`expo run:ios` fragt den EAS-Build-Cache-Provider vor jedem lokalen Build ab, unabhängig vom lokalen `DerivedData`-/`Pods`-Zustand.** Solange der Fingerprint unverändert bleibt, liefert das immer einen Cache-Hit (Download statt Compile) — ein manuelles `rm -rf DerivedData` + `rm -rf ios/Pods && pod install` reicht **nicht**, um einen echten Kaltbau zu erzwingen.

`--no-build-cache` (laut `expo run:ios --help`: "Clear the native derived data before building") wurde geprüft und **löst das nicht**: im Quellcode (`@expo/cli/src/run/ios/runIosAsync.ts`, `utils/build-cache-providers/index.js`) steuert der Flag nur `options.buildCache`, das ausschließlich beim tatsächlichen `xcodebuild`-Aufruf verwendet wird (lokales DerivedData). Der Remote-Lookup `resolveBuildCache()` wird davon komplett unabhängig aufgerufen, sobald `buildCacheProvider` in `app.json` gesetzt ist — auch mit `--no-build-cache` blieben alle 3 wiederholten „Kalt"-Läufe Cache-Hits (120s/135s/121s). Einzige bekannte Möglichkeit für eine echte Klasse-C-Messung: `buildCacheProvider` in `app.json` temporär entfernen (nicht durchgeführt — siehe Ergebnis-Tabelle, bewusst auf Nutzerentscheidung verzichtet zugunsten des einen bereits vorliegenden echten Datenpunkts).

Trotzdem ergab sich durch einen Fingerprint-Wechsel (Datei-Touch in `ios/fam/AppDelegate.swift` für einen als „warm" gedachten Lauf) ein echter Kaltbau, weil DerivedData zu dem Zeitpunkt ohnehin leer war (kein lokaler Build hatte seit dem Cold-Reset stattgefunden). Dieser eine Lauf ist damit der einzige valide Klasse-C-Näherungswert der Serie.

| ts (UTC) | geplante Klasse | totalMs | tatsächlich | gültig als |
|---|---|---:|---|---|
| 16:28 | B' | 132199 | Cache-Hit, kein nativer Diff | Klasse B (Fingerprint unverändert) |
| 16:32 | B' | 159540 | Cache-Hit, Simulator komplett neu gebootet | Klasse B |
| 16:40–16:45 | C ×3 | 104826 / 99628 / 115151 | Cache-Hit trotz `rm -rf DerivedData`+Pods | **ungültig als Klasse C** |
| 16:47 | B' | **706792** | Fingerprint geändert (AppDelegate-Touch), kein Cache-Match, DerivedData leer → echter Vollcompile | **einziger valide Klasse-C-Näherungswert** |
| 16:59 | B' | 230952 | echtes Inkrement, DerivedData warm von 16:47 | Klasse B' (gültig) |
| 17:03 | B' | 180392 | echtes Inkrement, DerivedData warm | Klasse B' (gültig) |
| 17:07–17:11 | C ×3 (`--no-build-cache`) | 119967 / 135137 / 121251 | wieder Cache-Hit, Flag wirkungslos für Remote-Lookup | **ungültig als Klasse C** |

**Ergebnis gegen die Zielbudgets:**
- Klasse B (Cache-Hit, Ziel < 90s): 132s / 159s — **über Budget**, vermutlich weil Metro-Bundler-Start + Simulator-Boot mit in die Gesamtzeit einfließen, nicht nur der reine Download/Install.
- Klasse B' (echtes Inkrement, Ziel < 120s): 231s / 180s — ebenfalls über Budget, aber deutlich schneller als der Vollcompile.
- Klasse C (Ziel < 8 min): 706.8s ≈ 11.8 Min — über Budget, einziger valider Datenpunkt, n=1.

**Phase-0-Abnahmekriterium weiterhin nicht erfüllt**: gefordert sind 3 kalte + 3 warme Läufe je Plattform mit voller Phasenaufteilung. Vorhanden: 1 validierter Kalt-Näherungswert (kein sauberer Kalt-Reset, da EAS-Cache das erzwingt), 4 gültige Warm/B-Datenpunkte, keine Android-Daten, keine Phasenaufteilung (`phases: {}` weiterhin leer). Für belastbare 3× kalt bräuchte es entweder das temporäre Entfernen von `buildCacheProvider` aus `app.json` (mit Baseline-Sync davor/danach) oder drei unterschiedliche, echte Fingerprint-Änderungen.

`native:dev`s `--no-build-cache`-Flag bleibt trotzdem im Code (nützlich zum gezielten Leeren von lokalem DerivedData), der Code-Kommentar wurde korrigiert, um die falsche Annahme nicht zu wiederholen.

## ccache zeigte 0 Hits — Root Cause gefunden (2026-08-31)

Alle bisherigen Messungen zeigten `"ccache":{"hits":0,"misses":0}`, obwohl `USE_CCACHE=1` gesetzt war. Zwei unabhängige Ursachen, beide verifiziert:

1. **`pod install` muss `USE_CCACHE=1` gesetzt haben, nicht erst der spätere Build.** `react-native/scripts/cocoapods/utils.rb#set_ccache_compiler_and_linker_build_settings` schreibt `CC`/`CXX`/`LD`/`LDPLUSPLUS` (Ccache-Wrapper-Pfade) **zum Zeitpunkt von `pod install`** fest in die generierten `.xcodeproj`-Dateien. Ein späteres `USE_CCACHE=1` beim reinen Build-Aufruf kommt zu spät, wenn `pod install` davor ohne die Variable lief (z. B. in eigenen Test-/Reset-Skripten, die `pod install` manuell ohne Env aufgerufen haben).
2. **Der RN-eigene ccache-Wrapper hat den konfigurierten `cache_dir` ignoriert.** `node_modules/react-native/scripts/xcode/ccache-clang.sh` exportiert `CCACHE_CONFIGPATH` auf eine RN-eigene `ccache.conf` (ohne `cache_dir`). Das **ersetzt** (nicht ergänzt) die primäre Nutzer-Config (`~/.config/ccache/ccache.conf`) — ein dort gesetzter `cache_dir` auf einem externen Volume wurde dadurch komplett übergangen, ccache fiel auf den internen Default (`~/.cache/ccache`) zurück. Per direktem Wrapper-Aufruf verifiziert: mit `CCACHE_CONFIGPATH` gesetzt landete der Cache nachweislich unter `~/.cache/ccache` (interne Platte), nicht im konfigurierten externen Pfad.

**Fix in `scripts/native-build.ts` (`iosBuildEnv()`):** liest `cache_dir` aus der echten Nutzer-Config (`$XDG_CONFIG_HOME/ccache/ccache.conf` bzw. `~/.config/ccache/ccache.conf`, oder `$CCACHE_DIR` falls bereits gesetzt) und reicht ihn explizit als `CCACHE_DIR`-Env-Var durch — Env-Variablen haben bei ccache Vorrang vor jeder Config-Datei, das stellt den externen Cache-Pfad zuverlässig wieder her, ohne einen maschinenspezifischen Pfad im Repo zu hardcoden. Per direktem Wrapper-Aufruf verifiziert: mit `CCACHE_DIR` explizit gesetzt landet der Cache korrekt im externen Verzeichnis (1 Miss, dann 1 Hit beim Wiederholungslauf), `~/.cache/ccache` bleibt leer.

**Noch nicht verifiziert:** ob ein echter `xcodebuild`-Lauf (über `native:dev`/`native:rebuild`, nicht nur der direkte Wrapper-Aufruf) mit dem Fix tatsächlich Hits produziert — das braucht einen echten Build-Zyklus (kalt, dann warm), der aus Rücksicht auf lokalen Speicherplatz nicht mehr unkontrolliert wiederholt gestartet wurde.

## Archiviertes Ausschlussverfahren

Folgende Theorien wurden mit Belegen (nicht nur Vermutung) geprüft und widerlegt, bevor die Root Cause gefunden wurde:

| Theorie | Test | Ergebnis |
|---|---|---|
| `.fingerprintignore`-Änderung selbst verursacht den Mismatch | Änderung gestasht, Status erneut geprüft | Hash blieb identisch — kein Effekt |
| `.DS_Store`/`.xcode.env.local`/`Pods/`/`build/` verfälschen den Hash | `@expo/fingerprint`-Quellcode gelesen | Stehen bereits in `DEFAULT_IGNORE_PATHS` |
| Fehlendes Env-File-Loading bei `native:status` | Mit `dotenv -e .env.development.local` erneut geprüft | Kein Effekt |
| Node vs. Bun Runtime rechnet unterschiedlich | Fingerprint einmal mit `bun`, einmal mit `node` berechnet | Identischer Hash |
| `bun install` ist nicht-deterministisch | Zweimal `rm -rf node_modules && bun install`, verglichen | Identischer Hash bei beiden Durchläufen |
| Git-Stand weicht vom Baseline-Commit ab | `app.json`, `package.json`, `bun.lock`, `ios/`, `android/`, `patches/`, `eas.json`, `plugins/*.js` per SHA-256 gegen Baseline-Commit verglichen | Byte-identisch |

Das Repo hatte dieses Symptom schon vorher (zwei Commits `fix(native): sync ios/android baseline fingerprint` innerhalb von 5 Minuten am 2026-08-30) — damals wurde vermutlich nur mit `native:baseline --approve-rebuild` übertüncht statt die Ursache gefunden. Sollte es erneut auftreten: vermutlich ein anderer, ähnlich gelagerter lokal-generierter/ungetrackter Pfad unter `ios/` oder `android/` — der Diff-Ansatz oben findet ihn zuverlässig.

## Fingerprint-Empfindlichkeit reduziert (2026-08-31)

`app.json`/`eas.json`-Edits (Versionsnummer, Anzeigename, `buildCacheProvider` u. Ä.) haben in dieser Session mehrfach die Baseline verschoben, obwohl kein natives Verhalten betroffen war. Zwei Mechanismen ergänzt, beide offiziell von `@expo/fingerprint` unterstützt:

- **`fingerprint.config.js`** (bereits vorhanden mit einem `fileHookTransform`, das `seed:*`-Skripte aus dem package.json-Scripts-Hash filtert — **beim ersten Anlegen versehentlich überschrieben, dann gemergt**, siehe Git-Historie) bekam zusätzlich `sourceSkips` (Bitmask): `ExpoConfigVersions | ExpoConfigNames | ExpoConfigEASProject | ExpoConfigExtraSection`, plus den bereits von `@expo/fingerprint` defaultmäßig aktiven `PackageJsonAndroidAndIosScriptsIfNotContainRun`. Diese Datei wird automatisch von **allen** Konsumenten gelesen (unser Skript, `expo run:*`, `eas build`) — ein zentraler Ort statt divergierender Optionen. Verifiziert: `version`-Bump in `app.json` ändert den Hash jetzt nicht mehr.
  - Bewusst NICHT geskippt: `ExpoConfigAssets`, `ExpoConfigAndroidPackage`/`IosBundleIdentifier`/`Schemes`, `ExpoConfigAll`, `PackageJsonScriptsAll` — alle nativ relevant bzw. zu breit (letzteres würde z. B. einen `patch-package`-Postinstall-Hook unsichtbar machen).
- **`.fingerprintignore`**: `eas.json`/`.easignore` ergänzt. Abwägung bewusst getroffen (nicht risikofrei): Build-Profile steuern *wie* gebaut wird (Env-Injection, Distribution-Typ, Channel), nicht direkt was in den nativen Code kompiliert wird — Env-Vars landen im JS-Bundle, das ohnehin bei jedem Lauf frisch gebaut wird. Restrisiko: ein Profilfeld, das doch den `xcodebuild`-Aufruf ändert, würde nicht erkannt. Bei sicherheitsrelevanten `eas.json`-Änderungen manuell `native:baseline` erneuern.

Hinweis: `app.json` selbst stand schon vorher in `@expo/fingerprint`s `DEFAULT_IGNORE_PATHS` (als Datei) — die Config wird stattdessen als `expoConfig`-**Contents**-Quelle gehasht, deshalb griff `.fingerprintignore` dafür nie und `sourceSkips` war der einzig richtige Hebel.

## `scripts/dev-disk-clean.sh` angepasst

Ursprünglich löschte das Skript pauschal `~/.cache` (den ccache-Fallback-Ordner, siehe oben). Jetzt: eigener `ccache`-Diagnoseblock (zeigt konfigurierten `cache_dir`, warnt falls `~/.cache/ccache` doch auf der Boot-Disk existiert), pauschales `~/.cache`-Löschen entfernt zugunsten des gezielten Checks.

## ccache-Fix verifiziert — 3,5× schneller bei leerem DerivedData (2026-08-31)

Root Cause des vorherigen "0 Hits"-Rätsels war gravierender als der reine Timing-/Verzeichnis-Bug: **Xcodes Build-System (26.x) reicht selbst gesetzte Build-Settings NICHT als Umgebungsvariablen an die einzelnen "Compile Sources"-Subprozesse durch.** Per selbstgebautem Debug-Wrapper-Skript direkt verifiziert — ein echter `xcodebuild`-Lauf zeigte `CCACHE_BINARY=[] CCACHE_DIR=[]`, obwohl beide korrekt als Build-Settings im `.pbxproj` standen. Das betrifft auch `CCACHE_BINARY`, RNs eigenes, offizielles Feature — der ccache-Mechanismus aus `react-native/scripts/xcode/ccache-clang.sh` (`exec $CCACHE_BINARY clang "$@"`) lief in diesem Projekt vermutlich noch nie wirklich, unabhängig von allem vorherigen Wiring.

**Fix:** `plugins/withIosCcacheDir.js` (neu). Statt auf Env-Var-Durchreichung zu vertrauen, schreibt das Plugin bei `expo prebuild` zwei eigenständige Wrapper-Skripte (`ios/.ccache-wrapper-clang.sh`, `.ccache-wrapper-clang++.sh`) mit `CCACHE_DIR`/`CCACHE_CONFIGPATH` fest einprogrammiert (kein Env-Var-Vertrauen mehr nötig). `CC`/`CXX`/`LD`/`LDPLUSPLUS` — die Xcode selbst interpretiert, das funktioniert nachweislich — zeigen für Haupt-Target (`withXcodeProject`) und Pods-Project (`withPodfile`-Patch direkt nach `react_native_post_install()`) auf diese Skripte statt auf RNs env-var-abhängige Variante.

**Verifiziert mit echten Zahlen** (zwei identische `xcodebuild`-Läufe, DerivedData beide Male komplett geleert, damit ausschließlich ccache und nichts DerivedData-Inkrementelles gemessen wird):

| Lauf | DerivedData | ccache | Dauer |
|---|---|---|---|
| 1 | leer | 0 Hits / 2420 Misses (Cache wird befüllt) | 837s (13,9 Min) |
| 2 | leer (erneut geleert) | **2420 Hits / 0 Misses (100 %)** | **237s (4,0 Min)** |

**Faktor 3,5× — rein durch ccache**, ohne jede Hilfe von warmem DerivedData oder dem EAS-Remote-Cache (`buildCacheProvider` war für diesen Test bewusst deaktiviert). Bekannter Kompromiss: Xcode meldet pro Pod-Target `note: Explicit modules is enabled but the compiler was not recognized` — der Wrapper verhindert, dass Xcode den Compiler für "Explicit Modules" (ein separates Xcode-eigenes Optimierungsfeature) erkennt. Nicht weiter untersucht, ob das selbst spürbaren Zeitverlust verursacht; der Netto-Effekt (3,5× schneller) überwiegt deutlich.

## TestFlight-Pfad (`eas build --local`, Release): ccache bringt bisher NICHTS — ungelöst

Der obige Erfolg gilt nur für den Simulator/Debug-Pfad (`native:dev`/`expo run:ios`). Für `native:rebuild -- --target ios-preview-testflight` (der tatsächliche lokale TestFlight-Build-Pfad, `eas build --local`, Release-Konfiguration) wurden **vier echte, vollständige Läufe** durchgeführt — alle mit **0 Hits**:

| Lauf | Ansatz | ccache | Dauer |
|---|---|---|---|
| 1 | ohne `CCACHE_BASEDIR` (Baseline) | 0/1210 | 853,1s |
| 2 | Wiederholung, identisch | 0/1210 | 847,1s |
| 3 | `CCACHE_BASEDIR` statisch = Original-Projekt-Root | 0/1210 | 825,7s |
| 4 | (abgebrochen wegen Prozess-Kollision mit Lauf 3, siehe unten) | — | — |
| 5 | `CCACHE_BASEDIR` dynamisch ermittelt (siehe unten) — Befüllungslauf | 0/998 (Population) | 1253,6s (kontaminiert, siehe unten) |
| 6 | `CCACHE_BASEDIR` dynamisch, direkt danach | 0/1118 (abgebrochen kurz vor Ende, aber schon eindeutig) | abgebrochen |

**Was probiert wurde:**
1. `CCACHE_BASEDIR` statisch auf den ursprünglichen Projekt-Pfad gesetzt — Annahme falsch, dass `eas build --local` im Originalverzeichnis baut. Tatsächlich verifiziert: `bun install --frozen-lockfile` lief unter `/var/folders/.../eas-build-local-nodejs/<neue-uuid-pro-lauf>/build` — das **ganze Projekt** wird bei jedem Lauf in ein frisches Temp-Verzeichnis kopiert (deckt sich mit [ccache/ccache Discussion #1566](https://github.com/ccache/ccache/discussions/1566), demselben Symptom bei einem anderen RN/EAS-Projekt).
2. `CCACHE_BASEDIR` dynamisch zur Aufrufzeit im Wrapper-Skript ermittelt (`_find_basedir()`: von `$PWD` aufwärts nach dem nächsten `ios`-Verzeichnis suchen, dessen Elternordner nehmen — funktioniert nachweislich korrekt sowohl im normalen Projekt als auch simuliert für eine Temp-Kopie-Struktur, siehe isolierter Test). **Trotzdem weiterhin 0 Hits.**

**Nebenbefund während der Untersuchung:** Ein `pkill`-Aufruf zwischen zwei Läufen hat einen `xcodebuild archive`-Prozess nicht sauber beendet — Lauf 5 lief dadurch zeitweise parallel zu einem Rest von Lauf 4 (unterschiedliche Temp-UUIDs, daher keine Dateikollision, aber gemeinsame Ressourcen-/ccache-Nutzung), was Lauf 5 künstlich verlangsamt und dessen Zwischenzahlen kontaminiert hat. `pkill -f "eas build --local"`/`pkill -f xcodebuild` sind für diesen mehrstufigen `fastlane`/`gym`-Prozessbaum offenbar nicht zuverlässig — im Zweifel `ps aux` nach spezifischen PIDs prüfen und gezielt `kill` statt Pattern-Match.

**Offene Hypothesen, nicht mehr verfolgt (Zeit-/Kostenabwägung mit dem Nutzer):**
- Die von PR #1567 abgedeckten Flags (`-ivfsoverlay`, `-fmodules-cache-path`, `-fbuild-session-file`, `-fmodule-map-file`) sind möglicherweise nicht die einzigen variierenden Pfade — z. B. `-fmodules-cache-path=<basedir>/ModuleCache.noindex` selbst enthält den DerivedData-Pfad (`-derivedDataPath ./build`, aber relativ zum jeweiligen Temp-Root), unklar ob das korrekt normalisiert wird.
- `CCACHE_NOHASHDIR=true` (aus der GitHub-Diskussion als zusätzliche, nicht vollständig lösende Maßnahme erwähnt) wurde nicht ausprobiert.
- Denkbar, dass `-fmodule-map-file`/Precompiled-Header-Pfade (`-include .../UMAppLoader-prefix.pch`) selbst temp-pfad-abhängig sind und nicht von `base_dir` erfasst werden.
- Kein Debug-Wrapper-Log-Vergleich (wie beim Simulator-Fix) gemacht, der tatsächlich zeigt, WARUM ccache trotz korrektem `CCACHE_BASEDIR` einen Miss meldet (`ccache --debug`/`CCACHE_LOGFILE` je Aufruf einer Datei über zwei Läufe hinweg vergleichen wäre der nächste Schritt).

**Update: gelöst — mit dem richtigen Hebel (2026-08-31).** Der Fehler in der Analyse: der Ansatz war "ccache reparieren, damit es mit wechselnden Pfaden zurechtkommt" statt "die wechselnden Pfade an der Wurzel abstellen". `eas build --local` unterstützt `EAS_LOCAL_BUILD_WORKINGDIR` — eine offizielle, undokumentiert wenig bekannte Env-Var, die das sonst zufällige Temp-Arbeitsverzeichnis (`/var/folders/.../eas-build-local-nodejs/<uuid>/build`) auf einen **festen** Pfad zwingt. Gefunden über [expo/eas-cli Issue #1155](https://github.com/expo/eas-cli/issues/1155) — dort schlug die Variable mit einem *relativen* Pfad fehl (`tar: could not chdir`); mit einem **absoluten** Pfad funktioniert sie.

**Implementiert** in `scripts/native-build.ts` (`easLocalBuildEnv()`): setzt `EAS_LOCAL_BUILD_WORKINGDIR` auf `<ccache-cache_dir>/../eas-build-local-workingdir` — automatisch neben dem ccache-Verzeichnis auf dem externen Volume, kein hartcodierter Pfad, keine Boot-Disk-Nutzung. Der zuvor gebaute `CCACHE_BASEDIR`-Mechanismus (dynamische Ermittlung im Wrapper-Skript) bleibt bestehen, ist mit festem Arbeitsverzeichnis aber ohnehin nicht mehr nötig, da die Pfade jetzt gar nicht mehr variieren.

**Verifiziert mit echten Zahlen** (zwei Läufe von `native:rebuild -- --target ios-preview-testflight`, derselbe feste Arbeitsordner):

| Lauf | ccache | Dauer |
|---|---|---|
| 7 (Cache leer, Netzwerkfehler bei PostHog-Symbolupload am Ende — Compile selbst lief komplett durch) | 0/1210 | 779,0s (13,0 Min) |
| 7b (Wiederholung, identischer Arbeitsordner) | **1197/1197 Hits (100 %)** | **520,5s (8,7 Min)** |

**Faktor 1,5×, 4,3 Minuten gespart pro wiederholtem lokalen TestFlight-Build.** Kleiner als beim Simulator (3,5×), weil der Signing-/Export-/Upload-Teil (Codesign, IPA-Packaging, Symbol-Upload) nicht von ccache profitiert und einen fixen Anteil der Gesamtzeit ausmacht — nur die reine Compile-Phase wird beschleunigt. Ein reales, signiertes `.ipa` wurde erzeugt und in `native-build-lock.json` registriert.

**Arbeitsordner-Verhalten:** Der feste `EAS_LOCAL_BUILD_WORKINGDIR` bleibt als Pfad bestehen, wird aber vor jedem Lauf automatisch geleert, weil der lokale EAS-Plugin-Runner keinen alten Build-Inhalt akzeptiert. Der separate ccache-Ordner bleibt dabei erhalten und wird nicht gelöscht.
