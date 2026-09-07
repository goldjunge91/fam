# Spec: Ingredient- und Allergen-Wissensbasis

## Objective

Eine getrennte, versionierte Wissensschicht soll Lebensmittelidentitäten und
Allergenbeziehungen für das read-only Rezeptvorschlags-Gateway bereitstellen.
Die Haushaltsdaten bleiben proprietär und tenant-scoped. Das Modell erhält
keine Schreibautorität und bewertet keine Allergene selbst.

Die drei Quellen haben feste Rollen:

- `eu_lmiv`: normative Taxonomie der 14 EU-Allergengruppen aus Anhang II der
  Verordnung (EU) Nr. 1169/2011;
- `open_food_facts`: externe, maschinenlesbare Produkt-/Allergen-Evidenz;
- `foodon`: kanonische Ingredient-IDs und Ontologiebeziehungen.

`curated` bezeichnet die lokale Prüf- und Freigabeschicht, keinen vierten
externen Provider.

## Tech Stack

- Supabase Postgres
- deklarative SQL-Dateien unter `supabase/schemas/*.sql`
- pgTAP unter `supabase/tests/*.test.sql`
- generierte Migrationen über `bun run db:diff`
- generierte TypeScript-Typen über `bun run db:types`

## Data Contract

Die Wissensschicht umfasst mindestens:

```text
allergen_taxonomy
external_food_ingredients
external_food_aliases
ingredient_allergen_mappings
product_ingredient_links
catalog_recipe_item_ingredient_links
```

Stabile Taxonomie-IDs:

```text
EU_01_GLUTEN_CEREALS
EU_02_CRUSTACEANS
EU_03_EGGS
EU_04_FISH
EU_05_PEANUTS
EU_06_SOYBEANS
EU_07_MILK
EU_08_NUTS
EU_09_CELERY
EU_10_MUSTARD
EU_11_SESAME
EU_12_SULPHITES
EU_13_LUPIN
EU_14_MOLLUSCS
```

Mappings speichern Relation, Provider, externe ID, URL, Version, Lizenz,
Vertrauensstufe und Review-Zeitpunkt. Zulässige Relationen sind
`contains`, `derived_from`, `may_contain` und `exempt`. Zulässige
Vertrauensstufen sind `regulatory`, `verified`, `external` und `inferred`.

Eine `clear`-Auflösung benötigt einen eigenen Review-Zeitpunkt. Produkt- und
Kataloglinks dürfen nur auf lokale Ingredient-Identitäten zeigen und speichern
ebenfalls Quelle, Version, Lizenz, Vertrauensstufe und Review-Zeitpunkt.

Ein fehlendes Mapping ist semantisch `unknown`; es darf nicht als leere,
allergenfreie Liste persistiert werden.

## Commands

```bash
bun run db:diff -- -f ingredient_allergen_knowledge
bun run test:db supabase/tests/25_ingredient_allergen_knowledge.test.sql
bun run db:types
bun run db:diff
```

Kein lokales Supabase-Start/Stop und keine manuell geschriebene Migration.

## Project Structure

```text
supabase/schemas/26_ingredient_allergen_knowledge.sql
supabase/schemas/27_ingredient_source_links.sql
supabase/tests/25_ingredient_allergen_knowledge.test.sql
supabase/tests/26_ingredient_source_links.test.sql
supabase/functions/ai-gateway/       # erst in fam-0ij.8
src/features/recipes/                 # erst bei Gateway-/UI-Integration
```

Die Importgrenze stellt benannte, netzwerkfreie Adapter für EU-LMIV, Open Food
Facts und FoodOn bereit. `curated` ist der lokale Review-Adapter. Alle vier
Einstiege normalisieren Provenienz und IDs strikt; das Gateway liest nur die
lokale Wissensbasis und ruft keinen Provider direkt auf.

## Code Style

Schemas bleiben explizit, restriktiv und ohne implizite Sicherheitslogik:

```sql
create table if not exists public.ingredient_allergen_mappings (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.external_food_ingredients (id),
  allergen_id text not null references public.allergen_taxonomy (id),
  relation text not null check (relation in ('contains', 'derived_from', 'may_contain', 'exempt')),
  source text not null check (source in ('eu_lmiv', 'open_food_facts', 'foodon', 'curated')),
  confidence text not null check (confidence in ('regulatory', 'verified', 'external', 'inferred')),
  source_id text,
  source_url text,
  source_version text,
  license text,
  reviewed_at timestamptz
);
```

Provider, Relation und Confidence werden durch Datenbank-Constraints begrenzt.
Keine `any`-ähnliche Freitextsemantik und keine Gateway-Heuristik ersetzt
diese Werte.

## Testing Strategy

Die pgTAP-Suite prüft:

- genau 14 eindeutige EU-Allergen-IDs;
- getrennte Providerwerte und gültige Relationen/Vertrauensstufen;
- Foreign Keys zwischen Zutaten, Allergenen und Mappings;
- Provenienzfelder, Lizenz und Review-Metadaten;
- RLS und Grants für die externen, nicht haushaltsgebundenen Daten;
- bekannte Zuordnung ist von fehlender Zuordnung unterscheidbar;
- `clear` ist ohne Review-Zeitpunkt nicht gültig;
- Produkt- und veröffentlichte Katalogitems können provenance-behaftet auf
  lokale Ingredient-Identitäten zeigen;
- ungültige Provider, Relationen und Vertrauensstufen werden abgelehnt.

Die Gateway-Policy, Produktlinks und Importadapter sind Folgeaufgaben und
werden in separaten fokussierten Tests geprüft.

## Boundaries

- **Always:** EU-LMIV nur als Taxonomiequelle verwenden; OFF und FoodOn als
  provenance-behaftete Quellen speichern; Unknown fail-closed bei aktiven
  Allergien/Intoleranzen behandeln; RLS und deklarative Schema-Regeln nutzen.
- **Ask first:** Änderung des Structured-Output-Vertrags, neue Provider,
  neue Allergen-/Intoleranzsemantik oder eine Änderung der privaten
  Profilregeln.
- **Never:** Haushaltsdaten in die externe Wissensschicht kopieren, Provider
  direkt aus dem Gateway aufrufen, `inferred` als Sicherheitsfreigabe werten,
  Inventory-IDs ersetzen, Modelltext als Allergenbeweis verwenden oder vor
  „Gekocht bestätigen“ den Bestand verändern.

## Success Criteria

- Die EU-14-Taxonomie ist stabil und maschinenlesbar gespeichert.
- Die drei Providerrollen sind im Datenvertrag unterscheidbar.
- Externe Zutaten, Aliase und Mappings sind mit Provenienz und Lizenz
  speicherbar.
- `unknown` und bekannt allergenfrei sind nicht verwechselt.
- Authentifizierte Leser können die freigegebene Wissensbasis lesen; Clients
  können sie nicht verändern.
- Die fokussierte pgTAP-Suite besteht.
- Es gibt keine Änderung am Gateway, an der UI oder am Cook-Mutationspfad in
  diesem Schnitt.

## Open Questions

- Welche initiale Zutatenmenge wird nach dem Schema-Schnitt aus den drei
  Providern kuratiert?
- Welche konkreten Unverträglichkeits-Mappings werden in `fam-0ij.8`
  unterstützt?
- Ob `exempt` im Gateway einen eigenen Status erhält, wird erst bei der
  Policy-Implementierung entschieden.
