# Recipe Templates als eigene Tabellenfamilie statt recipes mit household_id = null

Recipe Templates (admin-kuratierte, global lesbare Rezeptbibliothek) leben in einer komplett eigenen Tabellenfamilie (`recipe_templates`, `recipe_template_components`, `recipe_template_items`, `recipe_template_steps`) statt als Sonderfall von `recipes` mit `household_id = null`.

Templates sind nie editierbarer Nutzer-Content: kein `created_by`, kein Soft-Delete/Tombstone, RLS erlaubt nur `SELECT`. `recipes` dagegen ist durchgehend Nutzer-Content mit Autor und Löschbarkeit. Eine gemeinsame Tabelle hätte beide Fälle vermischt und die RLS-Policies verkompliziert (unterschiedliche Schreibrechte auf denselben Rows je nach `household_id`). Templates sind außerdem nicht Teil der lokalen SQLite-Spiegelung — der Vorlagen-Screen fragt live gegen Supabase ab, da Vorlagen kein Kern-Offline-Datensatz sind. Ein Haushalt "aktiviert" ein Template über einen client-seitigen Kopiervorgang, der ein eigenes Recipe in `recipes`/`recipe_components`/`recipe_component_items`/`recipe_steps` anlegt.

Details siehe Kommentar in `supabase/schemas/15_recipe_templates.sql`.
