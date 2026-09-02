# AI Evaluation Setup

Promptfoo und ChainForge werden hier isoliert vom Produktcode betrieben.

`tools/category-debugger` bleibt davon unberührt und ist weiterhin ausschließlich
für die Produktsuche-Klassifikation zuständig.

## Erstmalige Einrichtung

Aus diesem Verzeichnis werden die lokalen Promptfoo-Abhängigkeiten mit Bun
installiert:

```powershell
bun install
```

Für Promptfoo 0.122.2 ist Node.js 22.22+ erforderlich. Die Launcher verwenden
zuerst eine portable Laufzeit unter `.node/` und danach `node` aus dem PATH.
Unter Windows kann dafür die bereits vorhandene portable Laufzeit verwendet
werden; Bash nutzt dieselbe Auswahl in Git Bash oder eine Linux-Node-Laufzeit
in WSL.

## Promptfoo

```powershell
.\scripts\promptfoo.ps1 eval -c promptfooconfig.yaml
.\scripts\promptfoo.ps1 view
```

Bash (Git Bash, WSL, Linux, macOS):

```bash
./scripts/promptfoo.sh eval -c promptfooconfig.yaml
./scripts/promptfoo.sh view
```

Die lokale portable Node.js-Laufzeit liegt unter `.node/`, weil Promptfoo 0.122.2
Node.js 22.22+ voraussetzt. Der erste Lauf nutzt den lokalen Echo-Provider und
erzeugt keine externen API-Kosten. Für echte Modellvergleiche wird eine separate
lokale Provider-Konfiguration mit explizit gesetzten API-Keys verwendet.

### fam Phase 0

Die Regression gegen die beiden freigegebenen Abläufe läuft mit einem
deterministischen Fixture-Provider. Er prüft Verträge, Evidenzbindung,
Inventar-Lot-Referenzen, Allergie-, Tenant- und Write-Gates sowie reproduzierbare
Providerfehler. Es werden keine API-Keys und keine Produktdaten benötigt.

PowerShell:

```powershell
.\scripts\promptfoo.ps1 eval -c promptfooconfig.fam-phase0.yaml
```

Bash:

```bash
./scripts/promptfoo.sh eval -c promptfooconfig.fam-phase0.yaml
```

Die Phase-0-Fixtures sind in `tests/fam-phase0.yaml` mit `split: gold` und
`split: holdout` gekennzeichnet. Unter Windows funktioniert der Bash-Aufruf in
Git Bash. WSL benötigt eine Linux-Node.js-22.22+-Installation, wenn Windows-
Interop deaktiviert ist.

### OpenRouter-Modellmatrix

Die von dir ausgewählten Modelle liegen getrennt in
`promptfooconfig.openrouter.yaml`. Der Key wird nur aus der lokalen `.env`
geladen. Dafür `.env.example` nach `.env` kopieren und den eigenen Key eintragen.

PowerShell:

```powershell
Copy-Item .env.example .env
# .env lokal bearbeiten, dann:
.\scripts\promptfoo.ps1 eval -c promptfooconfig.openrouter.yaml -j 1
```

Bash:

```bash
cp .env.example .env
# .env lokal bearbeiten, dann:
./scripts/promptfoo.sh eval -c promptfooconfig.openrouter.yaml -j 1
```

Der Lauf sendet die vier synthetischen Modell-Fixtures an jedes der sechs
Modelle und prüft dieselben harten Gates wie Phase 0. Für den ersten Lauf ist
`-j 1` absichtlich gesetzt, damit der kostenlose MiniMax-Endpunkt nicht durch
parallele Anfragen unnötig rate-limited wird.

Der vollständige Matrixlauf umfasst damit **24 Modellanfragen** (4 Fixtures ×
6 Modelle). Er wird erst nach dem lokalen Fixture-Gate gestartet, weil jeder
Provider-/Fixture-Fehler sichtbar bleiben muss:

Als Einzeiler für PowerShell (aus `tools/llm-test-platform/`):

```powershell
$env:PROMPTFOO_HOME=(Join-Path (Get-Location) '.promptfoo'); $env:PROMPTFOO_DISABLE_WAL_MODE='true'; .\scripts\promptfoo.ps1 eval -c promptfooconfig.openrouter.yaml --env-file .env -j 1 --no-cache
```

Als Einzeiler für Bash (aus `tools/llm-test-platform/`):

```bash
PROMPTFOO_HOME="$PWD/.promptfoo" PROMPTFOO_DISABLE_WAL_MODE=true ./scripts/promptfoo.sh eval -c promptfooconfig.openrouter.yaml --env-file .env -j 1 --no-cache
```

PowerShell:

```powershell
$env:PROMPTFOO_HOME = (Join-Path (Get-Location) '.promptfoo')
$env:PROMPTFOO_DISABLE_WAL_MODE = 'true'
.\scripts\promptfoo.ps1 eval `
  -c promptfooconfig.openrouter.yaml `
  --env-file .env `
  -j 1 `
  --no-cache
```

Bash:

```bash
export PROMPTFOO_HOME="$PWD/.promptfoo"
export PROMPTFOO_DISABLE_WAL_MODE=true
./scripts/promptfoo.sh eval \
  -c promptfooconfig.openrouter.yaml \
  --env-file .env \
  -j 1 \
  --no-cache
```

Die Matrix ist absichtlich nicht als Gesamt-Prozentwert interpretierbar: Ein
Provider-/Fixture-Paar ist ein eigener Test und wird bei Fehlern nicht durch
einen anderen Anbieter ersetzt. Run-ID, Token, Dauer und Fehlerquote gehören
anschließend in `docs/specs/fam-agent-skills-phase0-baseline.md`.

Für einen kleinen Smoke-Test werden zunächst nur die beiden `model-gold`-Fälle
gegen zwei Modelle ausgeführt. Das sind genau vier Modellanfragen:

PowerShell:

```powershell
.\scripts\promptfoo.ps1 eval `
  -c promptfooconfig.openrouter.yaml `
  --env-file .env `
  -r "openrouter:minimax/minimax-m3:free" "openrouter:ibm-granite/granite-4.2-8b" `
  --filter-metadata split=model-gold `
  -j 1 `
  --no-cache
```

Bash:

```bash
./scripts/promptfoo.sh eval \
  -c promptfooconfig.openrouter.yaml \
  --env-file .env \
  -r openrouter:minimax/minimax-m3:free openrouter:ibm-granite/granite-4.2-8b \
  --filter-metadata split=model-gold \
  -j 1 \
  --no-cache
```

`disableVarExpansion: true` in the OpenRouter-Konfigurationsdatei verhindert,
dass Promptfoo Arrays wie `allowedLotIds` als zusätzliche Testfälle auffächert.
Granite 4.2 wird im Smoke-Test mit `reasoning_effort: none` auf seinen
unterstützten Non-Thinking-Modus gesetzt, damit das kleine JSON-Ausgabeformat
nicht vom internen Reasoning-Budget verdrängt wird. Alle OpenRouter-Provider
setzen zusätzlich `response_format: { type: json_object }`, damit die
Syntaxprüfung nicht von unquoted Modellwerten oder Markdown umgangen wird.

## Manuelle Erfassungszeit

Die manuelle Referenz wird ohne Produktdaten im Terminal gemessen. Der Timer
startet erst nach `Enter` und stoppt beim Absenden der JSON-Zeile. Mehrere
Durchläufe erzeugen einen lokalen, gitignorierten Report mit p50, Minimum und
Maximum.

PowerShell:

```powershell
.\scripts\measure-manual-capture.ps1 `
  --input 'Noch zwei Paprika und etwas Spinat' `
  --runs 3 `
  --output reports/manual-capture-baseline.json
```

Bash:

```bash
./scripts/measure-manual-capture.sh \
  --input 'Noch zwei Paprika und etwas Spinat' \
  --runs 3 \
  --output reports/manual-capture-baseline.json
```

Als Minimalstruktur werden `normalizedName`, `quantity`, `unit`, `storage` und
`date` erfasst. Die Laufzeit misst die menschliche Eingabe, nicht das Parsen
oder Validieren durch ein Modell.

Für einen reinen Timer-/JSON-Syntax-Smoke-Test kann zusätzlich `--proposal`
übergeben werden. Dieser Modus erzeugt absichtlich keinen menschlichen
Zeitwert und darf nicht in die manuelle Baseline übernommen werden:

```powershell
.\scripts\measure-manual-capture.ps1 --input 'Noch zwei Paprika und etwas Spinat' --runs 3 --proposal '[{"normalizedName":"Paprika","quantity":2,"unit":"piece","storage":"fridge","date":null}]' --output reports/manual-capture-smoke.json
```

## Produktiver AI-Gateway

Die App ruft ausschließlich die authentifizierte Supabase Edge Function
`ai-gateway` auf. Der OpenRouter-Key liegt nur serverseitig als Supabase Secret;
der Client kann weder Inventar-Lots mitgeben noch eine Schreiboperation
auslösen. Die Function prüft Haushaltsscope, liest beim Koch-Skill nur aktive
Lots mit expliziter Verderblichkeitsklassifikation, verwendet eine Allowlist
der sechs Modelle und verwirft ungültiges oder nicht geerdetes JSON.

Für ein Deployment müssen `OPENROUTER_API_KEY`, `AI_GATEWAY_MODEL` und optional
`AI_GATEWAY_ALLOWED_MODELS`, `AI_GATEWAY_TIMEOUT_MS` sowie
`AI_GATEWAY_RATE_LIMIT` als Supabase Function Secrets gesetzt werden. Der
typisierte App-Aufruf liegt in
`src/features/ai-agent-skills/gateway.ts`.

## ChainForge

```powershell
.\scripts\chainforge.ps1 serve --host 127.0.0.1 --port 8000
```

Bash:

```bash
./scripts/chainforge.sh serve --host 127.0.0.1 --port 8000
```

API-Schlüssel bleiben in lokalen Umgebungsvariablen oder im lokalen Secret-Store.
Produktionsdatenbanken und echte Haushaltsdaten werden nicht angeschlossen.
