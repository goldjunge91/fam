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
