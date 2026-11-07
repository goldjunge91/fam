# Auswertung des Branches `feat_ai_cooking`

**Datum:** 2026-11-06
**Zielbranch:** `feature/ai-cooking-port`
**Ausgangsstand:** `main` bei `fe07f65a75fe6c7ed817adb4556b13c9d89d24ac`
**Geprüfter Remote-Stand:** `origin/feat_ai_cooking` bei `d7e7d5dbc76d4b5460c2098ab94098489e1a29eb`
**Beads:** `fam-y918`

## Ergebnis

Der AI-Branch darf nicht vollständig gemergt und seine Commitreihe darf nicht direkt cherry-gepickt werden. Er besitzt 109 eigene Commits, liegt 840 Commits hinter `main` und verändert gegenüber seinem Abzweigpunkt 613 Dateien mit etwa 147.000 Hinzufügungen und 63.000 Löschungen.

Der aktuelle `main` enthält bereits neuere Implementierungen für RevenueCat-Entitlements, AI-Credit-Buchungen und -Erstattungen, den Inventory-Lifecycle, Telemetrie, Umgebungsvariablen, Supabase-Zugriff und das Unistyles-Designsystem. Der verwertbare Branch-Umfang muss deshalb selektiv in diese heutigen Grenzen eingepasst werden.

## Verwertbare Backend-Bausteine

Die folgenden Branch-Dateien sind geeignete Ausgangspunkte. Sie werden vor einer Übernahme vereinfacht und an den aktuellen Code angepasst:

```text
supabase/functions/ai-gateway/config.ts
supabase/functions/ai-gateway/openrouter-request.ts
supabase/functions/ai-gateway/openrouter-request.test.ts
supabase/functions/ai-gateway/recipe-suggestion-contract.ts
supabase/functions/ai-gateway/recipe-suggestion-contract.test.ts
supabase/functions/ai-gateway/recipe-suggestion-context.ts
supabase/functions/ai-gateway/recipe-suggestion-context.test.ts
supabase/functions/ai-gateway/catalog-suggestions.ts
supabase/functions/ai-gateway/catalog-suggestions.test.ts
supabase/functions/ai-gateway/ingredient-knowledge.ts
supabase/functions/ai-gateway/ingredient-knowledge.test.ts
```

Die wertvollen Verhaltensanteile sind:

- strikter, versionierter Structured-Output-Vertrag;
- serverseitige Prüfung von IDs, Mengen, Einheiten und erlaubten Zutaten;
- deterministische Einkaufslistenentscheidung;
- Katalogauswahl vor generativem Fallback;
- fail-closed Behandlung unvollständiger Allergeninformationen;
- JSON-Schema-Request an OpenRouter statt eines unbestimmten JSON-Objekts;
- getrennte Modell-, Prompt- und Ausführungsprofile.

Die folgenden bereits auf `main` vorhandenen Dateien werden nur gezielt erweitert. Die Branch-Versionen dürfen sie nicht ersetzen:

```text
supabase/functions/ai-gateway/handler.ts
supabase/functions/ai-gateway/handler_test.ts
supabase/functions/ai-gateway/index.ts
```

Dabei bleiben insbesondere die aktuelle serverseitige RevenueCat-Prüfung, `book_ai_credit`, `refund_ai_credit`, Subscriber-Bindung, das heutige Secret-Namensschema und die aktuelle Fehlerbehandlung erhalten.

## Verwertbare App-Bausteine

Diese Dateien beschreiben den beabsichtigten App-Flow und können als Grundlage dienen:

```text
src/app/chef-koch.tsx
src/features/chef-koch/screens/chef-koch-screen.tsx
src/features/chef-koch/screens/chef-koch-screen.test.tsx
src/features/recipes/data/recipe-suggestion-gateway.ts
src/features/recipes/data/recipe-suggestion-gateway.test.ts
src/features/recipes/data/use-recipe-suggestions.ts
src/features/recipes/data/use-recipe-suggestion-cook-review.ts
src/features/recipes/data/use-recipe-suggestion-cook-review.test.tsx
src/features/recipes/domain/recipe-suggestions.ts
src/features/recipes/domain/recipe-suggestions.test.ts
src/features/recipes/domain/recipe-suggestion-review.ts
src/features/recipes/domain/recipe-suggestion-review.test.ts
src/features/recipes/domain/recipe-suggestion-cook-review.ts
src/features/recipes/domain/recipe-suggestion-cook-review.test.ts
```

Notwendige heutige Integrationspunkte sind:

```text
src/constants/feature-registry.ts
src/constants/feature-registry.test.ts
src/features/navigation/root-navigator.tsx
src/features/navigation/root-navigator.test.tsx
src/features/navigation/navigation-drawer.test.tsx
src/lib/telemetry/schema.ts
src/lib/telemetry/policy.ts
src/lib/telemetry/policy.test.ts
src/features/inventory/use-inventory-mutations.ts
```

Der Cook-Review darf nicht den alten Branch-Adapter verwenden. Bestätigter Verbrauch muss in den aktuellen atomaren Inventory-Lifecycle und dessen Outbox-Vertrag übersetzt werden.

Die UI-Dateien werden nicht unverändert übernommen. Der Branch-Screen verwendet alte Imports und Stylingmuster, besitzt eine 28-Punkt-Trefferfläche und enthält einen funktionslosen Button `Rezept speichern`. Vor einer UI-Implementierung wird mit Marco geklärt, ob vorhandene Mockups verwendet oder mehrere neue statische Varianten erstellt werden sollen.

## Datenbankumfang

Für die vollständige Allergen- und Kontextprüfung sind diese Branch-Konzepte relevant:

```text
supabase/schemas/26_ingredient_allergen_knowledge.sql
supabase/schemas/27_ingredient_source_links.sql
supabase/schemas/30_cooking_context.sql
supabase/tests/25_ingredient_allergen_knowledge.test.sql
supabase/tests/26_ingredient_source_links.test.sql
supabase/tests/29_cooking_context.test.sql
```

Die Dateinummern `26` und `27` sind auf `main` inzwischen durch Receipt-Schemas belegt. Neue deklarative Dateien brauchen daher freie Nummern und die erforderlichen Funktionsrechte in `supabase/schemas/99_privileges.sql`.

`supabase/schemas/28_request_limits.sql` ist als eigener Härtungsschritt sinnvoll. Der aktuelle In-Memory-Limiter teilt seinen Zustand nicht über Edge-Instanzen und Kaltstarts hinweg. Der zugehörige Branch-Test kann wegen des inzwischen geänderten Credit-/Refund-Vertrags nicht unverändert übernommen werden.

Aus `supabase/seed.sql` sind höchstens die fachlich nötigen Allergen-Beispieldaten selektiv zu übernehmen. Die drei vorhandenen Seed-Zutaten sind keine ausreichende Produktionsdatenbasis. Vor einem realen Rollout braucht die Allergenprojektion eine belastbare Befüllung.

Nach Datenbankänderungen gelten ausschließlich die Projektkommandos:

```text
bun run db:diff
bun run db:reset
bun run db:types
bun run test:db <betroffene-testdatei>
```

Branch-Migrationen und `src/lib/database.types.ts` werden nie direkt übernommen oder von Hand editiert.

## Ausgeschlossener Branch-Ballast

Folgende Bereiche gehören nicht in den AI-Cooking-Port:

- `src/features/ai-agent-skills/**`: kein produktiver Consumer und eine frühere Parallelarchitektur;
- `src/features/recipes/domain/recipe-suggestion-context.*`: kein produktiver Aufrufer, Backend-Kontext ist zuständig;
- AI-bezogene `.android.ts`- und `.android.tsx`-Duplikate: identisch oder nur durch Leerraum verschieden;
- `src/features/inventory/apply-inventory-consumption*`: vom aktuellen Inventory-Lifecycle überholt;
- `src/features/inventory/inventory-outcome*` und `src/lib/telemetry/food-waste-measurement*`: im Branch ohne vollständigen Produktpfad;
- `supabase/schemas/29_off_enrichment_cache.sql` sowie zugehörige OFF-Änderungen: eigenes Open-Food-Facts-Thema;
- alle Dateien unter `supabase/migrations/` aus dem Branch;
- die Branch-Version von `src/lib/database.types.ts`;
- vollständige Branch-Versionen von `.env.example`, `package.json`, `bun.lock`, `supabase/config.toml`, `supabase/schemas/03_households.sql` und `supabase/schemas/20_privileges.sql`;
- Build-, iOS-, Crawler-, Cache-, Beads- und allgemeine Refactor-Dateien;
- Promptfoo- und ChainForge-Verzeichnisse als Laufzeitabhängigkeit.

Die Eval-Werkzeuge können später als eigenes Vorhaben bewertet werden. Sie sind nicht erforderlich, um den ersten sicheren App- und Gateway-Pfad zu implementieren.

## Bekannte Risiken beim Port

1. Der aktuelle Client- und Serververtrag auf `main` liefert ein einzelnes `cooking_suggestion.v1`, während der Branch `schema_version` plus ein bis drei `meals` erwartet. Client und Backend müssen in demselben Integrationsschritt umgestellt werden.
2. Die Branch-Version von `handler.ts` würde die neuere RevenueCat- und Refund-Absicherung zurückbauen.
3. Der Branch verwendet veraltete Imports wie `@/lib/env` und `@/lib/debug-log`.
4. Der alte Cook-Review umgeht den heutigen Inventory-Lifecycle.
5. Die Branch-Ausgabe protokolliert bei Vertragsverletzungen teilweise rohe Modellantworten. Das wird wegen möglicher Haushaltsdaten nicht übernommen.
6. Die Allergenprojektion arbeitet absichtlich fail-closed. Ohne ausreichend gepflegte Rezeptdaten erhalten Nutzer mit Allergien keine Vorschläge.
7. Die Branch-Dokumentation bezeichnet mehrere Phasen als abgeschlossen, obwohl der aktuelle `main` diese Implementierung nicht enthält. Statusaussagen werden erst nach erneuter Verifikation aktualisiert.

## Geplante inkrementelle Reihenfolge

Die Ausführung wird in `fam-y918` verfolgt. Der erste Arbeitsschritt ist der getestete Backend-Vertrag ohne UI-Änderung. Danach folgen Kontextaufbau und Provider-Request, die Integration in den aktuellen Billing-geschützten Handler, deklarative Datenbankänderungen und zuletzt der App-Flow. Die visuelle Umsetzung beginnt erst nach Marcos Entscheidung zu den Mockups.
