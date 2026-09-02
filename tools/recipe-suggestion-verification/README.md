# Rezeptvorschlag-Verifikation

Dieser Unterordner ist ausschließlich für Prompt-, Schema-, Safety- und
Regressionsevals des `recipe_suggestion`-Vertrags bestimmt. Die Contract-Tests
führen keine Provideranfrage aus; der separate Smoke-Runner kann einen
begrenzten OpenRouter-Preflight senden. Der Ordner enthält keinen
App-Laufzeitcode.

Die Contract-Tests prüfen den gemeinsamen versionierten Vertrag mit
Promptfoo- und ChainForge-kompatiblen Adaptern. Promptfoo ist auf OpenRouter
mit `OPENROUTER_API_KEY` und strict Structured Outputs vorbereitet. Das
Run-Manifest hält für einen Replay die effektive Konfiguration, den
Structured-Output-Modus, SHA-256-Hashes der Artefakte, `finish_reason`,
Retry-Indizes und die Szenarioergebnisse fest.

Die lokale Env-Datei liegt unversioniert direkt in diesem Ordner:

```text
tools/llm-test-platform/recipe-suggestion-verification/.env
```

Ein echter Providerlauf ist weiterhin separat und begrenzt zu starten. Die
Contract-Tests senden keine Anfrage und verbrauchen kein Provider-Guthaben.

Offline-Checks:

```text
bun test promptfoo/promptfoo-contract.test.mjs
bun test chainforge/chainforge-contract.test.mjs
bun test eval-run-manifest.test.mjs
bun test run-openrouter-smoke-args.test.mjs run-openrouter-smoke-core.test.mjs
bun test scripts/wrapper-contract.test.mjs
```

Ein echter Promptfoo-Lauf wird über den lokalen Wrapper gestartet. Er erwartet
Node.js 22.22+ entweder unter `tools/llm-test-platform/.node/node(.exe)` oder
über die Umgebungsvariable `FAM_NODE_BIN`. Die Wrapper setzen außerdem den
isolierten Promptfoo-Config-Pfad für diesen Eval:

```powershell
.\scripts\promptfoo.ps1 eval `
  -c promptfoo\promptfooconfig.yaml `
  --env-file .env `
  -j 1 `
  --no-cache
```

Ein einzelner echter OpenRouter-Preflight kann mit dem synthetischen
Standardszenario gestartet werden. Er sendet genau eine Anfrage und gibt nur
Provider-Metadaten, `finish_reason`, Token-Nutzung, Validator-Ergebnis und das
Run-Manifest aus:

```powershell
bun --env-file=.env run-openrouter-smoke.mjs
```

Ein anderes Szenario kann als erstes Argument gewählt werden, zum Beispiel
`generative-fallback`. Mit `--retries N` sind höchstens drei zusätzliche,
identische Provider-Versuche möglich, und zwar nur nach einem erfolgreichen
HTTP-Aufruf mit semantisch ungültigem Modell-Output. Retries verändern weder
Prompt noch Schema noch Modell und reparieren keinen Modell-Output. Ohne
Option bleibt es bei genau einer Anfrage. Jeder Versuch wird im Run-Manifest mit
`retry_index`, `finish_reason` und Ergebnis festgehalten.

Der Preflight ersetzt keinen vollständigen Promptfoo- oder ChainForge-Lauf,
ist aber eine begrenzte providernahe Prüfung mit exakt demselben Prompt und
Structured-Output-Schema. Ein Modell wird bei einem Fehlschlag nicht
automatisch gewechselt oder promoted.

Ein echter ChainForge-Lauf wird über den entsprechenden Wrapper gestartet. Die
lokale Eval-Umgebung liegt unter
`tools/llm-test-platform/recipe-suggestion-verification/.venv` und wird zuerst
verwendet. Alternativ kann `FAM_CHAINFORGE_BIN` einen anderen Launcher setzen:

```powershell
.\scripts\chainforge.ps1 --help
```

Ein echter Promptfoo- oder ChainForge-Lauf braucht weiterhin die jeweilige
Installation und ausdrücklich bereitgestellte Zugangsdaten. Die Wrapper
ändern keine Prompts, Schemas oder Modellparameter.
