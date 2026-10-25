# Semantische Portierungsübersicht

Diese Übersicht ordnet jeden tatsächlich geprüften Quellpfad unter `.codex/hooks`
und `.codex/hooks.json` genau einmal einem Kiro-Ziel oder einer bewussten
Nicht-Portierung zu. Die Quellpfade bleiben unverändert. Zielkonfigurationen
verwenden eigenständige JSON-Dateien mit `version: "v1"`, `hooks[]`, eindeutigen
Namen und `command`-Aktionen.

Schemaquellen:

- [Kiro-Hooks v1](https://kiro.dev/docs/ide/whats-new-v1/hooks/)
- [Kiro-Hook-Trigger](https://kiro.dev/docs/hooks/types/)
- [Kiro-Hook-Aktionen](https://kiro.dev/docs/hooks/actions/)

## Vollständiges Quelleninventar

Unter `.codex/hooks` wurden diese elf Dateien geprüft:

1. `block-bd-update-notes.py`
2. `block-git-reset.py`
3. `hooks.json`
4. `SDD-CACHE.md`
5. `sdd-cache-post.sh`
6. `sdd-cache-pre.sh`
7. `session-start-test.sh`
8. `session-start.sh`
9. `simplify-ignore-test.sh`
10. `simplify-ignore.sh`
11. `SIMPLIFY-IGNORE.md`

Zusätzlich wurde die äußere Quelle `.codex/hooks.json` geprüft. Jeder dieser
zwölf Quellpfade ist in genau einem Abschnitt unten eingeordnet.

## `.codex/hooks/session-start.sh`

- **Absicht:** Beim Sitzungsstart den lokalen Meta-Skill
  `using-agent-skills/SKILL.md` als Kontext ausgeben.
- **Ziel:** `.kiro/hooks/session-start.json` und `.kiro/hooks/session-start.sh`.
- **Übernommen:** Dynamisches lokales Lesen sowie verständliche Fallback-Ausgabe
  bei fehlender Datei. Beide Pfade enden mit Exit 0 und blockieren keinen Start.
- **Abweichung:** Der Codex-/Claude-Envelope `hookSpecificOutput` und die
  `jq`-Escaping-Abhängigkeit entfallen; Kiro erhält normale Hook-Ausgabe.
- **Seiteneffekte:** Nur lokales Lesen und STDOUT-Ausgabe.

## `.codex/hooks/hooks.json`

- **Absicht:** Ein Kompatibilitäts-Wrapper registriert den Session-Start und
  probiert Plugin- oder Projektpfade.
- **Ziel:** Kein eigener Zielhook; die Absicht ist in `session-start.json`
  konsolidiert.
- **Übernommen:** Session-Start und tolerantes Verhalten bei fehlendem Skript.
- **Abweichung:** `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PROJECT_DIR`, die verschachtelte
  Registrierung und die Claude-Ausgabehülle gehören nicht zum Zielvertrag.
- **Seiteneffekte:** Keine zweite Registrierung und keine doppelte Ausgabe.

## `.codex/hooks.json`

- **Absicht:** Lebenszyklus- und Tool-Kontrollen für Beads, Bash, WebFetch,
  Compact-Ereignisse und Nutzereingaben registrieren.
- **Ziel:** `beads-context.json`, `guards.json`, `sdd-cache.json`,
  `session-start.json` und `simplify-ignore.json`.
- **Übernommen:** `SessionStart`/`UserPromptSubmit` mit `bd prime`, beide
  Shell-Schutzregeln, WebFetch-Cache sowie der Datei- und Stop-Lifecycle.
- **Nicht übernommen:** `PreCompact` und `PostCompact`, weil sie nicht als
  sichere Kiro-v1-Zieltrigger vorgesehen sind.
- **Abweichung:** Die Codex-Map, `^Bash$`, `^WebFetch$`, `bd codex-hook`,
  `statusMessage`, `async` und Laufzeitvariablen werden nicht übernommen.
- **Seiteneffekte:** Beads bleibt read-only; Cache- und Filterartefakte liegen
  ausschließlich unter `.kiro/hooks`.

## `.codex/hooks/block-git-reset.py`

- **Absicht:** `git reset` vor Ausführung erkennen und blockieren, auch mit
  Wrappern, Optionen, Umleitungen und mehreren Shell-Segmenten.
- **Ziel:** `guards.json` und `block-git-reset.py`.
- **Übernommen:** Shell-Tokenisierung, Wrapper-, Zuweisungs-, Segment-,
  Umleitungs- und Git-Optionserkennung.
- **Matcher:** `shell` deckt die CLI-V3-Shelltools ab. Bash wird mit POSIX-
  `shlex` ausgewertet. Für PowerShell blockiert der Hook konservativ Eingaben,
  in denen die verbotenen Begriffe zusammen auftreten; so passieren auch
  verschachtelte `Invoke-Expression`-Aufrufe nicht ungeprüft.
- **Abweichung:** Der Parser liest Kiro-`tool_input.command`; Codex-Bezeichnungen
  wurden aus Meldungen entfernt. Ungültige Eingabe bleibt fail-closed.
- **Exit/Seiteneffekte:** Exit 2 nur für erkannte Verbote oder nicht sicher
  lesbare Guard-Eingaben; keine Dateischreibzugriffe.

## `.codex/hooks/block-bd-update-notes.py`

- **Absicht:** Direkte `bd update --notes`-Aufrufe blockieren; `--append-notes`
  bleibt erlaubt.
- **Ziel:** `guards.json` und `block-bd-update-notes.py`.
- **Übernommen:** Wrapper-, Zuweisungs-, Umleitungs- und Shell-Segmentlogik sowie
  `bd`/`bd.exe`, `update`, `--notes` und `--notes=`.
- **Matcher:** `shell` deckt die CLI-V3-Shelltools ab. Für PowerShell wird die
  Kombination aus `bd`, `update` und `--notes` konservativ blockiert, damit
  verschachtelte Befehle nicht ungeprüft passieren.
- **Abweichung:** Kiro-`tool_input.command` ersetzt den Codex-Payload; Meldungen
  sind zielneutral.
- **Exit/Seiteneffekte:** Exit 2 bei direkter Regelverletzung oder unsicherer
  Guard-Eingabe; keine Datenbankänderung durch den Hook.

## `.codex/hooks/sdd-cache-pre.sh`

- **Absicht:** Einen URL-Cache vor WebFetch per `ETag` oder `Last-Modified`
  revalidieren und nur bei HTTP 304 als Ersatzantwort verwenden.
- **Ziel:** `sdd-cache.json` und `sdd-cache-pre.sh` mit Matcher `web_fetch`.
- **Übernommen:** URL aus `tool_input.url`, validatorpflichtige Revalidierung,
  defensive JSON-Auswertung, cached body mit Prompt-Metadaten und Exit 2 nur
  beim bestätigten Cache-Hit.
- **Abweichung:** Cache und Debug-Logs liegen unter `.kiro/hooks/.sdd-cache/`;
  Codex-Namen, Envelope und externe Root-Variable entfallen.
- **Exit/Abhängigkeiten:** Fehlendes `jq`, `curl` oder Hashprogramm lässt den
  Fetch mit Exit 0 passieren. HTTP 304 plus Inhalt führt zu Exit 2.

## `.codex/hooks/sdd-cache-post.sh`

- **Absicht:** Eine erfolgreiche WebFetch-Antwort mit URL, Prompt, Validatoren
  und Abrufzeit speichern.
- **Ziel:** `sdd-cache.json` und `sdd-cache-post.sh` mit Matcher `web_fetch`.
- **Übernommen:** Kiro-STDIN-Auswertung, defensive Felder `result`, `output`,
  `text`, `content`, `body` sowie String-Responses; Origin-Validatoren werden
  per HEAD ermittelt und atomar gespeichert.
- **Abweichung:** Der Cache wird ausschließlich unter `.kiro/hooks/.sdd-cache/`
  geschrieben und die Runtime-Registrierung verwendet keine Codex-Async-Form.
- **Exit/Abhängigkeiten:** Fehlende Werkzeuge, ungültige JSON- oder fehlende
  Response-Daten bleiben nicht blockierend. Responses ohne Validator löschen
  keinen gültigen neuen Eintrag und werden nicht gespeichert.

## `.codex/hooks/simplify-ignore.sh`

- **Absicht:** Markerblöcke vor Reads mit `BLOCK_<hash>` ersetzen, nach Writes
  expandieren und erneut filtern, bei Stop aus Backups restaurieren.
- **Ziel:** `simplify-ignore.json` und `simplify-ignore.sh` mit `read`, `write`
  und matcherlosem `Stop`.
- **CLI V3:** Die Kategorien `read` und `write` decken die V3-Dateitools ab;
  das Skript verarbeitet `read_file`, `fs_read`, `fs_write`, `fs_append` und
  `str_replace`. Andere Treffer der Kategorien enden ohne Dateiänderung.
- **Übernommen:** Marker- und Reason-Syntax, Hashes, Placeholder-Expansion,
  Newline-Erhalt, Backups, Lock-Recovery, Rename-Recovery und Wiederherstellung.
  Kiro-Payloads lesen beide Pfadfelder `tool_input.path` und
  `tool_input.file_path`.
- **Abweichung:** Kiro `Stop` läuft am Ende eines Agent-Turns statt nur beim
  Sitzungsabbau. Die Datei wird daher beim nächsten Read erneut gefiltert.
  Kiro-Stop erzeugt niemals eine Blockentscheidung.
- **Seiteneffekte:** Zustandsdateien entstehen ausschließlich unter
  `.kiro/hooks/.simplify-ignore-cache/`; nur Dateien innerhalb des Worktrees
  werden berührt. Stop restauriert eine Datei nur, solange sie bytegleich zum
  zuletzt gefilterten Stand ist. Bei zwischenzeitlichen Änderungen bleibt die
  Datei unangetastet und der gesicherte Inhalt wird in eine freie
  `.recovered.*`-Datei daneben verschoben. Symlink-Ziele und Pfade außerhalb
  des Worktrees werden übersprungen; die Quellhooks bleiben unverändert.

## `.codex/hooks/session-start-test.sh`

- **Absicht:** Codex-Session-Start-Envelope und `jq`-Fallback testen.
- **Ziel:** Kein Runtime-Hook und keine Kopie.
- **Übernommen:** Die Zielvalidierung prüft direkte Ausgabe, Skill-Inhalt,
  fehlende Skill-Datei und Exit 0. Envelope-Felder werden nicht getestet.

## `.codex/hooks/simplify-ignore-test.sh`

- **Absicht:** Filterung, Hashes, Marker, Newlines, ungeschlossene Blöcke und
  ungültige Eingabe des Filters testen.
- **Ziel:** Kein Runtime-Hook und keine Kopie.
- **Übernommen:** Diese Fälle wurden in fokussierten Kiro-STDIN-Prüfungen für
  Read, Write und Stop nachgebildet; eine nicht registrierte Codex-Testdatei
  wird nicht als Zielartefakt aktiviert.

## `.codex/hooks/SDD-CACHE.md`

- **Absicht:** Cachebetrieb, Validatorinvarianten, Abhängigkeiten und Tests
  dokumentieren.
- **Ziel:** Keine Dokumentkopie; Kiro-relevante Regeln stehen in den beiden
  Cache-Abschnitten dieser Übersicht.
- **Übernommen:** URL-Schlüsselung, Validatorpflicht, kein TTL-Ersatz und
  Graceful Degradation.
- **Abweichung:** Codex-/Claude-Registrierung, alte Pfade und alte
  Envelope-Beispiele werden nicht als Zielvertrag wiederholt.

## `.codex/hooks/SIMPLIFY-IGNORE.md`

- **Absicht:** Markersemantik, Platzhalter, Restore und bekannte Grenzen des
  Filters dokumentieren.
- **Ziel:** Keine Dokumentkopie; die Kiro-Entscheidung steht im
  `simplify-ignore.sh`-Abschnitt.
- **Übernommen:** Marker-, Placeholder-, Crash-, Rename- und Lock-Risiken sowie
  die frühere Wiederherstellung bei Kiro-Stop werden ausdrücklich benannt.
- **Abweichung:** Claude-Registrierung, alte Cachepfade und CLI-only Restore-
  Beispiele werden nicht als aktiver Zielvertrag übernommen.

## Abschlussprüfung und bewusste Grenzen

- Jede Ziel-JSON enthält `version: "v1"`, ein `hooks`-Array, eindeutige Namen,
  unterstützte Trigger und ausschließlich `command`-Aktionen.
- Kein Zielhook enthält `hookSpecificOutput`, `CLAUDE_PROJECT_DIR`,
  `CLAUDE_PLUGIN_ROOT` oder eine Codex-Hook-Map.
- Exit 2 wird nur für die beiden Schutzregeln sowie einen per Origin bestätigten
  Cache-Hit verwendet. Kontext-, Post- und Stop-Hooks bleiben nicht blockierend.
- `PreCompact` und `PostCompact` bleiben bewusst unportiert.
- `.codex/hooks/**`, `.codex/hooks.json` und die zusätzliche
  `.codex/hooks/hooks.json` wurden nicht verändert.
