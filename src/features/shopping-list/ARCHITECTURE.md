# Shopping-List — Dateien nach Verantwortungsschicht

Kurzreferenz für dieses Feature, gegliedert nach Verantwortungsschicht statt nach
Ordner — macht bei einer Änderung sofort klar, was mitgezogen werden muss (z. B.
Kategorie-Farbe ändern → nur `domain-logik/`, keine Hooks betroffen).

```
screens/ → sheets/ → forms/ → components/ui/ → hooks/ → domain-logik/
```

Nicht jede Datei hat eine `*.test.ts(x)`-Schwesterdatei. Relevante Testbelege
stehen bei den jeweiligen Ownern und Befunden.

## Vertikaler Laufzeitpfad

Der produktive Kernpfad verläuft über diese Owner:

1. `src/app/(app)/shopping-list.tsx` schützt die Route mit `ModuleGate` und
   rendert `ShoppingListScreen`.
2. `screens/shopping-list-screen.tsx` komponiert Haushalt, Filter, Sheets und
   Aktionen. `hooks/use-shopping-list.ts` liest ausschließlich den lokalen
   SQLite-Spiegel über `getDatabase()`; React Query hält den Query-Zustand.
3. `hooks/use-shopping-list-mutations.ts` (mit der Android-Variante) baut
   lokale Mutationen. `lib/db/outbox.ts` schreibt Mirror-Änderung und Outbox
   in einer exklusiven SQLite-Transaktion. `preferences/save-shopping-item.ts`
   erweitert diesen atomaren Save um Kategoriepräferenz und Feedback.
4. `lib/sync/push.ts` projiziert registrierte Outbox-Entitäten anhand von
   `lib/db/entities.ts` nach Supabase. `lib/sync/pull.ts` und
   `lib/sync/realtime.ts` schreiben Remote-Änderungen zurück in den lokalen
   Spiegel; `lib/sync/sync-runner.ts` besitzt Trigger, Query-Invalidierung und
   Account-Sync-Stopper.
5. `supabase/schemas/08_inventory.sql` besitzt die Tabellen, Zeitstempel,
   Tombstones und RLS-Policies für `shopping_list_items`. Die lokale
   Spiegeldefinition liegt in `src/lib/db/schemas/shopping.ts`.

Der Abschluss eines Einkaufs ist ein eigener Grenzfall:
`hooks/use-complete-shopping-run.ts` orchestriert drei getrennte lokale
Schreibpfade: pro Transfer `fridge_items` plus `transactions` über
`enqueueMutations`, pro geprüftem Artikel ein direktes `shopping_history`-Insert
und pro geprüftem Artikel ein separates `shopping_list_items`-Soft-Delete über
`enqueueMutation`. Die Transfer-Bündel und Soft-Deletes werden jeweils separat
geschrieben; eine gemeinsame Transaktion für den gesamten Abschluss ist nicht
belegt. Die Atomaritätskorrektur ist als `fam-ie54` erfasst. Ein
SQLite-Lesefehler wird im
Hauptscreen derzeit noch nicht von einem leeren Zustand unterschieden
(`fam-gng6`). Die serverseitige `shopping_history`-Policy ist trotz des
Append-only-Vertrags noch `FOR ALL`; ihre RLS-Korrektur ist `fam-jlkw`.

## Stage-3-Befunde: Owner, Vertrag und Testbeleg

Dieser Abschnitt dokumentiert den am 2026-09-23 belegten Ist-Zustand. Die
Datei bleibt eine Navigations- und Abgrenzungshilfe. Normative Domäne und
Qualitätsgrenzen kommen weiterhin aus `CONTEXT.md` und `CONSTRAINTS.md`;
Produktionscode und fokussierte Tests belegen das aktuelle Verhalten.

### Vertikaler Kernpfad

| Grenze | Aktueller Owner und Beleg |
|---|---|
| Route und Screen | `src/app/(app)/shopping-list.tsx:1-9` setzt `ModuleGate` um `ShoppingListScreen`. `screens/shopping-list-screen.tsx:161-165` löst den aktiven Haushalt auf und komponiert `useShoppingList`, `useStores` und die Mutations-Hooks. |
| Lokaler Read-Pfad | `hooks/use-shopping-list.ts:82-108` liest `shopping_list_items` ausschließlich über `getDatabase().getAllAsync`, filtert `deleted_at is null` und gruppiert erst danach für die UI. |
| Lokale Mutation | `hooks/use-shopping-list-mutations.ts` und `.android.ts` delegieren Add, Update, Move, Check/Uncheck und Delete an `lib/db/outbox.ts`. `lib/db/shopping-list-merge.ts:264-271` nutzt für Add/Merge denselben Outbox-Owner. |
| Mirror und Outbox | `lib/db/outbox.ts:84-115,165-176` führt Mirror-Write und Outbox-Insert über `withExclusiveTransactionAsync` aus. `src/lib/db/outbox.integration.test.ts:43-117` belegt Commit, Offline-Sichtbarkeit und Rollback mit echter SQLite. |
| Push, Pull, Realtime | `lib/sync/remote-sync-engine.ts:12-31` führt Push vor Pull aus. `lib/sync/push.ts:341-507` projiziert über `lib/db/entities.ts:143-170` und behandelt RLS-, permanente und transiente Fehler. `lib/sync/pull.ts:114-217` schreibt Seite und Cursor gemeinsam. `lib/sync/realtime.ts:13-19,136-177` verarbeitet `shopping_list_items` und Kategoriepräferenzen, jeweils in einer SQLite-Transaktion; `sync-runner.ts:406-504` bindet Reconnect, Invalidierung und Lifecycle. |
| Supabase und RLS | `supabase/schemas/08_inventory.sql:248-339,1312-1345` definiert `shopping_list_items`, Tombstone und Household-Member-RLS. `supabase/tests/07_inventory.test.sql:124-152` belegt Insert und gemeinsames Abhaken durch Haushaltsmitglieder; ein spezifischer Fremdhaushalt-pgTAP-Nachweis für `shopping_list_items` ist dort nicht enthalten. |

### Vertragsbewertung

- **Atomarität:** Einzelne Shopping-List-Mutationen und der Multi-Move sind
  lokal atomar. Der Shopping Run besitzt dagegen keine Gesamttransaktion:
  `hooks/use-complete-shopping-run.ts:77-133` enqueued pro Transfer ein
  `fridge_items`-/`transactions`-Bündel, `:140-162` schreibt
  `shopping_history` pro geprüftem Artikel direkt, und `:165-201` enqueued pro
  geprüftem Artikel das `shopping_list_items`-Soft-Delete separat. Diese drei
  Schreibpfade sind daher nicht als ein atomarer Abschluss zu lesen.
  `use-complete-shopping-run.test.tsx:58-198` prüft den positiven Pfad und die
  Vorabvalidierung, mockt aber Outbox und DB und belegt keinen Rollback. Das ist
  der bestehende Befund von `fam-ie54`, nicht Teil dieser Dokumentationskorrektur.

- **Reverse Actions:** `use-shopping-list-mutations.ts:214-259` modelliert
  Check und Uncheck über `checked_at: null` beziehungsweise Timestamp. Ein
  eigener Restore-Owner für ein gelöschtes Shopping-List-Item oder ein
  Rückgängigmachen des gesamten Shopping Runs ist im Feature-Hook nicht
  vorhanden. Die generischen Restore-Funktionen in Mirror/Push ersetzen diesen
  fehlenden fachlichen Feature-Owner nicht. Der vorhandene Mutationstest
  `use-shopping-list-mutations.test.tsx:54-99` belegt Check und Delete, nicht
  die vollständige Reverse-Parität.

- **Offline-Parität:** `src/lib/db/schemas/shopping.ts:15-67` und die
  lokale Nachziehmigration `src/lib/db/migrations.ts:634-739` spiegeln die
  Shopping-List-Felder einschließlich Markt, Kategoriequelle, Rezeptnamen und
  Packungsgröße. `lib/db/entities.ts:143-170` hält die Serverprojektion
  synchron. `shopping_history` ist dagegen bewusst lokal: sie steht in
  `migrations.ts:185-214`, fehlt in `entities.ts` und besitzt keinen Outbox-,
  Push-, Pull- oder Realtime-Pfad. Das entspricht `CONTEXT.md` und ist keine
  versehentlich fehlende Sync-Parität.

- **Fehlerbehandlung:** Outbox-Fehler werden in `lib/db/outbox.ts:98-105`
  gemeldet und erneut geworfen. Push unterscheidet transient/permanent und hält
  die lokale Mutation für Retry oder Diagnose in der Outbox. Pull persistiert
  Fehler und rollt Seite plus Cursor gemeinsam zurück; dafür stehen die
  fokussierten Fälle in `src/lib/sync/pull.test.ts:196-240,256-322`. Realtime
  resynct bei fehlerhaften Payloads oder Reconnect und meldet Apply-Fehler.
  Der Screen selbst wertet in `screens/shopping-list-screen.tsx:164,496-497`
  nur `data` und `isLoading` aus. Ein SQLite-Fehler kann dadurch als leere
  Liste erscheinen; dieser reproduzierbare UI-Befund bleibt `fam-gng6`.

- **Shopping-Run-Semantik:** `CONTEXT.md:165-184` verlangt pro Transfer ein
  neues Inventory-Item, Soft-Delete der Quelle und eine fortbestehende,
  append-only History. Der Hook setzt diese Schritte grundsätzlich um, schreibt
  die History aber lokal und nicht serverseitig synchronisiert. Zusätzlich
  erzwingt der Hook keine Eins-zu-eins-Abdeckung von `checkedItems` und
  `transfers`: `:138` sucht den Transfer nur optional, während `:165-201` jedes
  geprüfte Item historisiert und löscht. Der Test
  `use-complete-shopping-run.test.tsx:200-238` lässt `checkedItems` mit leerem
  `transfers` erfolgreich durch. Das belegt eine Vertragslücke, die hier nur
  dokumentiert wird. Die Server-Append-only-Abweichung bleibt separat in
  `fam-jlkw`; `supabase/tests/07_inventory.test.sql:166-182` belegt bisher nur
  Insert/Select und die Household-Grenze.

Die bestehenden Folgebeads `fam-ymz7.10` (Reverse-Aktionen und
Run-Invarianten) und `fam-ymz7.11` (SectionList-Prüfung gegen den
FlashList-Vertrag) behandeln diese Befunde separat; diese Datei nimmt ihre
Umsetzung nicht vorweg.

## `screens/` (eigene Route/Vollbild)

| Datei | Zweck |
|---|---|
| `shopping-list-screen.tsx` | Hauptscreen. "Alle Listen"-Übersicht (Markt-Karten) + marktgefilterte Checkliste, steuert alle Modals/Sheets und die Mehrfachauswahl dieses Features. |
| `shopping-mode-screen.tsx` | Vollbild-Einkaufsmodus für den Laden — nur Abhaken, aufklappbare farbcodierte Kategorien, kein Bearbeiten. |
| `stores-screen.tsx` | Märkte verwalten (anlegen, umbenennen, Farbe, löschen) — eigene Route außerhalb der Einkaufsliste selbst. |

## `sheets/` & `modals/` (Overlays, von `shopping-list-screen.tsx` aus geöffnet)

| Datei | Zweck |
|---|---|
| `sheets/complete-run-sheet.tsx` | "In Vorrat übernehmen" — Lagerort, MHD, Menge pro Artikel beim Einkaufsabschluss. |
| `sheets/category-order-sheet.tsx` | Drag&Drop-Sortierung der Kategorie-Laufstrecke pro Markt. |
| `modals/add-item-modal.tsx` | Wrapper um `add-item-form.tsx` in der gemeinsamen Modal-Hülle. |
| `modals/edit-item-modal.tsx` | Wrapper um `forms/edit-item-form.tsx` in der gemeinsamen Modal-Hülle. |
| `modals/move-items-modal.tsx` | Zielauswahl für das Verschieben mehrerer Einkaufsartikel in eine andere Markt-Liste. |
| `modals/item-modal-shell.tsx` | Geteiltes Modal-Gerüst (Header, Scroll, Tastatur-Handling) für Add/Edit. |

## `forms/` (Formulare & Eingabe-Bausteine)

| Datei | Zweck |
|---|---|
| `add-item-form.tsx` | Artikel hinzufügen — Name, Menge, Markt, Barcode-Scan, Produktsuche. |
| `edit-item-form.tsx` | Bestehenden Artikel bearbeiten (gleiche Feldbasis wie Add). |
| `store-picker-field.tsx` | Markt-Auswahl-Chips + Inline-"+ Neuer Markt", geteilt zwischen Add/Edit. |
| `shopping-product-suggestions.tsx` | Aufklappbare Vorschlagsliste (zuletzt/häufig gekauft) beim Hinzufügen. |

## `components/ui/` (reines Rendering)

| Datei | Zweck |
|---|---|
| `shopping-item-row.tsx` | Eine Artikelzeile in der Marktliste — Checkbox, Produkt/Menge/Preis als drei Spalten, Bearbeiten-Icon. |
| `store-summary-card.tsx` | Markt-Karte in der "Alle Listen"-Übersicht (Fortschritt, Preis). |
| `total-estimate-card.tsx` | Gesamtsumme-Kachel unter den Markt-Karten. |
| `store-picker-menu.tsx` | Glas-Pillenbutton im Header, filtert zwischen Märkten. |
| `dashboard-card.tsx` | Widget für den App-Dashboard-Hub, registriert sich über `@/features/dashboard/registry`. |

## `hooks/` (React Query + SQLite)

| Datei | Zweck |
|---|---|
| `use-shopping-list.ts` | Liest Artikel aus SQLite, gruppiert nach Kategorie/Laufstrecke. |
| `use-shopping-list-mutations.ts` | Hinzufügen/Abhaken/Löschen/Verschieben von Artikeln (Outbox-Sync). |
| `use-complete-shopping-run.ts` | Orchestriert getrennte Schreibpfade: `fridge_items` + `transactions` pro Transfer, `shopping_history` direkt und `shopping_list_items` als separates Soft-Delete; keine gemeinsame Transaktion für den gesamten Abschluss. |
| `use-stores.ts` | Märkte lesen/anlegen/ändern/löschen, inkl. `category_order`-Persistenz. |
| `use-shopping-product-suggestions.ts` | Zuletzt/häufig gekaufte Produkte für die Vorschlagsliste. |

## `domain-logik/` (Domänen-Logik & Konfiguration, keine React-Komponenten)

| Datei | Zweck |
|---|---|
| `shopping-categories.ts` | Die 12 Kategorien: Sortierrang (Laufstrecke), Farbe, Lagerort-Default. Automatische Kategorisierung läuft über `classification/` (`classifyCategory`/`explainCategory`), nicht hier. |
| `store-presets.ts` | Namens-Presets (REWE, Aldi, …) + Farbpalette für neue Märkte. |
