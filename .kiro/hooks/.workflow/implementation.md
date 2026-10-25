# Implementierungsprotokoll: Semantische Hook-Portierung

## Aktueller Implementierungsstatus

Die fokussierte Implementierung ist abgeschlossen und durch die unabhängige Review freigegeben. Die vollständige Fall- und Hash-Evidenz liegt unter `.agents/tasks/codex-hook-portierung-evidence/`. Der aktuelle Workflowstatus ist mit dem unabhängigen Urteil und dem maßgeblichen Gate synchronisiert.

## Aktuelle read-only Nachprüfung

Am 2026-10-24 um 22:46:49Z/22:46:50Z wurden die Evidence-Verträge direkt gegen den aktuellen Arbeitsbaum geprüft. EVIDENCE-001 bestand mit 14 Records; EVIDENCE-002 bestand mit zwölf aktuellen Ziel- und zwölf geschützten Quellzeilen sowie genau einem dokumentierten Zielpfad; EVIDENCE-003 bestand mit UTC-Zeitstempeln, absolutem `cwd` und Toolmetadaten in `commands.log`. Die aktuelle JSON-/Shell-/Python-Syntaxprüfung bestand mit 5/5, 5/5 und 2/2. Die gestagten und ungestagten geschützten `.codex`-Diffprüfungen endeten mit Exit 0. Der bestehende Zielcache blieb mit 16 Einträgen unverändert inventargleich; `.simplify-ignore-cache` ist nicht vorhanden.

Diese Nachprüfung hat keine Runtime-, `.codex`-, Cache- oder temporäre Harness-Datei geändert. Zusammen mit der abgeschlossenen unabhängigen Review belegt sie den aktuellen Abschlussstatus: Das maßgebliche Gate `/Volumes/Programme/github/family_app/fam/.agents/tasks/codex-hook-portierung-gate.json` steht auf `APPROVED` mit `findings: []`, und EVIDENCE-001 bis EVIDENCE-003 sind geschlossen. `REAL KIRO HOST: NOT EXECUTED` bleibt die bekannte Hostgrenze.


## Scope, Gate und Schutzmaßnahmen

- `AGENTS.md`, `CONTEXT.md`, `.kiro/hooks/PORTING.md`, alle vier Dateien unter `.kiro/hooks/.workflow/`, der Statusbericht sowie alle fünf Hook-Konfigurationen und ihre Skripte wurden gelesen.
- `/Volumes/Programme/github/family_app/fam/.agents/tasks/codex-hook-portierung-gate.json` ist vorhanden und steht auf `APPROVED` mit `findings: []`; es verweist auf `/Volumes/Programme/github/family_app/fam/.agents/tasks/codex-hook-paritaet-review.md`. Die frühere `CHANGES_REQUESTED`-Bewertung bleibt ausschließlich als historische `priorIndependentReview`-Information in `review.json` erhalten.
- Der aktuelle Zielbestand umfasst zwölf Runtime-Dateien in fünf Gruppen: `session-start` (2), `beads-context` (2), Bash-Guards (3), `sdd-cache` (3) und `simplify-ignore` (2).
- `.codex/hooks/**`, `.codex/hooks.json` und `.codex/hooks/hooks.json` wurden nicht verändert. Eine einzige reproduzierte Zielabweichung wurde in `.kiro/hooks/simplify-ignore.sh` mit dem in `decision-HOOK-003-004.md` dokumentierten Minimalfix korrigiert.
- Beim Preflight enthielt `.kiro/hooks/.sdd-cache/` zwölf vorhandene JSON-Einträge. Die lokale Matrix schrieb ausschließlich private Kopien. Die offiziellen Dokumentationsabrufe aktualisierten zunächst drei Einträge und erzeugten beim maschinenlesbaren Markdown-Abruf drei neue URL-Einträge; ein unabhängiger `raw.githubusercontent.com`-Abruf ist ebenfalls im aktuellen Snapshot sichtbar. Diese Hostnebenwirkung ist in `sdd-cache-preservation.md` erklärt und wurde nicht zurückgesetzt.
- Alle Testdateien, Stubs, lokalen Serverzustände und Fixtures wurden unter dem vorgesehenen Evidence-Verzeichnis in privaten Sandboxes erzeugt und danach entfernt. Die finale Cache- und Hashbilanz steht in `sdd-cache-before.tsv`, `sdd-cache-after.tsv` und `sdd-cache-preservation.md`.

## Aktueller Zielbestand

- `session-start.json` und `session-start.sh`: `SessionStart`, lokales Skill-Lesen und nicht blockierender Fallback.
- `beads-context.json` und `beads-context.sh`: read-only `bd prime` für `SessionStart` und `UserPromptSubmit`.
- `guards.json`, `block-git-reset.py` und `block-bd-update-notes.py`: zwei `PreToolUse`-Schutzregeln für `execute_bash`.
- `sdd-cache.json`, `sdd-cache-pre.sh` und `sdd-cache-post.sh`: `web_fetch`-Pre-/Post-Hooks mit Validator-Cache unter `.sdd-cache`.
- `simplify-ignore.json` und `simplify-ignore.sh`: `read`, `write` und matcherloser `Stop` mit Placeholder-, Backup- und Recovery-Logik.

## Statische Validierung

Ausgeführt wurden die vorgesehenen Prüfungen unter Bash, damit die POSIX-Schleifen des Plans nicht von der standardmäßigen Fish-Shell interpretiert werden:

- Alle fünf Ziel-JSONs bestanden `python3 -m json.tool`.
- Alle fünf Shell-Skripte bestanden `bash -n`.
- Beide Python-Guards bestanden `ast.parse`.
- Der Strukturcheck bestätigte für jede Konfiguration `version: "v1"`, ein `hooks`-Array, eindeutige Namen, die erwarteten Trigger und Matcher, ausschließlich `command`-Aktionen und die vorgesehenen Skriptziele.
- Die Ziel-JSONs enthalten keine `hookSpecificOutput`-, `CLAUDE_PROJECT_DIR`-, `CLAUDE_PLUGIN_ROOT`-, `PreCompact`-, `PostCompact`-, `statusMessage`- oder `async`-Felder.
- Das Quelleninventar bestätigte elf Dateien unter `.codex/hooks` plus die äußere `.codex/hooks.json`. `SIMPLIFY-IGNORE.md` ist ausdrücklich enthalten und in `PORTING.md` eingeordnet.

## Payload- und Lifecycle-Validierung

### SessionStart und UserPromptSubmit

- `session-start.sh` bestand mit normalem und nicht JSON-förmigem STDIN, jeweils mit Exit 0, dem Präfix `agent-skills loaded.` und dem lokalen Abschnitt `# Using Agent Skills`.
- Der fehlende-Skill-Fallback wurde mit einem isolierten `cat`-Stub geprüft. Er gab die Nichtverfügbarkeitsmeldung aus und endete mit Exit 0.
- `beads-context.sh` blieb für `SessionStart` und `UserPromptSubmit` ohne `bd` mit Exit 0 und einer verständlichen Nichtverfügbarkeitsmeldung nicht blockierend.
- Ein isolierter `bd`-Stub zeichnete für beide Ereignisse genau je einen Aufruf `prime` auf und beendete erfolgreich. Ein realer `bd`-Aufruf wurde nicht benötigt und nicht ausgeführt.

### Beide Guards

Der reine Parser-Harness bestand mit folgenden tatsächlich ausgeführten Fällen:

- `block-git-reset.py`: 5 Allow-Fälle und 9 Deny-Fälle, einschließlich direktem Aufruf, `env`-/`command`-Wrappern, Git-Optionen, Redirection, Pipeline und mehreren Shell-Segmenten.
- `block-bd-update-notes.py`: 5 Allow-Fälle und 7 Deny-Fälle, einschließlich `--append-notes`, direkter `--notes`-/`--notes=...`-Aufrufe, Wrappern, Redirection, Pipeline und mehreren Shell-Segmenten.
- 11 ungültige oder unvollständige Payloads pro Guard endeten fail-closed mit Exit 2: ungültiges JSON, Nicht-Objekte, fehlendes `tool_input` sowie fehlendes, leeres oder falsch typisiertes `command`.
- Ein Sentinel-Kommando wurde in keinem Fall ausgeführt. Die Guard-Prüfung erzeugte keine Nebenwirkungen.

### `sdd-cache`

Die Matrix lief mit den unveränderten Skripten in einer eigenen Sandbox unter `.kiro/hooks/.sdd-cache/` gegen einen lokalen `ThreadingHTTPServer` auf `127.0.0.1`:

- Cache-Miss ohne Eintrag blieb mit Exit 0 nicht blockierend.
- `tool_response.result` speicherte URL, Prompt, Inhalt und ETag in einer tatsächlich geprüften Cachedatei.
- ETag- und Last-Modified-Revalidierung lieferten bei HTTP 304 Exit 2 und den Cacheinhalt auf STDERR.
- Validator-Mismatch blieb mit Exit 0 durchlässig.
- Ein Eintrag ohne Validator wurde nicht verwendet.
- Eine Response ohne Validator erzeugte keinen wiederverwendbaren Eintrag.
- Die Formen `result`, `output`, `text`, `content`, `body` und String wurden jeweils über eigene lokale URLs extrahiert und in den Cachedateien geprüft.
- Fehlende URL, fehlende oder leere Response, unbekannte `tool_response`-Form und ungültiges JSON blieben mit Exit 0 nicht blockierend.
- Der Serverharness beobachtete reale lokale 200- und 304-Antworten. Seine Sandbox wurde vollständig entfernt; die tatsächliche Vorher-/Nachher-Bilanz des bestehenden Zielcaches mit zwölf Einträgen und drei dokumentierten Hostaktualisierungen steht in `sdd-cache-preservation.md`.

### `simplify-ignore`

Die Prüfung lief mit einer harmlosen Fixture im zuvor nicht vorhandenen `.kiro/hooks/.simplify-ignore-cache/`:

- `PreToolUse/read` wurde einmal mit `tool_input.path` und einmal mit `tool_input.file_path` ausgeführt.
- Drei geschlossene Markerblöcke, darunter ein Block ohne Reason, wurden zu `BLOCK_`-Platzhaltern; ein ungeschlossener Block blieb sichtbar und gab die Warnung aus.
- Ein wiederholter Read war idempotent. Die Fixture hatte keinen abschließenden Newline, dessen Erhalt wurde mitgeprüft.
- Eine kontrollierte Änderung außerhalb des Platzhalters wurde per `PostToolUse/write` übernommen. Der geschützte Inhalt war im Backup wieder expandiert und die sichtbare Datei anschließend erneut gefiltert.
- Ein matcherloser `Stop` stellte die Datei ohne Block-Entscheidung wieder her und entfernte Backup, Path, Blockdaten, Reason-, Prefix-, Suffix- und Lock-Artefakte.
- Nach dem Löschen der Fixture vor `Stop` wurde der dokumentierte `.recovered`-Pfad erzeugt und geprüft.
- No-marker-, fehlendes-Pfad-, unbekanntes-Tool- und ungültiges-JSON-Payload blieben nicht blockierend.
- Fixture, Recovery-Datei und der gesamte vorgesehene Simplify-Cache wurden entfernt; das Verzeichnis ist nicht vorhanden.

## Paritätskorrektur und Toolgrenzen

Die source-vs-target-Differentialfälle stehen in `simplify-ignore.jsonl` und `decision-HOOK-003-004.md`. Fehlendes `jq` lässt Quelle und Ziel im selben gefilterten Zustand, mit geerbtem Exit-1 der Quelle und nicht blockierendem Exit-0 des Ziels. Fehlendes `perl` zeigt dieselbe Abhängigkeit und denselben Zustand. Nur der Hash-Tool-Fall am matcherlosen Stop ließ das Ziel vor der Korrektur im geschützten Zustand zurück; nach der Verschiebung der bestehenden Prüfung restaurieren Quelle und Ziel beide die Originalbytes und bereinigen alle Artefakte.

## Endabgleich und Ergebnis

- Die finale Prüfung bestätigte JSON 5/5, Shell 5/5 und Python-AST 2/2. Die vollständige Befehls- und Exitcodefolge steht in `commands.log`, die Zusammenfassung in `final-validation.md`.
- `git diff --quiet -- .codex/hooks .codex/hooks.json` und der entsprechende staged-Diff endeten erfolgreich. Die separaten Quellmanifeste sind bytegleich.
- Die zwölf Zielmanifeste zeigen elf unveränderte Runtime-Dateien und genau die dokumentierte Korrektur in `simplify-ignore.sh`. Der Zielbaum bleibt untracked; deshalb ist der Manifestvergleich und nicht ein leerer Git-Diff maßgeblich.
- Es wurden keine Builds, keine vollständige Testsuite, kein `bun test`, keine Commits und keine Pushes ausgeführt.

## Hostgrenzen

`host-boundary.md` dokumentiert nun eine partielle reale Host-Evidence. Der native `web_fetch`-PostToolUse erzeugte exakt den neuen Cacheeintrag des vorhandenen `sdd-cache-after-web-fetch`-Hooks und ist deshalb als `v1_loaded` belegt. SessionStart, UserPromptSubmit, der sichere `execute_bash`-Allow-Fall, Read/Write und Stop blieben ohne belastbare Hostzuordnung beziehungsweise waren nicht beobachtbar; sie werden als `host_opaque`, `executed_but_hook_decision_not_observable` oder `stop_not_observable` geführt.

Die vollständigen Records stehen in `.agents/tasks/codex-hook-portierung-evidence/real-kiro-host.jsonl`. Der neue Cacheeintrag und die markerlose Probe wurden entfernt, und der bestehende Cache mit 17 Einträgen ist hashgenau wiederhergestellt. Keine Deny-Probe, kein `createHook`, keine Registrierung und keine direkte Skriptausführung wurden verwendet. Hostversion und vollständige Payload-/Matcherinformationen waren nicht sicher feststellbar. Das lokale Gate bleibt `APPROVED` mit `findings: []`; aus der partiellen Host-Evidence wird keine neue vollständige Hostfreigabe abgeleitet.
