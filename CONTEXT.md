# fam: Projektkontext

**Status:** Freigegeben
**Letzte fachliche Prüfung:** 2026-09-23

`fam` ist eine datenschutzorientierte Haushaltsapp für Familien und andere
gemeinsame Haushalte. Sie verbindet geteilte Bestände, Einkaufslisten, Rezepte
und Wochenpläne mit privatem Ernährungs-, Gewichts- und Gesundheitstracking.
Der Produktname ist noch vorläufig; `fam` ist der aktuelle technische Name.

Diese Datei besitzt die verbindliche Domänensprache, Datenverantwortung und
fachlichen Grenzen. Sie ist keine zweite Implementierungsquelle und wiederholt
keine vollständigen Arbeits- oder Qualitätsregeln.

## Quellen und Verantwortlichkeiten

| Frage | Maßgebliche Quelle |
| --- | --- |
| Arbeitsweise, Tooling und Beitragsprozess | [`AGENTS.md`](AGENTS.md) |
| Qualitätsgrenzen und Nachweise | [`CONSTRAINTS.md`](CONSTRAINTS.md) |
| Domänensprache und Datenbesitz | `CONTEXT.md` |
| Produktziel und Roadmap | [`docs/features/VISION.md`](docs/features/VISION.md), [`docs/features/ROADMAP.md`](docs/features/ROADMAP.md) |
| Dauerhafte Architekturentscheidungen | [`docs/adr/`](docs/adr/README.md) |
| Vorhabenspezifisches Zielverhalten | freigegebene Feature-Spezifikation |
| Backend-Datenmodell und RLS | `supabase/schemas/*.sql` |
| Lokaler SQLite-Spiegel | `src/lib/db/schemas/*.ts` und lokale Migrationen |
| Aktuell implementiertes Laufzeitverhalten | Produktionscode und gezielte Tests |
| UI-Designsystem | `src/components/theme/index.ts`, `src/components/theme/ThemeProvider.tsx`, `src/constants/ui.tsx` (mit `src/constants/ui-shadow.ts` und `src/constants/motion.ts` als Module desselben UI-Owners) |

Diese Quellen beantworten unterschiedliche Fragen. Ein akzeptierter Vertrag
oder ADR beschreibt den beabsichtigten Zustand; Schema, Code und Tests belegen
den aktuellen Zustand. Weichen beide voneinander ab, wird die Differenz als
offene Implementierungs- oder Dokumentationsabweichung festgehalten. Der Code
wird nicht allein deshalb stillschweigend zum neuen fachlichen Vertrag.

Die vollständige Dokumentationslandkarte steht in
[`docs/README.md`](docs/README.md). Jede Spezifikation erklärt ihren eigenen
Status. `docs/archive/` ist historisch und nicht normativ.

## Datenklassen und Sichtbarkeit

| Datenklasse | Eigentümer | Sichtbarkeit und Grenze |
| --- | --- | --- |
| Household, Members, Inventory, Shopping List, Recipes, Meal Plans | Haushalt | für berechtigte Household Members über RLS |
| Product | globaler Produktkatalog | unabhängig von einem Haushalt; keine Identität mit Inventory oder Shopping List Items |
| Product Usage | einzelner Account auf einem Gerät | lokal und accountbezogen; kein Server-Gegenstück |
| Tracking eines erwachsenen Accounts | einzelner Account | privat über RLS; Household-Admins erhalten keinen Zugriff |
| Child Profile | Haushalt | Profil für Household Members sichtbar; Änderungen durch Manager oder Admin |
| Kind-Tracking | fachlich Child Profile, aktuell noch teilweise Account-gebunden | Zielmodell und aktueller Übergangszustand sind unten getrennt beschrieben |
| Recipe Template | global kuratierter Katalog | global lesbar, kein Household- oder Nutzer-Content |

Ein optionaler Product-Bezug reichert einen Bestands-, Einkaufs- oder
Trackingeintrag an. Er überträgt weder dessen Identität noch dessen Eigentümer.

## Nicht verhandelbare Architekturgrenzen

- **Datentrennung:** Geteilte Haushaltsdaten und private Account-Daten bleiben
  auf Datenbankebene getrennt. Eine Admin-Rolle im Haushalt gewährt keinen
  Zugriff auf private Daten eines erwachsenen Accounts.
- **Deklaratives Backend-Schema:** Änderungen beginnen in
  `supabase/schemas/*.sql`. Migrationen werden mit `bun run db:diff` erzeugt
  und niemals manuell verfasst oder editiert.
- **Local-first für synchronisierte Entitäten:** Eine synchronisierte Entität
  berücksichtigt lokalen SQLite-Spiegel, Outbox, Push, Pull, Realtime und
  Konfliktauflösung, soweit ihr Vertrag diese Flächen verwendet. Rein lokale
  oder bewusst nicht synchronisierte Protokolle werden ausdrücklich als solche
  benannt.
- **Feature-first:** `src/app/` enthält Routing. Fachlogik lebt in
  `src/features/<domain>/`, geteilte domänenlose UI in `src/components/` und
  Infrastruktur in `src/lib/`.
- **UI-Verantwortung:** Projektweite Tokens, Theme-Auflösung und semantische
  UI-Primitiven gehören ausschließlich den drei Ownern in der Tabelle oben.
  `src/constants/ui-shadow.ts` ergänzt den UI-Owner aus `ui.tsx`; es ist kein
  vierter Owner. Feature-Code besitzt Verhalten, Komposition und lokales Layout.
- **Native Runtime:** Expo SDK 57 und die verwendeten nativen Module verlangen
  einen Dev Client. Änderungen an nativen Abhängigkeiten, Config Plugins oder
  nativen Projekten verändern den Native Fingerprint und können einen Rebuild
  erfordern.

## Domänensprache

### Household

Die geteilte Entität für Mitglieder, Bestand, Einkaufslisten, Rezepte,
Wochenpläne und Einladungen. Daten eines Households sind nur für Mitglieder
sichtbar, deren Rolle und RLS-Policy den Zugriff erlauben.

### Household Member und Role

Die Mitgliedschaft eines Accounts in einem Household. `Role` ist die
Autorisierungsstufe `admin` oder `member`; sie ist kein Synonym für
Postgres-Privileges.

Jeder nicht leere Household braucht mindestens einen Admin. Der letzte Admin
darf gehen, wenn damit auch das letzte Mitglied geht. Danach löscht
`private.delete_orphaned_household()` den leeren Household samt abhängigen
Daten. Ein verwaister, dauerhaft unerreichbarer Household ist nicht mehr das
beabsichtigte Verhalten.

### Product

Globaler, nicht haushaltsgebundener Katalogeintrag mit optionalen Barcode-,
Marken- und Nährwertdaten. Ein Product existiert unabhängig von Inventory und
Shopping List Items.

### Open Food Facts

Externe Datenquelle für Produktsuche, Barcodes, Nährwerte und Kategorien. Open
Food Facts ist eine Quelle des Product Catalog, nicht dessen Identität und nicht
die alleinige fachliche Wahrheit. Übernommene Daten werden lokal dargestellt
oder in einen Product-Datensatz überführt.

### Catalog Product

Quellneutrale Such- und Barcode-Darstellung `CatalogProduct`. Sie kann aus dem
eigenen Produktspiegel, dem lokalen Open-Food-Facts-Dump oder der API stammen.
Für Konsumenten bleibt die Quelle verborgen. Ein Catalog Product ist noch kein
Product-Datensatz; beim Übernehmen kann daraus ein Product-Bezug entstehen.

Nicht als Synonym verwenden: `Product`, `OpenFoodFactsProduct`.

### Product Catalog

Der local-first Service `createProductCatalog` und die einzige reguläre
Schnittstelle für Produktsuche und Barcode-Lookup. Seine Quellenpriorität ist:

1. eigener lokaler Produktspiegel,
2. lokaler Open-Food-Facts-Dump,
3. Open-Food-Facts-API, wenn Onlinezugriff erlaubt und nötig ist.

Beim Barcode-Lookup gewinnt der erste Treffer vollständig. Bei der Textsuche
werden Treffer tieferer Quellen ergänzt und anhand des Barcodes dedupliziert;
Felder unterschiedlicher Quellen werden nicht miteinander verschmolzen.

### Product Usage

Append-only, rein lokales Protokoll `product_usage` für die Verwendung eines
Produkts in Bestand, Einkaufsliste oder Ernährungstracking. Es gehört einem
Account über `user_id`, besitzt keine Outbox und kein Server-Gegenstück und
liefert lediglich Signale für häufige oder letzte Produkte.

Nicht als Synonym verwenden: `Category Preference` oder allgemeine
Nutzungshistorie eines Households.

### Inventory Item

Haushaltsgebundener Bestandseintrag `fridge_items` mit eigener Identität und
eigenem Namen. Ein optionaler Product-Bezug reichert ihn an; auch Freitext ohne
Product ist zulässig. `Fridge Item` bezeichnet denselben Begriff und keine
zweite Entität.

### Shopping List Item

Haushaltsgebundener Einkaufszettel-Eintrag `shopping_list_items` mit eigener
Identität und eigenem Namen. Ein optionaler Product-Bezug ist eine Anreicherung,
keine Identität.

### Category Preference

Haushaltsweit geteilte, synchronisierte Entscheidung
`shopping_category_preferences`, welche Kategorie einem Product, Barcode oder
normalisierten Freitextnamen zugeordnet wird. Sie ist überschreibbar und
soft-deletebar. Eine Category Preference ist ein aktueller Zustand, kein
Verhaltensprotokoll wie Product Usage.

### Shopping Run

Der fachliche Vorgang, abgehakte Shopping List Items in neue Inventory Items zu
übertragen. Quelle und Ziel teilen keine Identität. Pro Transfer entsteht ein
neuer Inventory-Item-Datensatz; das Shopping List Item wird soft-gelöscht.

### Shopping History

Protokoll abgeschlossener Shopping Runs in `shopping_history`. Der aktuelle
App-Pfad schreibt diese Historie lokal ohne Outbox; das deklarative Backend-
Schema besitzt ebenfalls eine Tabelle, wird durch diesen Pfad aber nicht
synchronisiert. Deshalb darf Shopping History aktuell weder als
geräteübergreifend vollständig noch als verlässliche Serverhistorie behandelt
werden.

Fachlich soll die Historie append-only sein und unabhängig vom späteren Löschen
der Quell- oder Zieleinträge fortbestehen. Die aktuelle Backend-Policy
`shopping_history_all_member FOR ALL` erzwingt Append-only jedoch nicht. Diese
Abweichung muss vor einer servergestützten Nutzung behoben und mit pgTAP-Tests
belegt werden.

### Tracking

Oberbegriff für private, RLS-isolierte Account-Daten: Nutrition Tracking,
Medikamente und Symptome, Fasten, Vitalwerte und Workouts. Tracking eines
erwachsenen Accounts bleibt privat und ist nicht automatisch Household-Daten.

### Nutrition Tracking

Ernährungs- und Gewichtsteil des Trackings: Mahlzeiten `food_entries`, Gewicht
`weight_entries` und Ziele `user_goals`. Es ist eine Tracking-Domäne, nicht der
Oberbegriff für alle Tracking-Funktionen.

Nicht verwenden: `Diary`, `Ernährungstagebuch`, `Food Diary`.

### Tracking-Methode

Genau eine aktive Ernährungs- oder Trainingsmethode pro Account in
`profiles.tracking_method`: `standard`, `glp1`, `fasting`, `keto`, `low_carb`,
`workouts`, `cgm` oder `volumetrics`. Die Auswahl ist exklusiv; ein Wechsel
ersetzt die vorherige Methode. Unabhängige `module_*`-Schalter bleiben davon
getrennt. Maßgeblich ist [ADR 0004](docs/adr/0004-exclusive-tracking-method.md).

### Child Profile

Auth-loses Profil eines Kindes innerhalb eines Households. Es ist kein Account,
besitzt keine Login-Daten und greift nicht selbstständig auf die App zu. Ein
Erwachsener verwaltet damit Mahlzeiten und andere freigegebene Bereiche.

Alle Household Members dürfen das Profil sehen. Ändern und löschen dürfen der
über `managed_by` eingetragene Manager oder ein Household-Admin. Verlässt der
Manager nur den Household, bleibt `managed_by` aktuell auf dessen Profil
stehen, obwohl die Person kein Mitglied mehr ist. Admins können das Child
Profile weiterhin verwalten; die veraltete Manager-Zuordnung ist eine bekannte
Implementierungslücke.

### Kind-Tracking: aktueller Zustand

Mehrere Trackingtabellen besitzen bereits `child_profile_id`, und die App kann
ein Child Profile als aktives Profil auswählen. Die RLS bindet bestehende
Einträge derzeit weiterhin über `user_id` an den erfassenden Erwachsenen. Zwei
verwaltende Erwachsene teilen daher nicht automatisch dieselbe vollständige
Trackinghistorie des Kindes.

### Kind-Tracking: akzeptiertes Zielmodell

Fachlich gehört ein Kind-Tracking-Eintrag dem Child Profile. `user_id` ist dann
nur Audit-Herkunft. Zugriff erhalten Manager und Household-Admins, nicht alle
Household Members. Dieser Umbau ist gemäß
[ADR 0005](docs/adr/0005-kind-tracking-gehoert-dem-kindprofil.md) eingefroren,
bis konkrete Nachfrage nach Kind-Tracking oder der Volljährigkeitsübergabe ihn
auslöst.

Der Zielumfang gilt pro Domäne: Ernährung, Gewicht, Medikamente, Symptome,
Glukose und Workouts gehören dazu. Fasten, Ketone und Aktivität gehören nicht
dazu. Neue Tabellen erhalten während des Frosts kein vorsorgliches
`child_profile_id`.

### Recipe

Household-eigenes, editierbares Rezept mit Autor und Soft-Delete. Es besteht
aus Recipe Components und Recipe Steps.

### Recipe Component

Kompositionsbaustein eines Recipes, zum Beispiel „Nudeln“ oder „Soße“. Eine
oberste Component kann eine Portionsmenge besitzen und besteht aus Recipe
Component Items.

### Recipe Component Item

Position innerhalb einer Recipe Component. Sie verweist entweder auf ein
Product mit Menge oder rekursiv auf eine andere Component desselben Recipes.
`Ingredient` oder `Zutat` ist nur für den Product-Fall informell korrekt und
kein vollständiges Synonym.

### Recipe Step

Geordneter Zubereitungsschritt. Recipe Step Ingredients referenzieren die in
diesem Schritt verwendeten Recipe Component Items für die Anzeige; sie bilden
keine zweite Zutatenlogik.

### Recipe Template

Admin-kuratiertes, global lesbares Rezept in einer eigenen Tabellenfamilie. Es
ist kein Nutzer-Content, besitzt keinen Autor und kein Soft-Delete. Ein
Household kopiert ein Template in ein eigenes Recipe. Recipe Templates gehören
nicht zum lokalen SQLite-Spiegel. Maßgeblich ist
[ADR 0002](docs/adr/0002-recipe-templates-separate-table-family.md).

### Meal Plan

Haushaltsweit geteilter Wochenplan mit `week_start_date`. Pro Household und
Kalenderwoche existiert genau ein aktiver Plan. Er enthält Meal Plan Entries.

### Meal Plan Entry

Ordnet ein Recipe einem Tag und einer Mahlzeit samt Mengenangabe zu. Eine
Zuordnung zu einzelnen Household Members oder Child Profiles ist nicht Teil
dieses Modells.

## Änderungsfolgen

- Neue oder geänderte synchronisierte Felder müssen über alle tatsächlich
  verwendeten Sync-Flächen konsistent bleiben.
- Neue Backend-Tabellen brauchen explizite RLS-Policies und fokussierte
  pgTAP-Tests.
- Neue fachliche Begriffe werden hier definiert; dauerhafte, teure
  Architekturentscheidungen erhalten ein ADR.
- Offene Abweichungen zwischen Zielvertrag und Implementierung werden benannt
  und getestet, nicht durch unklare Formulierungen verdeckt.

Test-, Build-, UI- und Ressourcenregeln stehen in [`AGENTS.md`](AGENTS.md) und
[`CONSTRAINTS.md`](CONSTRAINTS.md). Details zum Mutation-Testing-Pilot stehen in
[`docs/spec/spec-mutation-testing-pilot.md`](docs/spec/spec-mutation-testing-pilot.md)
und im
[`Pilotbericht`](docs/spec/mutation-testing-pilot-report.md).
