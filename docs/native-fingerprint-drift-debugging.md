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
