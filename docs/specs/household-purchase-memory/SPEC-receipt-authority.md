# Spec: Receipt Authority

**Status:** Freigegeben, Phase 1  
**Version:** 0.1  
**Capability-ID:** `receipt-authority`  
**Bezug:** [Capability Map](./CAPABILITY_MAP.md)  
**Idee:** [Haushalts-Einkaufsgedächtnis](../../ideas/haushalts-einkaufsgedaechtnis.md)  
**Bead:** `fam-qesi.1`  
**Initiative-Bead:** `fam-qesi`  
**Freigabe:** 2026-09-20, Marco

## 1. Objective

`receipt-authority` definiert die autoritative Haushaltsgrenze für Kassenbons:
strukturierte Belegdaten, Positionen, finale bezahlte Summe, Status und
Belegbilder. Das Modul stellt sicher, dass alle Haushaltsmitglieder denselben
bestätigten Belegzustand sehen, private Tracking-Daten ausgeschlossen bleiben
und Bilder nur über private, zeitlich begrenzte Zugriffe erreichbar sind.

Die Authority ist keine OCR-Engine und kein Reporting-Modul. Sie speichert
normalisierte, prüfbare Ergebnisse und stellt die Grundlage für Capture,
Learning, Processing und Insights bereit.

Nach der Bestätigung bleiben Kaufdatum, vorhandener Markt, Gesamtsumme und die
bestätigten Artikel mit ihren beobachteten Preisen dauerhaft als strukturierte
Receipt-Daten erhalten. Bonbilder sind davon getrennte private Assets und
können gelöscht werden, ohne diese Informationen zu entfernen. Rohes
OCR-Volltextmaterial wird nicht dauerhaft gespeichert.

## 2. Fixed decisions and assumptions

Diese Entscheidungen sind mit der Freigabe verbindlich:

- Alle Mitglieder des aktiven Haushalts dürfen Belege und Positionen lesen,
  korrigieren, soft-deleten, wiederherstellen und Belegbilder entfernen.
- Ein Receipt darf mehrere Bilder/Seiten besitzen. Die MVP-UI muss mehrere
  Assets pro Receipt unterstützen.
- Strukturierte Daten bleiben erhalten, wenn ein Bild oder alle Bilder entfernt
  werden.
- Die Währung ist im MVP ausschließlich `EUR`.
- Rabatt-, Coupon-, Pfand- und Treuekartenzeilen werden nicht als eigene
  Positionen modelliert. Es gibt keine Rabatt-Sonderlogik im Authority-Modul.
  Wenn ein bezahlter Positionsbetrag eindeutig vorliegt, wird er als
  beobachteter Kassenpreis gespeichert; ist er nicht eindeutig, bleibt er
  `null`.
- Strukturierte Receipts und Items werden offline gespiegelt und über die
  Outbox synchronisiert. `receipt_assets` ist nur ein serverseitiger Index für
  Storage-Objekte und wird nicht als SQLite-Sync-Entity geführt. Asset-Upload
  und -Löschung bleiben Capture-/Upload-Queue-Verantwortung.
- Ein Receipt wird einem bestehenden `stores`-Eintrag des Haushalts
  zugeordnet. Automatisches Anlegen eines Marktes ist nicht Teil des MVP.
- Bestehende Shopping-Kategorie-IDs werden wiederverwendet. Eine neue
  Receipt-Kategorie-Taxonomie ist nicht zulässig.
- Rohes OCR-Volltextmaterial wird nicht dauerhaft als Receipt-Daten gespeichert.
- Receipt-Mutationen besitzen keine fachliche oder technische Nebenwirkung auf
  Inventory, Fridge oder Shopping List. Es werden keine entsprechenden
  Outbox-Operationen erzeugt.
- Bestätigte Receipts werden für eine datumssortierte Historie mit Gesamtsumme
  und bestätigten Artikelpreisen gelesen. Fehlende Item-Preise bleiben `null`.
- Ein späteres Verknüpfen wiederkehrender Positionen darf ausschließlich einen
  expliziten Produktbezug ergänzen; es verändert keinen Bestand.

## 3. Scope

### In scope

- Kanonisches Modell für `purchase_receipts`, `purchase_receipt_items` und `receipt_assets`.
- Endstatus und Review-Lifecycle für OCR-Ergebnis und manuelle Korrektur.
- EUR-Beträge als ganzzahlige Centwerte.
- Optionaler Markt- und Produktbezug.
- Beobachtete Positionspreise ohne Normalpreis- oder Rabattinterpretation.
- Mehrere private Bild-Assets je Receipt.
- Haushaltsspezifische RLS- und Storage-Autorisierung.
- Signierte Bildzugriffe und unabhängige Bildlöschung.
- Offline-Spiegelung und Outbox-Synchronisation von Receipts und Items.
- Serverseitige Aufbewahrung des strukturierten Belegs nach Bildlöschung.

### Out of scope

- Kamera, Galerie, Kompression und Upload-Queue.
- OCR, Parsing, Konfidenzberechnung und Erkennung von Zeilentypen.
- Haushalts- oder marktbezogenes Lernen.
- Automatische Bestandsupdates oder Budgetlogik.
- Preisempfehlungen, günstigster Markt und Normalpreis-Erkennung.
- Kalorien-, Gewichts-, Medikamenten- oder sonstige private Tracking-Daten.
- Speicherung von Rabatt-, Coupon-, Pfand- oder Treuekartendetails.
- Dauerhaftes Rohbild- oder OCR-Archiv.

## 4. Canonical data contract

### `purchase_receipts`

Eine Zeile repräsentiert einen Einkauf eines Haushalts.

| Feld | Vertrag |
|---|---|
| `id` | UUID, Client-ID möglich, Primärschlüssel und Idempotenzschlüssel |
| `household_id` | UUID, Pflicht, Referenz auf `households` |
| `store_id` | UUID, optional, Referenz auf einen bestehenden Haushaltsmarkt |
| `purchase_date` | Datum, optional bis zur Korrektur |
| `currency` | Pflicht, ausschließlich `EUR` |
| `total_cents` | Nichtnegative Centzahl, optional während Verarbeitung, autoritativ sobald erkannt/bestätigt |
| `processing_status` | `draft`, `processing`, `needs_review`, `confirmed`, `failed` |
| `created_by` | Ersteller-UUID, beim Insert gleich `auth.uid()` |
| `confirmed_by` | optionale UUID des letzten bestätigenden Mitglieds |
| `confirmed_at` | optionaler Zeitpunkt der letzten Bestätigung |
| `created_at` / `updated_at` | serverseitige Zeitstempel |
| `deleted_at` | optionaler Soft-Delete-Timestamp für Offline-Sync |

`total_cents` darf von der Summe der gespeicherten Items abweichen. Das ist
absichtlich, weil herausgefilterte Nicht-Produktzeilen und nicht zuordenbare
Rabatt-/Pfandanteile nicht als Items gespeichert werden.

### `purchase_receipt_items`

Eine Zeile repräsentiert eine relevante, normalisierte Produktposition eines
Receipts. Nicht-Produktzeilen werden vor dem Authority-Write verworfen.

| Feld | Vertrag |
|---|---|
| `id` | UUID, Primärschlüssel |
| `receipt_id` | UUID, Pflicht, Referenz auf `purchase_receipts` |
| `household_id` | UUID, Pflicht, redundanter Scope für RLS und Sync |
| `position` | Nichtnegative, receipt-lokale Anzeigereihenfolge |
| `name` | Nichtleerer kanonischer Anzeigename |
| `product_id` | Optionaler Bezug auf globales `products`-Register |
| `category_id` | Optionale bestehende Shopping-Kategorie-ID |
| `quantity` / `unit` | Optionale normalisierte Menge; keine stillen Fantasiewerte |
| `package_size` / `package_size_unit` | Optional; nur wenn sicher erkannt |
| `line_total_cents` | Optionaler beobachteter Kassenpreis in EUR-Cent |
| `review_status` | `needs_review` oder `confirmed` |
| `created_at` / `updated_at` | serverseitige Zeitstempel |
| `deleted_at` | optionaler Soft-Delete-Timestamp |

Für Preisverläufe darf später nur eine Position mit sicherem `product_id` und
sicherer Packungsgröße verwendet werden. Das Authority-Modul speichert dafür
die Rohwerte, normalisiert aber keinen Grundpreis.

### `receipt_assets`

Eine Receipt kann null, ein oder mehrere Assets haben. Diese Tabelle ist der
serverseitige Storage-Index, keine allgemeine Sync-Entity.

| Feld | Vertrag |
|---|---|
| `id` | UUID, Primärschlüssel |
| `receipt_id` / `household_id` | Pflicht, Scope- und Zuordnungsreferenzen |
| `storage_path` | Kanonischer privater Pfad, nicht frei vom Client wählbar |
| `mime_type` | Erlaubtes Bildformat |
| `byte_size` | Positive Größe innerhalb des Bucket-Limits |
| `sort_order` | Nichtnegative Seitenreihenfolge |
| `created_by` | Mitglied, das das Asset angelegt hat |
| `created_at` | serverseitiger Zeitstempel |
| `deleted_at` | optionaler Index-Tombstone nach Bildlöschung |

Der kanonische Pfad lautet `<household_id>/<receipt_id>/<asset_id>.<ext>`.
Aktive Assets erhalten nur über eine kurzlebige Signed URL Zugriff. Das
Entfernen eines Assets darf die Receipt- oder Item-Zeilen nicht löschen.

## 5. Lifecycle and invariants

Der fachliche Status läuft grundsätzlich so:

```text
draft -> processing -> needs_review -> confirmed
  |          |              |              |
  +-------> failed <--------+--------------+
```

Konkrete Regeln:

1. `draft` kann offline erstellt und später synchronisiert werden.
2. `processing` bedeutet, dass eine Verarbeitung läuft; die Authority muss
   keine OCR-Ausführung kennen.
3. `needs_review` bleibt sichtbar, solange ein Pflichtfeld oder eine Position
   unbestätigt ist.
4. `confirmed` ist die einzige Quelle für Insights und Aggregationen.
5. Korrekturen an einem bestätigten Receipt oder Item setzen den betroffenen
   Review-Status wieder auf `needs_review`; eine erneute Bestätigung ist nötig.
6. `failed` darf zurück nach `draft` gesetzt werden, ohne Datenverlust.
7. Soft-Delete und Restore sind Gegenstücke und unabhängig vom
   `processing_status`. Beide dürfen von jedem Haushaltsmitglied ausgeführt
   werden und werden über die Outbox synchronisiert.
8. `purchase_receipt_items.household_id` muss immer dem `purchase_receipts.household_id`
   entsprechen. Die Datenbank erzwingt dies per zusammengesetzter Referenz
   oder gleichwertiger serverseitiger Konsistenzprüfung.
9. Ein Receipt darf nur auf einen nicht gelöschten Markt desselben Haushalts
   zeigen. Ein Item darf nur auf ein globales `products`-Register zeigen.
10. `created_by` und `confirmed_by` dürfen nicht als fremde Benutzerwerte
    eingeschleust werden; Schreibpfade verwenden `auth.uid()`.
11. Ein Receipt ohne Bild bleibt ein gültiger strukturierter Datensatz.
12. Rohes OCR darf nach der Normalisierung nicht in den kanonischen Tabellen
    landen.
13. Create, Update, Confirm, Delete und Restore eines Receipts oder Items
    verändern keine Inventory-, Fridge- oder Shopping-List-Zeile und erzeugen
    keine entsprechende Outbox-Operation.
14. Die Receipt-Historie sortiert bestätigte Receipts nach `purchase_date`
    absteigend und verwendet einen stabilen Zeitstempel nur als Tie-Breaker.

## 6. Authorization, RLS and Storage

- `purchase_receipts`, `purchase_receipt_items` und `receipt_assets` haben aktiviertes RLS.
- Jede sichtbare oder mutierende Operation prüft
  `private.is_household_member(household_id)`.
- Policies verwenden sowohl `USING` als auch `WITH CHECK`; ein
  `TO authenticated` ohne Haushaltsbedingung ist nicht zulässig.
- Alle Haushaltsmitglieder dürfen lesen, insertieren, korrigieren,
  soft-deleten, restoren und Assets entfernen. Admin-/Uploader-Sonderrechte
  werden im MVP nicht eingeführt.
- Der Bucket `receipt-images` ist privat. Die Storage-Policies prüfen den
  ersten Pfadbestandteil als UUID-Haushalt und erlauben nur Mitgliedern des
  Haushalts Zugriff.
- Es gibt Select-, Insert-, Update- und Delete-Policies für die privaten
  Receipt-Objekte. Update-Policies enthalten `USING` und `WITH CHECK`.
- Die Bucket-Grenze beträgt 5 MiB pro komprimiertem Bild, analog zu den
  bestehenden privaten Rezept-Buckets. Die UI-Kompression gehört in
  `receipt-capture`.
- Supabase Storage ist kein deklaratives Schemaobjekt. Die Policy-Quelle wird
  in `supabase/schemas/` dokumentiert, der Bucket in `supabase/seed.sql`
  angelegt und die wirksame Storage-Policy als explizite Ausnahme-Migration
  gepflegt. Das folgt dem bestehenden Projektvertrag.
- Private Asset-Pfade werden nie als öffentliche URL oder dauerhaftes
  Access-Token in Receipt-Daten gespeichert.

## 7. Local-first and sync contract

### Offline-authoritative entities

Nur `purchase_receipts` und `purchase_receipt_items` werden als synchronisierte SQLite-Spiegel
geführt:

- Beide erhalten `household_id`, `updated_at`, `deleted_at` und `_dirty`.
- Beide erhalten Einträge in `Entity`, `ENTITIES` und `ALL_ENTITIES` sowie
  Realtime-Subscriptions.
- Beide verwenden die generische Pull-/Push-/Realtime-Engine. Keine neue
  Receipt-spezifische Sync-Sonderlogik ist erlaubt, solange die generische
  Engine den Vertrag erfüllt.
- Receipt-Items werden nach Receipt-Reihenfolge gelesen; die Sync-Reihenfolge
  darf keine fachliche Parent-Child-Transaktion voraussetzen.

### Assets

`receipt_assets` wird nicht in `Entity`, `ALL_ENTITIES`, `REALTIME_TABLES`,
SQLite-Spiegel oder Outbox aufgenommen. Die Capture-Spec darf lokale Dateien
und einen Upload-Zustand führen, aber diese Queue ist kein serverweiter
Receipt-Asset-Sync. Die Anzeige lädt Asset-Metadaten und Signed URLs bei
Bedarf online. Offline bleibt die strukturierte Receipt-Anzeige nutzbar.

### Parent visibility barrier for asset upload

„Bon speichern“ bezeichnet den strukturierten Bon (`purchase_receipts`) und
seine Artikelpositionen (`purchase_receipt_items`). Das Foto ist ein separater
Storage-Upload; dessen Metadaten benötigen den übergeordneten Bon als Parent.

Die Umsetzung und Abnahme werden in Beads unter `fam-p7e2` geführt:
`fam-p7e2.1` dokumentiert den Vertrag, `fam-p7e2.2` prüft die Reihenfolge und
Offline-Wiederholung, `fam-p7e2.3` prüft den einzigen nativen Transport.
Abnahme: Ein verzögerter Sync verhindert bereits das Lesen und Hochladen der
ersten Bilddatei. Ein Sync-Fehler erhält alle lokalen Seiten; ein späterer
Versuch wartet erneut genau einmal und lädt die Seiten in Reihenfolge hoch.
Die native Prüfung muss alle fünf Dateigrößen erfolgreich übertragen.
Ein grüner Unit-Test ersetzt diesen nativen Nachweis nicht.

Ein lokaler Authority-Commit ist noch kein serverseitig sichtbarer Parent.
Der Asset-Upload darf deshalb erst nach einem erfolgreichen
`purchase_receipts`-Push für denselben `household_id` und `receipt_id`
ausgeführt werden. Die bestehende Upload-Queue bleibt Owner dieses Ablaufs
und wartet einmal pro Upload-Versuch vor der ersten Seite auf den bestehenden
Haushaltssync. Owner: `capture/capture/upload-queue.ts`; der Review-Flow
verdrahtet `triggerHouseholdSyncAfterOutboxMutation`. Es gibt keinen ersten
fehlgeschlagenen Upload als Auslöser für die Synchronisierung.

Die Sync-Rückgabe bestätigt einen Haushaltslauf, keinen einzelnen Bon.
Deshalb behält `capture/capture/supabase-upload.ts` seine bestehende Prüfung
von `purchase_receipts` mit `household_id` und `receipt_id` vor dem Storage-POST.
Erst eine verbindliche Bestätigung des konkreten Parent-Pushs würde diese
Abfrage ersetzen. Ein fehlender Parent oder fehlgeschlagener Sync lässt die
lokalen Bondaten und Bilddateien für einen späteren Versuch bestehen.

Der einzige Bildtransport ist `Uint8Array` über `supabase.storage.upload()`
und das zentrale `expo/fetch` in `src/lib/backend/supabase/client.ts`.
Begrenzte Wiederholungen bei vorübergehenden Transportfehlern verwenden
denselben Transport. Keine direkten Storage-REST- oder Body-Fallbacks.
Die native Transportprüfung verlangt Erfolg für jede geprüfte Dateigröße.

Der Sync-Owner erfüllt dafür drei Regeln:

1. Ein paralleler Aufrufer desselben Haushalts wartet auf den laufenden
   Sync-Lauf, statt mit einem verlorenen `null`-Ergebnis abgewiesen zu werden.
2. Wird eine Outbox-Mutation nach Erstellung des Push-Snapshots geschrieben,
   garantiert der Owner einen abschließenden Folge-Lauf, bevor ein wartender
   Parent-Barrier-Aufruf erfolgreich zurückkehrt.
3. Warte- und Folge-Läufe bleiben auf den angeforderten Account- und
   Haushaltsscope begrenzt. Ein laufender Lauf eines anderen Scopes darf den
   Parent-Barrier-Aufruf nicht erfüllen.

Der Barrier-Vertrag ändert weder die Datenbankgrenze noch die FK-/RLS-Regeln:
`receipt_assets` bleibt ein serverseitiger Index, und ein Storage-Upload ohne
remote sichtbaren Parent bleibt ein explizit zurückgestellter Fehler.

## 8. Tech Stack and project structure

- Backend: Supabase Postgres, Auth, Realtime und private Storage-Objekte.
- Serverseitiges Schema: ausschließlich `supabase/schemas/*.sql`; Migrationen
  ausschließlich über `bun run db:diff`.
- Lokaler Spiegel: Drizzle-Schema unter `src/lib/db/schemas/`, SQLite-
  Migrationen über den vorhandenen Drizzle-Workflow sowie die bestehende
  lokale Migrationskette.
- Server-/App-Typen: generiert mit `bun run db:types`.
- Datenzugriff: React Query für Server-/Cache-Zustand; Zustand nur für
  UI-/Queue-Zustand.
- Styling und UI sind nicht Bestandteil dieser Authority-Implementierung.

Vorgesehene Dateien:

```text
docs/specs/household-purchase-memory/
  CAPABILITY_MAP.md
  SPEC-receipt-authority.md

supabase/schemas/26_receipts.sql
supabase/schemas/27_receipt_storage.sql
supabase/tests/26_receipts.test.sql
supabase/tests/27_receipt_storage.test.sql

src/features/ocr/authority/
  domain/types.ts
  domain/status.ts
  domain/status.test.ts
  api.ts

src/lib/db/schemas/receipts.ts
src/lib/db/schemas/index.ts
src/lib/db/migrations.ts
src/lib/db/types.ts
src/lib/db/entities.ts
src/lib/sync/realtime.ts
```

Generierte Dateien und Migrationen werden nicht von Hand geschrieben oder
editiert:

- `supabase/migrations/*` aus `bun run db:diff`, ausgenommen die im Projekt
  dokumentierten Storage-Ausnahme-Migrationen.
- `src/lib/database.types.ts` aus `bun run db:types`.
- `drizzle/local/*` aus `bun run db:local:generate`.

## 9. Commands

```bash
bun run db:diff -- -f purchase_receipts
bun run db:reset
bun run test:db supabase/tests/26_receipts.test.sql supabase/tests/27_receipt_storage.test.sql
bun run db:advisors
bun run db:diff
bun run db:types
bun run db:local:generate
bun run check
bun run typecheck
bun run test src/features/ocr/authority/domain/status.test.ts
```

Die genaue Testausführung richtet sich nach den vorhandenen Script-Argumenten;
die Tests bleiben fokussiert. Eine vollständige Testsuite ist für diese Spec-
Phase nicht erforderlich.

## 10. Testing strategy

### Domain tests

- erlaubte Statusübergänge einschließlich Rückkehr von `confirmed` zu
  `needs_review` nach Korrektur;
- EUR-Cent-Invarianten und optionale Felder;
- Soft-Delete/Restore als Gegenpaare;
- keine Rabatt-Sonderlogik und kein erfundener Positionspreis.

### Postgres/pgTAP

- Haushaltsmitglieder sehen und ändern Receipt-, Item- und Asset-Metadaten;
- Außenstehende sehen und mutieren keine fremden Zeilen;
- `WITH CHECK` verhindert fremde `household_id`-Werte;
- Receipt-Item und Receipt dürfen nicht über Haushalte hinweg verknüpft
  werden;
- Marktbezug ist auf den eigenen Haushalt beschränkt;
- Soft-Delete lässt strukturierte Daten bestehen;
- Storage-Bucket ist privat und Pfad-Scope folgt dem Haushalt;
- Signed-URL-Zugriff ist nur für aktive, autorisierte Assets vorgesehen.

### Local sync tests

- SQLite-Spiegel enthält Receipts und Items mit allen `Entity`-Spalten;
- `receipt_assets` erscheint weder im SQLite-Schema noch in `ALL_ENTITIES`;
- Insert, Update, Delete und Restore erzeugen die erwartete Outbox-Parität;
- Pull, Push und Realtime übernehmen strukturierte Daten generisch;
- Bildbytes landen nie in SQLite oder Outbox.
- Ein Parent-Barrier-Aufruf wartet auf konkurrierende Sync-Läufe und auf einen
  erforderlichen Folge-Lauf für Mutationen, die nach dem Push-Snapshot
  geschrieben wurden.
- Vor der ersten Seite wird die Barrier einmal abgewartet; währenddessen
  startet kein Bild-Upload. Ein Sync-Fehler erhält den lokalen Entwurf.
- Ohne remote Parent bleibt der Upload zurückgestellt; die Queue startet
  keinen zweiten Sync-Lauf als Reaktion auf einen Uploadfehler.

## 11. Boundaries for the next modules

`receipt-capture` darf die Authority nur über die hier definierten Asset-
Metadaten und Upload-Übergaben ansprechen. Es darf keine OCR-Bedeutung in
Capture-Typen einschleusen.

`receipt-processing` darf einen `ReceiptDraft` mit unvollständigen oder
unsicheren Feldern liefern. Die Authority speichert nur die normalisierte
Struktur und entscheidet anhand des Status, ob sie bestätigt ist.

`receipt-learning` liefert Hinweise für `product_id`, `category_id`, Markt-
oder Namenszuordnung. Diese Hinweise überschreiben keine bestätigten Werte
ohne einen expliziten Korrektur-Write.

`spending-insights` liest ausschließlich `confirmed`-Receipts und nicht
gelöschte Items. Es darf keine private Tracking-Tabelle joinen.

## 12. Success criteria

Die Authority-Spec ist erfolgreich umgesetzt, wenn:

1. ein Receipt mit mehreren Bildern und mehreren Items modelliert und von
   allen Haushaltsmitgliedern sicher bearbeitet werden kann;
2. finale EUR-Cents unabhängig von der Summe der Items erhalten bleiben;
3. Bildlöschung die strukturierten Daten nicht entfernt;
4. kein Storage-Objekt über eine öffentliche URL erreichbar ist;
5. Receipts und Items offline bearbeitbar und synchronisierbar sind, während
   Asset-Metadaten bewusst serverseitig/on-demand bleiben;
6. fremde Haushalte weder über Postgres-RLS noch über Storage-Policies sichtbar
   oder mutierbar sind;
7. die fünf Capability-Grenzen keine Authority-, OCR-, Learning- oder
   Reporting-Logik vermischen.

## Specify gate

Dieses Dokument ist nach den bestätigten Antworten freigegeben. Die nächste
Phase ist die Umsetzung gemäß `tasks/plan.md`. Weitere offene Entscheidungen
liegen bewusst in den späteren Modul-Specs; sie blockieren die Planung der
Authority nicht.
