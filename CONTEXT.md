# fam: Projektkontext

Status: Veraltete Version, Nicht weiterverwenden oder weiterlesen so lange der status nicht auf freigegeben steht.
Datum: 2026-09-15
___


Kurzreferenz für Maintainer, Entwickler und Agents. fam ist eine
Weniger Lebensmittel sichernde, Einkaufslisten Huashaltsapp die Familien helfen soll
Haushalte: geteilte Bestands-,
Einkaufs- und Rezeptdaten werden mit privatem Kalorien-, Nährwert- und
Gesundheits-Tracking kombiniert. Der Name ist ein Arbeitstitel; im Code und in
der technischen Dokumentation ist `fam` der aktuelle Projektname.

Diese Datei erklärt Domänengrenzen und Begriffe. Sie ist keine zweite
Implementierungsquelle und ersetzt nicht die verbindlichen Arbeitsregeln in
[`AGENTS.md`](AGENTS.md).

## Quellenhierarchie

Bei widersprüchlichen Aussagen gilt die engste technische Quelle:

| Thema | Maßgebliche Quelle | Zweck dieser Datei |
| --- | --- | --- |
| Arbeitsregeln für Agents und Beiträge | [`AGENTS.md`](AGENTS.md) | nur zusammenfassen, nicht duplizieren |
| Domänenbegriffe und Eigentümerschaft | `CONTEXT.md` | zentrale Sprache und Grenzen |
| Produktziel und Roadmap | [`docs/features/VISION.md`](docs/features/VISION.md), [`docs/features/ROADMAP.md`](docs/features/ROADMAP.md) | Produktabsicht |
| Dauerhafte Architekturentscheidungen | [`docs/adr/`](docs/adr/README.md) | Begründung und verworfene Alternativen |
| Backend-Datenmodell | `supabase/schemas/*.sql` | deklarativer Endzustand und RLS |
| Lokaler SQLite-Spiegel | `src/lib/db/schemas/*.ts` | Offline-Modell, nicht Supabase-Schema |
| UI-Designsystem | `src/components/theme/index.ts`, `src/components/theme/ThemeProvider.tsx`, `src/constants/ui.tsx` | Tokens, Theme-Laufzeit und semantische Primitiven |
| Tatsächliches Verhalten | Quellcode und gezielte Tests | überprüfbare Implementierung |

Die vollständige Dokumentationslandkarte steht in
[`docs/README.md`](docs/README.md). Spezifikationen unter `docs/specs/` sind
aktuelle Arbeitsgrundlagen, sofern sie nicht ausdrücklich als historisch
markiert sind. `docs/archive/` enthält abgeschlossene oder überholte
Unterlagen.

## Nicht verhandelbare Architekturgrenzen

- **Datentrennung:** Haushaltsdaten sind für berechtigte Household Members
  geteilt. Account-Tracking bleibt über Supabase RLS privat. Ein Haushalts-Admin
  erhält dadurch keinen Zugriff auf private Erwachsenendaten.
- **Deklaratives Schema:** Änderungen beginnen in `supabase/schemas/*.sql`.
  Migrationen werden mit `bun run db:diff` erzeugt und nicht von Hand verfasst.
- **Local-first:** Synchronisierte Haushaltsdaten haben ein lokales SQLite-
  Gegenstück und werden über Outbox, Pull/Push, Realtime und Konfliktauflösung
  synchronisiert. Append-only-Protokolle wie Product Usage und Shopping History
  sind davon getrennt, sofern ihr Datenmodell keinen Sync vorsieht.
- **UI-Verantwortung:** Projektweite Tokens, Theme-Auflösung und semantische
  UI-Rezepte liegen ausschließlich in den drei Quellen der UI-Designsystem-
  Tabelle oben. Unistyles
- **Feature-first:** `src/app/` enthält Routing. Fachlogik lebt in
  `src/features/<domain>/`, geteilte UI in `src/components/`.
- **Native Runtime:** Expo SDK 57 und native Module setzen einen Dev Client
  voraus. Änderungen an nativen Abhängigkeiten, Config Plugins oder nativen
  Dateien erfordern einen neuen Build.

## Eigentümerschaft und Sichtbarkeit

| Datenbereich | Eigentümer | Sichtbarkeit |
| --- | --- | --- |
| Household, Members, Inventory, Shopping List, Recipes, Meal Plan | Haushalt | für berechtigte Mitglieder des Haushalts |
| Product | globaler Produktkatalog | unabhängig von einem Haushalt |
| Product Usage | einzelner Account, lokal | nur auf dem Gerät dieses Accounts |
| Nutrition Tracking und sonstiges Account-Tracking | einzelner Account | privat über RLS |
| Child Profile | Haushalt, verwaltet durch berechtigte Erwachsene | haushaltsbezogen; Kind-Tracking folgt ADR 0005 |

## Arbeitsrelevante Stolpersteine

- `bun test` ist nicht der Jest-Projektbefehl. Für JavaScript-/TypeScript-Tests
  gilt `bun run test <gezielter-pfad>`; die vollständige Suite wird nicht
  ungezielt gestartet.
- Neue synchronisierte Felder brauchen Parität in SQLite-Schema, Serialisierung,
  Outbox und Sync-Handler. Neue Tabellen brauchen RLS-Policies und pgTAP-Tests.
- Für jede sichtbare Mutation muss der Gegenweg mitgedacht werden, zum Beispiel
  Wiederherstellen nach Löschen oder Entfernen nach Hinzufügen.
- Bei UI-Änderungen gelten die Verträge unter
  [`docs/design-system/contracts/`](docs/design-system/contracts/README.md).
  Nichttriviale Layout- oder Copy-Änderungen brauchen vor der Implementierung
- A. Die Erlaubnis des Maintainers ohne Mockups oder B. Statische Mockups (die die app wiederspiegeln), die dem Maintainer eine auswahl geben und ihn überzeugen.
- Die Dev Maschine hat nur 8 GB RAM und 256gb internen speicher so wie externen Speicher der verwendet werden kann, eine Lokale Supabase-Datenbanken / Docker, kann nicht gleichzeitig neben dem Simulatoren, Metro-Prozess laufen da dies zuviele Ressourcen verbraucht. Die Dev Maschine ist daher ist es wichtig immer einmal kurz auslastung und rücksprache mit dem Maintainer zu halten, bevor man die Dev Maschine mit zuvielen Prozessen belastet.

## Language

**Kind im Haushalt**:
Unter Haushalt kann man "Kinder" anlegen bei diesen "Kindern" geht es rein um die Verwaltung und Kalkulation von Lebensmittel Mahlzeiten, es ist rein virtuell und hat nichts mit einem realen Kind zutun oder ist ein Account. Ein Kind kann nicht selbstständig auf die App zugreifen, es hat keine eigenen Login-Daten und kann nicht selbstständig Mahlzeiten oder Rezepte anlegen. Ein Kind ist ein virtuelles Profil, das von einem Erwachsenen verwaltet wird.

**Kind-Tracking**:
Tracking-Einträge, die zu einem Child Profile statt zu einem Account gehören, erfasst durch einen verwaltenden Erwachsenen. Zielmodell: der Eintrag gehört dem Child Profile, sichtbar für alle, die es verwalten dürfen; wer ihn erfasst hat, ist nur Herkunftsangabe. Keine Aufweichung der Tracking-Privatheit — die schützt Daten von Accounts, und ein Kind hat keinen. Gilt pro Domäne, nicht pauschal: ja bei Ernährung, Gewicht, Medikamenten, Symptomen, Glukose und Workouts, nicht bei Fasten, Ketonen und Aktivität. Umbau eingefroren, siehe ADR 0005.

**Nutrition Tracking**:
Der Ernährungs- und Gewichtsteil von Tracking: Mahlzeiten (`food_entries`), Gewicht (`weight_entries`), Ziele (`user_goals`). Eine von mehreren Tracking-Domänen, kein Oberbegriff.
_Avoid_: Diary, Ernährungstagebuch, Food Diary

**Tracking-Methode**:
Genau eine aktive, sich gegenseitig ausschließende Ernährungs-/Trainingsmethode pro Nutzer (`profiles.tracking_method`: `standard`, `glp1`, `fasting`, `keto`, `low_carb`, `workouts`, `cgm`, `volumetrics`). Kein Multi-Select — ein Wechsel ersetzt die vorherige Methode. Siehe ADR 0004.
_Avoid_: Modul (als Synonym — Module, z. B. `module_calories`, sind unabhängig voneinander kombinierbare App-Bereich-Umschalter; Tracking-Methode ist eine einzelne Auswahl innerhalb des Nutrition-Tracking-Moduls)

**Product**:
Globaler, nicht haushaltsgebundener Katalogeintrag (z. B. aus Open Food Facts) mit Barcode/Nährwertdaten. Existiert unabhängig von jedem Haushalt.

**Catalog Product**:
Quellneutrale Produktdarstellung für Suche und Barcode-Scan (`CatalogProduct`), wie sie der Product Catalog liefert. Kann aus dem eigenen Produktspiegel, dem lokalen OFF-Dump oder der OFF-API stammen — die Quelle ist für Konsumenten bewusst nicht erkennbar. Keine Identität mit Product: ein Catalog Product ist ein Suchtreffer, kein Katalogeintrag der Datenbank, und wird erst beim Übernehmen zu einem Product.
_Avoid_: Product (als Synonym), OpenFoodFactsProduct (alter Name — die Darstellung ist nicht mehr OFF-spezifisch)

**Product Catalog**:
Der local-first Service, über den die App Produkte findet (`createProductCatalog`) — die einzige Art, wie Textsuche und Barcode-Lookup laufen. Befragt drei Quellen in fester Priorität: eigener Produktspiegel, OFF-Dump, OFF-API. Der erste Treffer eines Barcodes gewinnt vollständig; es wird nie ein Feld aus einer tieferen Quelle nachgereicht. Die Online-Ebene wird nur befragt, wenn lokal zu wenig gefunden wurde und ein Netz da ist.
_Avoid_: Produktsuche (als Synonym für das Feature-Verzeichnis), Externe Produktdatenbank (OFF ist eine der Quellen des Katalogs, nicht der Katalog)

**Product Usage**:
Append-only, rein lokales Protokoll (`product_usage`, keine Sync/Outbox, kein Server-Gegenstück) jeder Verwendung eines Produkts über Kühlschrank, Einkaufsliste und Tagebuch hinweg. Pro einzelnem Nutzer (`user_id`), nicht pro Haushalt. Grundlage für „Häufig"/„Zuletzt"-Vorschläge, keine Entscheidung — reine Verhaltensdaten.
_Avoid_: Nutzungshistorie (als Synonym für Category Preference — unterschiedliche Konzepte, siehe dort)

**Inventory Item**:
Haushaltsgebundener Bestandseintrag (`fridge_items`) mit eigenem, eigenständigem Namen. Kann optional ein Product referenzieren, um Katalogdaten (Barcode, Nährwerte) zu übernehmen — die Referenz ist eine Anreicherung, keine Identität. Existiert auch ohne Product-Bezug (Freitext-Eintrag).
_Avoid_: Product (als Synonym), Fridge Item (als eigenständiger Begriff — ist dasselbe wie Inventory Item)

**Shopping List Item**:
Haushaltsgebundener Einkaufszettel-Eintrag (`shopping_list_items`). Gleiche Beziehung zu Product wie Inventory Item: eigener Name, optionale Product-Referenz zur Anreicherung.

**Category Preference** (Haushaltspräferenz):
Haushaltsweit geteilte, synchronisierte Entscheidung (`shopping_category_preferences`), welche Kategorie einem Product oder einem normalisierten Freitextnamen zugeordnet ist. Genau ein aktueller Wert pro `(household_id, key_type, normalized_key_value)`, überschreibbar und soft-deletebar — kein Log wie Product Usage, sondern ein Zustand, der die automatische Kategorisierung überstimmt.
_Avoid_: Product Usage (als Synonym — Category Preference ist eine bewusste, haushaltsweite Entscheidung, kein per-Nutzer-Verhaltensprotokoll)

**Shopping Run**:
Der Vorgang, einen Einkauf abzuschließen: mehrere abgehakte Shopping List Items werden in einem Schritt zu neuen Inventory Items transferiert. Keine geteilte Identität zwischen Quelle und Ziel — je ein neuer Inventory-Item-Datensatz pro Transfer, das Shopping List Item wird nur soft-deleted.

**Shopping History**:
Append-only-Protokoll abgeschlossener Shopping Runs (`shopping_history`), kein Offline-Sync. Überlebt unabhängig davon, ob das zugehörige Shopping List Item oder Inventory Item später gelöscht wird.

**Child Profile**:
Auth-loses Profil für ein Kind, gehört zum Household (nicht zu `auth.users`), verwaltet von einem Household Member. Verlässt der verwaltende Elternteil den Haushalt, bleibt das Profil erhalten — ein Admin kann es parallel verwalten (RLS erlaubt `managed_by`-Match ODER Admin-Rolle). `managed_by` selbst wird beim Verlassen aktuell **nicht** zurückgesetzt (bekannte Lücke, #188), zeigt danach also auf ein Nicht-Mitglied. Kann Ziel von Kind-Tracking sein und geht bei der Volljährigkeits-Übergabe in einen Account über.

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
