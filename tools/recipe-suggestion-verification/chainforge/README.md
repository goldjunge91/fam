# ChainForge-Rezeptvorschlags-Verifikation

Diese Scheibe prüft Rezeptvorschläge deterministisch gegen den kanonischen Response-Vertrag. Der Offline-Contract-Test benötigt weder einen ChainForge-Aufruf noch einen OpenRouter-Aufruf, API-Keys, Secrets oder eine Installation.

Der kanonische Eval-Vertrag liegt im Unterordner `tools/llm-test-platform/recipe-suggestion-verification/promptfoo/schemas/recipe-suggestion-response.schema.json`. Die Antwort enthält exakt schema_version und meals. Jede Mahlzeit enthält exakt title, source, recipe_id, servings, used_items, additional_ingredients, steps und notes. Gültige Quellen sind catalog, template und model_generated.

## Kompakter Kontext

Jede JSONL-Zeile im Dataset enthält scenario_id, scenario_type und genau einen vollständigen compact_context. Der Kontext enthält exakt schema_version, request, constraints, priority_foods, planned_shopping_items, candidate_recipes, shopping_question und fallback_allowed.

Die Objekte in constraints enthalten exakt allergies, preferences, allowed_staples und forbidden_ingredients. priority_foods enthält exakt inventory_item_id, name, available_quantity, unit und priority_score. planned_shopping_items enthält exakt shopping_item_id, name, quantity und unit. candidate_recipes enthält exakt id, source, title und ingredient_names.

Das Dataset deckt vier Szenarien ab: leere Einkaufsliste, abgelehnte Einkaufsliste, zugesagte Einkaufsliste mit geplanten Artikeln und generativer Fallback ohne Rezeptkandidaten.

## ChainForge-Flow

1. Importiere recipe-suggestion-dataset.jsonl als Tabular Data. Jede Zeile liefert ihren compact_context und die Szenario-Metadaten.
2. Füge einen Prompt Node hinzu und übernimm den Inhalt aus recipe-suggestion-prompt.txt. Verbinde ihn mit dem Tabular-Data-Node.
3. Für einen echten LLM-Lauf kann danach ein LLM-Node verbunden werden. Für OpenRouter ist der lokale Custom Provider `openrouter_provider.py` vorgesehen. ChainForge lädt ihn über **Settings → Custom Providers**. Der Provider liest `OPENROUTER_API_KEY`, verwendet standardmäßig `ibm-granite/granite-4.2-8b`, verlangt einen Endpoint mit den angeforderten Parametern und sendet das kanonische Schema als strict Structured Output.
4. Füge einen JavaScript Evaluator-Node hinzu und übernimm recipe-suggestion-evaluator.js. Der Evaluator erwartet function evaluate(response), parst ausschließlich response.text als JSON und liest ausschließlich response.var.compact_context.
5. Verbinde den Evaluator mit einem Vis Node, um die binären Ergebnisse je Szenario zu vergleichen.

Der Evaluator prüft unter anderem die exakten kanonischen Schlüssel, schema_version, ein bis drei Mahlzeiten, bekannte Bestands-IDs aus priority_foods, positive Mengen bis höchstens available_quantity mit identischer unit, die Zuordnung von recipe_id und source zu candidate_recipes, Fallback-Berechtigung, erlaubte zusätzliche Zutaten sowie steps und notes.

Der Provider verwendet ausschließlich die Python-Standardbibliothek für den HTTP-Aufruf. Der Key steht nur in der lokalen Env-Umgebung und wird nicht in Dataset, Prompt oder Evaluator übernommen.

## Fokussierter Contract-Test

Der Test liest und evaluiert nur lokale Artefakte. Er führt keinen ChainForge- oder LLM-Aufruf aus:

    node tools/llm-test-platform/recipe-suggestion-verification/chainforge/chainforge-contract.test.mjs

Zusätzlich ist der Evaluator mit einem Syntaxcheck prüfbar:

    node --check tools/llm-test-platform/recipe-suggestion-verification/chainforge/recipe-suggestion-evaluator.js

Die offizielle ChainForge-Python-Installation erfolgt gemäß der
[ChainForge-Installationsdokumentation](https://www.chainforge.ai/docs/getting_started/)
mit `pip install chainforge`. Die lokale Eval-Umgebung liegt direkt unter
`recipe-suggestion-verification/.venv`; der Wrapper verwendet sie bevorzugt.
Ein Launcher-Smoke-Test ist:

    .\scripts\chainforge.ps1 --help

Der OpenRouter-Provider selbst kann ohne ChainForge-Aufruf syntaktisch geprüft
werden:

    python -m py_compile tools/llm-test-platform/recipe-suggestion-verification/chainforge/openrouter_provider.py
