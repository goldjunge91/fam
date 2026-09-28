# Implementierungsplan: Freitextgerichte im Mealplanner

Status: Umsetzung abgeschlossen
Parent-Bead: fam-njqp
Aufgabenliste: Beads, siehe geordnete Task-IDs unten

## Ziel

Wenn die Rezeptsammlung für einen Haushalt nicht verfügbar ist, soll ein Nutzer im Mealplanner ein Gericht als Freitext planen und Zutaten dazu erfassen können. Das bleibt ein Meal-Plan-Eintrag und erzeugt kein vollständiges Recipe. Die Einträge müssen lokal verfügbar und haushaltsweit synchronisiert sein. Die Einkaufsvorbereitung bleibt hinter Plus. Plus-Nutzer können auch die Freitext-Zutaten in die Einkaufsliste übertragen.

## Aktueller Zustand und Scope

- MealPlannerScreen bietet Freitext an, wenn Modulpräferenz, Feature-Flag oder Plus-Zugriff den Rezeptzugriff sperren.
- meal_plan_entries.recipe_id ist optional; ein Constraint erzwingt die exklusive Rezept- oder Freitextvariante.
- Einkaufsvorbereitung zeigt ohne Plus den Plus-Hinweis. Mit Plus berechnet sie Fehlmengen für Zutaten mit Product-Bezug und berücksichtigt Vorrat und Einkaufsliste.
- Freitext-Zutaten haben keinen Product-Bezug und werden als normale Einkaufsartikel ohne Vorratsabgleich übertragen. Der bestehende Rezeptpfad und seine Berechnung bleiben gleich.
- Der Plus-Schutz bleibt auf dem bestehenden Einkaufsvorbereitungsbildschirm. Eingabe und Bearbeitung von Freitext-Gericht und Zutaten bleiben davon unabhängig.
- Zusätzlich zur Modulpräferenz und zum Feature-Flag berücksichtigt MealPlannerScreen den Haushalt-Plusstatus für die Rezeptauswahl.

## Architekturentscheidungen für den Plan

- Ein Meal-Plan-Eintrag ist entweder ein Rezeptverweis oder ein Freitextgericht mit custom_title und custom_ingredients. Ein Datenbank-Constraint verhindert Misch- und Leerzustände.
- Die Zutatenliste wird am Meal-Plan-Eintrag gespeichert, damit lokaler Eintrag und Liste in einer lokalen Outbox-Mutation gemeinsam geschrieben und synchronisiert werden können. Kein neues Rezept und keine neue Sync-Tabelle.
- Die Zutatenform ist Name, Menge und Einheit ohne Product-ID. Einheiten werden aus `src/lib/units.ts` übernommen, damit Einkaufsliste und Freitextgerichte dieselben Werte verwenden.
- Für Freitext-Zutaten gibt es keinen Vorratsabgleich. Produktbasierte Rezepte behalten die vorhandene Berechnung.
- Supabase-Schemadatei bleibt Quelle für Backend-Änderungen. Die installierte Supabase CLI 2.118 erzeugt Migrationen aus supabase/schemas/ mit bun run db:dec -- -f <name> --no-apply; bun run db:diff vergleicht dagegen nur lokale Migrationen mit der lokalen Datenbank. Datenbanktypen werden mit bun run db:types erzeugt. Lokale SQLite-Migrationen werden mit bun run db:local:generate erzeugt.
- Das bestehende `EntryFormModal` erhält den Freitextmodus. Eingaben, Aktionen und Flächen verwenden Primitiven aus `src/constants/ui.tsx`; Theme-Abstände und Radien kommen aus `src/components/theme/index.ts`. Keine neue Native-Abhängigkeit und kein Native-Rebuild.

## Aufgabenfolge

### Phase 1: Datenvertrag

1. fam-njqp.1, Meal-Plan-Freitext im Supabase-Schema
- recipe_id optional machen, custom_title und custom_ingredients ergänzen, gültige Varianten in Schema und pgTAP belegen, CONTEXT.md aktualisieren.
   - Erwartete Flächen: supabase/schemas/14_meal_plans.sql, generierte Supabase-Migration, src/lib/database.types.ts, supabase/tests/11_meal_plans.test.sql, CONTEXT.md.
   - Abnahme: bestehende Rezept-Einträge bleiben gültig; Freitext- und Rezeptvarianten bestehen ihre Constraints; Household-RLS bleibt wirksam.
   - Verifikation nach Implementierung: bun run db:dec meldet keine Schemaänderungen, bun run db:diff meldet keine Abweichung zwischen Migrationen und lokaler Datenbank, bun run db:types, danach bash scripts/check-clean-db.sh --check-only und supabase test db --local supabase/tests/11_meal_plans.test.sql. Für die lokale Abnahme wird nur die ausstehende Migration angewendet, damit vorhandene lokale Daten nicht durch einen Reset gelöscht werden.

2. fam-njqp.4, Lokalen Meal-Plan-Spiegel erweitern
- Drizzle-Schema und lokale SQLite-Migration an den Backend-Vertrag anpassen.
   - Erwartete Flächen: src/lib/db/schemas/meal-planner.ts, neue generierte Migration und Snapshot unter drizzle/local/, drizzle/local/migrations.js, gezielter Schema-Integrationstest.
   - Abnahme: vorhandene lokale Einträge bleiben erhalten; neue Felder werden lokal gelesen und geschrieben.
   - Verifikation nach Implementierung: bun run db:local:generate und fokussierter Schema-Integrationstest.

### Checkpoint: Datenvertrag

- [x] Backend-Migration und lokale Migration passen zueinander.
- [x] Vorhandene Rezept-Einträge bleiben gültig.
- [x] Keine Änderung an RLS-Berechtigungen oder Produktdaten.

### Phase 2: Offline-Daten und Planungseingabe

3. fam-njqp.3, Freitext-Einträge lokal speichern und synchronisieren
   - Sync-Entity-Feldliste, Meal-Plan-Abfragen, Mutationen, Validierung und Vorwochenkopie ergänzen.
   - Erwartete Flächen: src/lib/db/entities.ts, src/features/meal-planner/use-meal-plans.ts, fokussierte Hook- und Sync-Tests.
   - Abnahme: Create, Update, Delete und Vorwochenkopie erhalten Namen und Zutaten; lokale Outbox-Writes sind gemeinsam atomar; Push und Pull transportieren die neuen Felder.
   - Verifikation nach Implementierung: fokussierte meal-planner Hook-, Entity- und Sync-Tests.

4. fam-njqp.5, Freitextgerichte im Mealplanner erfassen
- Bei gesperrter Rezeptsammlung neue Freitext-Einträge anbieten; bestehende Rezeptauswahl bei verfügbarem Rezeptzugriff erhalten.
- Das bestehende `EntryFormModal` erhält dafür einen zweiten Modus; es entsteht kein zweites Formular-Modal.
- Erwartete Flächen: src/features/meal-planner/meal-planner-screen.tsx, components/entry-form-modal.tsx, components/week-grid.tsx, MealPlannerScreen-Test.
   - Abnahme: Gericht und Zutaten können angelegt, bearbeitet und entfernt werden; Einträge bleiben auch dann bearbeitbar, wenn die Rezeptsammlung später wieder verfügbar wird.
   - Verifikation nach Implementierung: gezielter MealPlannerScreen-Test für Modulpräferenz, Feature-Flag, Freitext und vorhandene Rezeptauswahl.

### Checkpoint: Mealplanner-Fluss

- [x] Rezept- und Freitext-Einträge werden lokal und nach Pull gleich dargestellt.
- [x] Freitext-Zutaten bleiben beim Bearbeiten und bei „Vorwoche übernehmen“ erhalten.
- [x] Rezeptbasierte Planung ist weiterhin unverändert.

### Phase 3: Plus-Einkaufsvorbereitung

5. fam-njqp.2, Freitext-Zutaten in Plus-Einkaufsvorbereitung übernehmen
   - Freitext-Zutaten im bestehenden Einkaufsvorbereitungsbildschirm anzeigen und mit Plus selektiv zur Einkaufsliste übertragen.
   - Erwartete Flächen: src/features/meal-planner/use-shopping-needs.ts, missing-ingredients-screen.tsx, missing-ingredients-screen.android.tsx, gezielte Hook- und Screen-Tests.
   - Abnahme: Einkaufsvorbereitung bleibt für Nicht-Plus hinter der bestehenden Plus-Grenze; Plus-Nutzer können Freitext-Zutaten einzeln übernehmen; die bestehende Produkt- und Vorratsberechnung für Rezepte bleibt unverändert.
   - Verifikation nach Implementierung: fokussierte use-shopping-needs- und MissingIngredientsScreen-Tests für Plus, Nicht-Plus und beide Entry-Typen.

### Checkpoint: Gesamtabnahme

- [x] Gezielte Backend-, SQLite-, Offline-, UI- und Plus-Tests bestehen.
- [x] bun run check und bun run typecheck bestehen.
- [x] Die Feature-Änderungen bleiben auf den Mealplanner, seinen lokalen Sync und die bestehende Plus-Einkaufsvorbereitung begrenzt.
- [x] UI verwendet gemeinsame Primitiven aus ui.tsx und Theme-Tokens aus theme/index.ts.
- [x] Supabase-Migration und Typen sind generiert und geprüft.

## Abhängigkeiten

fam-njqp.4 hängt von fam-njqp.1 ab.
fam-njqp.3 hängt von fam-njqp.4 ab.
fam-njqp.5 hängt von fam-njqp.3 ab.
fam-njqp.2 hängt von fam-njqp.3 und fam-njqp.5 ab.

## Risiken und offene Entscheidungen

| Punkt | Auswirkung | Umgang |
| --- | --- | --- |
| Rezeptzugriff hat neben Modulpräferenz und Feature-Flag einen Pluszustand | Ohne Plusprüfung könnte die Rezeptauswahl trotz gesperrter Rezeptsammlung erscheinen | MealPlannerScreen berücksichtigt `hasPlus` |
| Einkaufslisten-Mutation verlangt Name, Menge und Einheit | Reine Textzeile kann nicht unverändert als normaler Einkaufsartikel übertragen werden | Zutaten erfassen Name, Menge und eine von der Einkaufsliste unterstützte Einheit |
| Freitext-Zutat besitzt keine Product-ID | Vorrat und bereits gelistete Produktmengen können nicht wie im Rezeptpfad verrechnet werden | Direkte Übertragung ohne Vorratsabgleich; nur bei ausdrücklicher Produktanforderung erweitern |

## Umsetzungsstatus

- Supabase- und SQLite-Schema, Offline-Mutationen, Freitext-Modalmodus und Plus-Einkaufsvorbereitung sind abgeschlossen.
- Supabase CLI 2.118 erzeugt Migrationen aus supabase/schemas/ mit bun run db:dec -- -f freetext_mealplanner --no-apply. Die Migration wurde lokal mit supabase migration up --local angewendet; die lokale Datenbank wurde nicht zurückgesetzt. Datenbanktypen wurden mit bun run db:types generiert und mit oxfmt formatiert.
- bun run db:dec und bun run db:diff melden keine verbleibenden Schemaänderungen. Die lokale DB ist nach den Tests sauber; db:advisors meldet keine Befunde.
- Verifikation: pgTAP 15/15; MealPlannerScreen 15/15; use-meal-plans 6/6; weitere gezielte Mealplanner-, Shopping- und WeekGrid-Suites grün; lokale Schema-Integration 31/31; Spiegel-Integration 34/34; Entity-Tests 10/10; vollständiger Biome-Check (1239 Dateien), Typecheck und git diff --check erfolgreich.
- Expo-native APIs sind nicht betroffen.
