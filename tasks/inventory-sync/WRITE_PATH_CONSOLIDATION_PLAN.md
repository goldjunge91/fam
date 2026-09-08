# Plan: Schreibpfad-Konsolidierung + Integer-Cutover (fam-lem.27 + fam-lem.30 Rest)

Kurzplan vor Code, wie mit Marco am 2026-09-08 vereinbart. Ersetzt den
vorigen Ansatz "5 Dateien einzeln patchen, Zusammenlegung spaeter" — die
5-6-fache Duplizierung der Payload-Validatoren macht das Einzel-Patchen
selbst zur Fehlerquelle. Ziel: einmal sauber, integer-nativ, an einem Ort.

Referenzen: `tasks/inventory-sync/contract.md` Abschnitt 8 (Owner-Register,
verlangt bereits diese Konsolidierung), `CONSTRAINTS.md`, dieses Dokument
ergaenzt `execution-plan.md`, ersetzt es nicht.

## Zielarchitektur

Ein Owner: `src/lib/sync/inventory-quantity.ts`. Diese Dateien werden
vollstaendig aufgeloest und geloescht (Funktionen wandern rein, keine
Re-Export-Bruecken):

- `inventory-quantity-correction.ts` (parseInventoryQuantityCorrectionPayload)
- `inventory-quantity-reversal.ts` (parseInventoryQuantityReversalPayload)
- `inventory-open-split.ts` (parseInventorySplitPayload)
- `inventory-open-merge.ts` (parseInventoryMergeUndoPayload)
- `inventory-move.ts` (parseInventoryMovePayload, Typen InventoryMoveTransaction/Payload)

Die sechs `create*Mutation`-Funktionen existieren schon in
`sync/inventory-quantity.ts` (adjust/correct/reverse/split/merge_undo/move) —
die bleiben, ihre `parse*`-Gegenstuecke ziehen zu ihnen.

**Ein gemeinsamer, interner Satz Payload-Helfer** ersetzt die sechs
fast identischen Kopien von `requiredString`/`nullableString`/
`optionalNullableString`/`requiredQuantity`:

```ts
function requiredString(payload: Record<string, unknown>, key: string, context: string): string
function nullableString(payload: Record<string, unknown>, key: string, context: string): string | null
function optionalNullableString(payload: Record<string, unknown>, key: string, context: string): string | null | undefined
function requiredQuantityUnits(payload: Record<string, unknown>, key: string, context: string): number
function requiredNonNegativeQuantityUnits(payload: Record<string, unknown>, key: string, context: string): number
```

`context` ersetzt die aktuell im Funktionsnamen "eingebrannte" Fehlermeldung
("Split-Payload", "Move-Payload", ...) als expliziten Parameter — eine
Funktion statt sechs mit identischem Koerper und unterschiedlichem String.

## Integer-natives Prinzip (loest fam-lem.30 Rest-Scope)

- `requiredQuantityUnits`/`requiredNonNegativeQuantityUnits` validieren mit
  `isPositiveIntegerThousandths`/`isNonNegativeIntegerThousandths` aus
  `src/lib/inventory-quantity.ts` (Owner fuer Grenzpruefung, contract.md
  Abschnitt 3). Keine Dezimal-Rundtrip-Validierung mehr (`assertInventoryQuantityPrecision`
  entfaellt an allen sechs Stellen — falls dadurch ganz ungenutzt: loeschen).
- Alle `create*Mutation`-Funktionen schreiben den erhaltenen Wert direkt
  (keine `fromInventoryQuantityUnits`-Rueckkonvertierung vor dem Schreiben).
- Konvertierung Dezimal->Einheiten passiert ausschliesslich in
  `use-inventory-mutations.ts`, an der Stelle, wo ein UI-Wert (Formular-Eingabe,
  `LifecycleItem.quantity` aus `inventory-lifecycle.ts` — bleibt bewusst
  dezimal, siehe unten) in einen Payload fuer einen `create*Mutation`-Aufruf
  eingeht. `sync/inventory-quantity.ts` bekommt also **immer** bereits-Einheiten
  als Eingabe uebergeben; validiert nur noch, konvertiert nicht mehr selbst.
- `LifecycleItem`/`planOpenInventoryItem`/`planUndoOpenTransaction`
  (`inventory-lifecycle.ts`) bleiben unveraendert dezimal — das ist nicht Teil
  dieses Cutovers (separater Owner, contract.md Abschnitt 8).
- Rohe SQL-Reads direkt in `use-inventory-mutations.ts`
  (`useUpdateInventoryItemQuantityMutation`, Korrekturpfad in
  `useUpdateFridgeItemMutation`) lesen nach dem Cutover direkt Einheiten aus
  der jetzt integer-typisierten Spalte — der bisherige
  `toInventoryQuantityUnits(existing.quantity)`-Wrapper entfaellt dort
  (Doppel-Skalierung sonst).
- Korrigiert (2026-09-08, nach Nutzer-Nachfrage): Die fridge_items-Join-Query
  ist tatsaechlich **5x** dupliziert (1x `use-inventory-items.ts`, 4x
  `use-inventory-mutations.ts`: `useOpenInventoryItemMutation`,
  `useUndoOpenTransactionMutation` x2, `enqueueQuantityReversal`), keine der
  4 nutzt `mapFridgeItemRow`. Das wird JETZT geloest (Schritt 0, siehe unten),
  nicht mehr als "vorbestehend, ausserhalb des Plans" behandelt.
- `mapFridgeItemRow` (`use-inventory-items.ts`) wechselt zuletzt von Identity
  auf echte Konversion (`fromInventoryQuantityUnits` fuer quantity/package_size).

## Reihenfolge (vertikale Slices, je 1-3 Dateien, mit Tests danach)

0. Fridge-Item-Join-Query (5 Kopien) auf eine parametrisierte Funktion in
   `use-inventory-items.ts` konsolidieren (`readFridgeItemRow` o.ae.), alle
   Aufrufer in `use-inventory-mutations.ts` umstellen, konsequent
   `mapFridgeItemRow` nutzen. Muss ZUERST passieren, sonst wird derselbe Fix
   in Schritt 3/4 nochmal einzeln gemacht (fam-lem.27.12).
1. `correct_quantity`: Parser in `sync/inventory-quantity.ts` zusammenfuehren,
   integer-nativ machen, `inventory-quantity-correction.ts` loeschen,
   `use-inventory-mutations.ts` Korrekturpfad anpassen.
2. `reverse_quantity`: `inventory-quantity-reversal.ts` genauso.
3. `split_open`: `inventory-open-split.ts` genauso, inkl.
   `useOpenInventoryItemMutation`-Fix (Roh-Read-Konversion).
4. `merge_undo_open`: `inventory-open-merge.ts` genauso, inkl.
   `useUndoOpenTransactionMutation`-Fix.
5. `move`: `inventory-move.ts` genauso, inkl. `groupedMoveMutation`/
   `transactionMutation`-Aufrufer in `use-inventory-mutations.ts`.
6. `adjust_quantity`: bereits im Zieldateiort — nur integer-nativ machen
   (kein Dateilöschen), gemeinsame Helfer aus Schritt 1-5 wiederverwenden.
   Danach: pruefen ob `assertInventoryQuantityPrecision` noch einen Aufrufer
   hat; wenn nicht, loeschen.
7. `mirror-write.ts` + `resolve-inventory-conflict.ts`: verbleibende
   `toInventoryQuantityUnits`/`fromInventoryQuantityUnits`-Aufrufe pruefen und
   auf Einheiten-direkt umstellen.
8. `mapFridgeItemRow` aktivieren (Identity -> echte Konversion). Muss zuletzt
   passieren, sonst zeigt die UI waehrend eines Zwischenzustands falsche Werte.
9. Abschluss: `bun run test` gezielt auf alle beruehrten Dateien,
   `bun run typecheck`, `bun run check`, kurzer Diff-Review gegen
   CONSTRAINTS.md I1-I6, `tasks/inventory-sync/CUTOVER_PROGRESS.md` loeschen.

Jeder Schritt: eigener Testlauf (`bun run test -- <betroffene Dateien>`,
NIE gleichzeitig mit Supabase-Tests), danach naechster Schritt. Kein
gleichzeitiger Umbau zweier Schritte.

## Zusaetzlicher Aufrufer: inventory-push.ts

`src/lib/sync/inventory-push.ts` (neu, aus dem "close out fam-lem epic"-Merge)
importiert alle sechs `parse*Payload`-Funktionen direkt aus den fuenf zu
loeschenden Dateien und ruft darueber die tatsaechlichen Supabase-RPCs auf
(`p_expected_quantity`, `p_new_quantity`, `p_delta`, `p_expected_source_quantity`,
`p_open_quantity` etc.) - das ist die reale Wire-Serialisierungsstelle, nicht
das seit langem generische `push.ts`. Jeder der Schritte 1-5 (und Schritt 0)
muss `inventory-push.ts`s Imports mitziehen; ohne das bricht der Server-Push
sofort. In jeder Aufgabenbeschreibung unten explizit erwaehnt.

## Risiken

| Risiko | Auswirkung | Gegenmassnahme |
| --- | --- | --- |
| `push.ts`/`mirror-write.ts` haben eigene Erwartungen an Payload-Form der 5 Operationstypen | Wire-Format bricht | Vor Schritt 1 kurz gegenpruefen, was `fridgeItemIdsReferencedBy` (push.ts) und Reconciliation aus den Payloads lesen |
| Bestehende Unit-/Integrationstests der 5 Dateien pruefen Dezimalwerte | Tests muessen mitgezogen werden | Je Schritt die zugehoerige `*.test.ts` im selben Schritt aktualisieren, nicht separat |
| `useUpdateFridgeItemMutation` mischt Korrektur- und Move-Pfad in einer Transaktion | Teilweise Fixes koennten inkonsistent sein | Schritt 1 und 5 beruehren dieselbe Funktion — beide Male vollstaendig durchtesten, nicht nur den eigenen Teil |

## Tasks

Getrackt in Beads unter fam-lem.27 (Kinder fam-lem.27.1 - .27.6) und
fam-lem.30.7 (Kinder fam-lem.30.7.1 - .30.7.3 fuer Schritt 7-9).
