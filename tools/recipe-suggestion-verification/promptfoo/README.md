# Promptfoo-Verifikation für Rezeptvorschläge

Diese Scheibe beschreibt die Promptfoo-Verifikation des Rezeptvorschlags-
Prototyps. Die Standardkonfiguration verwendet OpenRouter mit dem Modell
`ibm-granite/granite-4.2-8b` und deterministischen Parametern (`temperature: 0`,
`top_p: 1`, `seed: 0`). Die Basiskonfiguration prüft ausschließlich
`ibm-granite/granite-4.2-8b`, weil dieses Modell JSON-Schema-Structured-Outputs
unterstützt. Die Matrix `promptfooconfig.openrouter.yaml` nimmt zusätzlich
`minimax/minimax-m3:free` als Kompatibilitäts- bzw. Negativkontrolle auf. Bei
MiniMax Free wird zwar ein strict-Request gesendet, OpenRouter dokumentiert für
diesen Endpunkt aber keine JSON-Schema-Durchsetzung. Ein nicht vertragskonformes
Ergebnis ist dort deshalb ein erwartbarer, sichtbarer Fehler und kein gültiger
Strict-Baseline-Lauf. Der API-Key wird ausschließlich über
`OPENROUTER_API_KEY` aus der lokalen Env-Datei geladen.

Ein echter Promptfoo-Lauf benötigt eine separate Promptfoo-Installation und
einen ausdrücklich freigegebenen API-Schlüssel. Vom Eval-Ordner aus kann er so
gestartet werden:

```powershell
.\scripts\promptfoo.ps1 `
  eval -c promptfoo\promptfooconfig.yaml --env-file .env -j 1 --no-cache

# Kompatibilitätsmatrix inklusive des bekannten MiniMax-Negativkontrollfalls:
.\scripts\promptfoo.ps1 `
  eval -c promptfoo\promptfooconfig.openrouter.yaml --env-file .env -j 1 --no-cache
```

`response_format` liegt bewusst in `defaultTest.options`. Promptfoo dokumentiert
diese Stelle als test-level provider configuration. Dadurch bleibt strict
Structured Output auch bei einer Provider-Auswahl mit `-r` erhalten. Die
OpenRouter-spezifischen Parameter `reasoning` und
`provider.require_parameters` werden über Promptfoos dokumentiertes
`passthrough` unverändert an die API weitergereicht:

```powershell
# Strict-Baseline mit dem schema-fähigen Modell:
.\scripts\promptfoo.ps1 `
  eval -c promptfoo\promptfooconfig.yaml --env-file .env `
  -r "openrouter:ibm-granite/granite-4.2-8b" `
  -j 1 --no-cache

# Matrix inklusive MiniMax-Negativkontrolle:
.\scripts\promptfoo.ps1 `
  eval -c promptfoo\promptfooconfig.openrouter.yaml --env-file .env `
  -r "openrouter:minimax/minimax-m3:free" "openrouter:ibm-granite/granite-4.2-8b" `
  -j 1 --no-cache
```

## Schema-Vertrag

`schemas/recipe-suggestion-response-format.json` ist der
OpenRouter-`response_format`-Envelope. Er enthält `type: "json_schema"`, den
Namen `recipe_suggestion_response`, `strict: true` und das vollständige
verschachtelte JSON-Schema. Das kanonische Eval-Schema liegt an dieser Stelle:

`tools/llm-test-platform/recipe-suggestion-verification/promptfoo/schemas/recipe-suggestion-response.schema.json`

Die Contract-Prüfung stellt sicher, dass das verschachtelte Schema und das
kanonische Response-Schema identisch bleiben. Die vier `is-json`-Assertions
referenzieren das kanonische Response-Schema direkt. Der Vertrag enthält
`schema_version: 1` und 1 bis 3 `meals`. Jede Mahlzeit hat `title`, `source`,
`recipe_id`, `servings`, `used_items`, `additional_ingredients`, `steps` und
`notes`. `source` ist `catalog`, `template` oder `model_generated`; bei der
Fallback-Quelle ist `recipe_id` null.

## Kompakter Kontext und Invarianten

Alle Tests übergeben genau einen JSON-String als `compact_context` im
kanonischen Kontextformat. Darin liegen `request`, `constraints`,
`priority_foods`, `planned_shopping_items`, `candidate_recipes`,
`shopping_question` und `fallback_allowed`. Rohe Haushaltsdaten und freie
Nutzeräußerungen werden nicht übergeben.

Die JavaScript-Assertion prüft zusätzlich:

- Bestands-IDs stammen aus `priority_foods`; Menge und Einheit passen zu dem
  jeweiligen Eintrag.
- Bei `catalog` oder `template` stimmen `recipe_id` und `source` mit einem
  `candidate_recipes`-Eintrag überein.
- `model_generated` ist ausschließlich eine `source`-Variante, nur bei
  `fallback_allowed: true`, und verlangt `recipe_id: null`.
- `additional_ingredients` sind ausschließlich `constraints.allowed_staples`
  oder Namen aus `planned_shopping_items` und niemals verboten.
- `meals` bleibt auf maximal drei Einträge begrenzt; `steps` ist nicht leer und
  `notes` ist ein String-Array.

Die Offline-Prüfung aus diesem Ordner läuft ohne Promptfoo-Aufruf, ohne
OpenRouter-Aufruf, ohne Installation und ohne Secrets:

```bash
node --test promptfoo-contract.test.mjs
node --check assertions/recipe-suggestion.js
```
