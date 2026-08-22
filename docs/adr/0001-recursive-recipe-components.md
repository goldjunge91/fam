# Rekursive Recipe-Component-Struktur statt flacher Zutatenliste

Ein Recipe besteht aus Recipe Components (z. B. "Nudeln", "Soße"), die wiederum aus Recipe Component Items bestehen: jede Position ist entweder eine Basis-Zutat (Product-Referenz + Gramm) oder eine Referenz auf eine andere Component desselben Recipes (`sub_component_id` + Gramm). Das ermöglicht "Baukasten-Mahlzeiten" (Epic #12) — z. B. besteht "Soße" aus 50g Tomaten + 300g Hackfleisch, und mehrere Top-Level-Components desselben Recipes können "Soße" referenzieren, statt ihre Zutaten zu duplizieren. Wiederverwendung ist bewusst auf dasselbe Recipe beschränkt (Trigger in `11_recipes.sql` lehnt `sub_component_id`s aus anderen Recipes ab) — **keine** Component-Bibliothek über Recipes hinweg.

Alternative wäre eine flache Zutatenliste pro Recipe gewesen (einfacher zu modellieren, aber keine Wiederverwendung von Teilkomponenten über Recipes hinweg und keine Gruppierung wie "Nudeln"/"Soße" in der UI). Component und Component Item sind bewusst zwei Tabellen statt einer: eine Component braucht Namen und Portionsmenge (nur bei oberster Component), eine Item braucht Menge und genau ein Ziel — beides in eine Tabelle zu zwingen hätte je nach Zeilentyp NULL-Spalten erfordert.

Entschieden in `docs/plans/phase-2-4-brainstorm.md`, Abschnitt #12. Details siehe Kommentar in `supabase/schemas/11_recipes.sql`.
