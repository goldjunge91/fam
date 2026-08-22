# NutriTrack

Datenschutzorientierte, kollaborative App für Haushalte: geteilte Bestands- und Einkaufslisten kombiniert mit privatem Kalorien-, Nährwert- und Gesundheits-Tracking. Strikte Trennung zwischen Haushaltsdaten und privaten Nutzerdaten ist das zentrale Domänenprinzip.

## Language

**Tracking**:
Oberbegriff für alle privaten, per RLS isolierten Nutzerdaten — Nutrition Tracking, Medications & Symptoms, Fasting, Vital Logs, Workouts. Nicht haushaltsgebunden, nur für den einzelnen Nutzer sichtbar.
_Avoid_: Diary, Tagebuch, Journal, Log (als Oberbegriff)

**Nutrition Tracking**:
Der Ernährungs- und Gewichtsteil von Tracking: Mahlzeiten (`food_entries`), Gewicht (`weight_entries`), Ziele (`user_goals`). Eine von mehreren Tracking-Domänen, kein Oberbegriff.
_Avoid_: Diary, Ernährungstagebuch, Food Diary

**Product**:
Globaler, nicht haushaltsgebundener Katalogeintrag (z. B. aus Open Food Facts) mit Barcode/Nährwertdaten. Existiert unabhängig von jedem Haushalt.

**Inventory Item**:
Haushaltsgebundener Bestandseintrag (`fridge_items`) mit eigenem, eigenständigem Namen. Kann optional ein Product referenzieren, um Katalogdaten (Barcode, Nährwerte) zu übernehmen — die Referenz ist eine Anreicherung, keine Identität. Existiert auch ohne Product-Bezug (Freitext-Eintrag).
_Avoid_: Product (als Synonym), Fridge Item (als eigenständiger Begriff — ist dasselbe wie Inventory Item)

**Shopping List Item**:
Haushaltsgebundener Einkaufszettel-Eintrag (`shopping_list_items`). Gleiche Beziehung zu Product wie Inventory Item: eigener Name, optionale Product-Referenz zur Anreicherung.

**Shopping Run**:
Der Vorgang, einen Einkauf abzuschließen: mehrere abgehakte Shopping List Items werden in einem Schritt zu neuen Inventory Items transferiert. Keine geteilte Identität zwischen Quelle und Ziel — je ein neuer Inventory-Item-Datensatz pro Transfer, das Shopping List Item wird nur soft-deleted.

**Shopping History**:
Append-only-Protokoll abgeschlossener Shopping Runs (`shopping_history`), kein Offline-Sync. Überlebt unabhängig davon, ob das zugehörige Shopping List Item oder Inventory Item später gelöscht wird.

**Child Profile**:
Auth-loses Profil für ein Kind, gehört zum Household (nicht zu `auth.users`), verwaltet von einem Household Member. Verlässt der verwaltende Elternteil den Haushalt, bleibt das Profil erhalten — ein Admin kann es parallel verwalten (RLS erlaubt `managed_by`-Match ODER Admin-Rolle). `managed_by` selbst wird beim Verlassen aktuell **nicht** zurückgesetzt (bekannte Lücke, #188), zeigt danach also auf ein Nicht-Mitglied.

**Child Tracking**:
Ein Household Member kann einen privaten Tracking-Eintrag für ein Child Profile führen. Der Erwachsene bleibt Eigentümer: `user_id` (der loggende Erwachsene) ist auf allen Tracking-Tabellen immer gesetzt, `child_profile_id` ist ein optionales Zusatz-Tag — keine XOR-Beziehung zwischen beiden. Es gibt keinen eigenen Kind-Login und keine kindspezifische RLS; die Sichtbarkeit läuft komplett über `user_id`. Ein gesetztes `child_profile_id` muss zu einem Household gehören, in dem `user_id` Mitglied ist (Trigger `check_tracking_child_household`, #190) — sonst könnte ein Client einen Eintrag mit einem Kind aus einem fremden Haushalt taggen.
_Avoid_: Kind-Account, Child Login (existiert nicht)

**Role**:
Autorisierungsstufe eines Household Members: `admin` oder `member`. Bestimmt Rechte innerhalb eines Haushalts (z. B. Mitglieder entfernen). Jeder Haushalt **mit Mitgliedern** braucht mindestens einen Admin (`guard_last_admin`-Trigger). Ausnahme: der letzte Admin darf gehen, wenn dadurch keine Mitglieder mehr übrig bleiben — der Haushalt wird dann komplett mitgliederlos (verwaist), aber nicht gelöscht; Inventory/Shopping-List/Recipes bleiben als unerreichbare Daten bestehen (kein Cleanup, #189).
_Avoid_: Privileges (das ist ein Postgres-GRANT-Infra-Detail, kein Domänenbegriff)

**Recipe**:
Household-eigenes, editierbares Rezept mit Autor und Soft-Delete. Besteht aus Recipe Components und Recipe Steps.

**Recipe Component**:
Baustein eines Recipes (z. B. „Nudeln", „Soße") mit eigenem Namen und, bei einer obersten Component, einer Portionsmenge. Besteht aus Recipe Component Items.

**Recipe Component Item**:
Position innerhalb einer Recipe Component: entweder eine Basis-Zutat (Product-Referenz + Gramm) oder eine Referenz auf eine andere Component desselben Recipes (rekursive Komposition, z. B. „Soße" enthält „50g Tomaten" + „300g Hackfleisch").
_Avoid_: Zutat, Ingredient (nur informell für den Produkt-Fall zutreffend, deckt den Sub-Component-Fall nicht ab)

**Recipe Step**:
Ein Zubereitungsschritt eines Recipes, in Reihenfolge. Referenziert über Recipe Step Ingredients die darin verwendeten Recipe Component Items (nur für die Anzeige, keine eigene Fachlogik).

**Recipe Template**:
Admin-kuratiertes, global lesbares Rezept in eigener Tabellenfamilie — kein Nutzer-Content (kein Autor, kein Soft-Delete, RLS nur SELECT). Ein Haushalt kopiert ein Template client-seitig zu einem eigenen Recipe. Nicht Teil der lokalen SQLite-Spiegelung.
_Avoid_: Recipe (Template ist absichtlich keine Variante von Recipe mit household_id = null, sondern eine getrennte Tabellenfamilie)

**Meal Plan**:
Haushaltsweit geteilter Wochenplan (`week_start_date`). Genau ein aktiver Plan pro Haushalt und Kalenderwoche. Enthält Meal Plan Entries.

**Meal Plan Entry**:
Ordnet ein Recipe einem Tag und einer Mahlzeit zu, mit einer Mengenangabe (Portionen/Personen). Bewusst keine Zuordnung zu einzelnen Household Members oder Child Profiles — nur Mengen.
