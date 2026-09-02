# Isolierter Rezeptvorschlags-Prototyp

Dieser Ordner ist ein lokaler Prototyp zum Testen der fachlichen Regeln. Er ist
keine App-Laufzeit, keine Supabase-Anbindung und ruft keinen Modell-Provider auf.

## Test ausführen

```bash
node --test tools/recipe-suggestion-prototype/recipe-suggestion.test.mjs
```

Wenn `node` nicht im PATH liegt, kann der Test mit der projektgebundenen
Node-Runtime ausgeführt werden.

## Inhalt

- `recipe-suggestion.mjs`: deterministischer Kontextaufbau und Validator;
- `schemas/recipe-suggestion-context.schema.json`: Kontextvertrag;
- `schemas/recipe-suggestion-response.schema.json`: Structured-Output-Vertrag;
- `recipe-suggestion.test.mjs`: fokussierte Verhaltenstests.

Die Testdaten sind absichtlich klein und lokal. Bestehende Import- oder
Experimentdateien werden nicht als Laufzeitquelle verwendet.
