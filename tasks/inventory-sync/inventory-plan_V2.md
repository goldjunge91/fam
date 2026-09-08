# Plan: v1-Cutover-Restumfang abschließen (fam-lfa, fam-8sf, fam-mt6)

## Context

Der fam-lem.21-Vertragsaudit hat drei konkrete Contract-Verstöße gefunden, die
die finale v1-Aktivierungsfreigabe blockieren: `transactions.type='open'`
wird weiterhin geschrieben (Abschnitt 2.8/5.1), die `undone`-Spalte existiert
weiterhin (Abschnitt 2.7), und `[Split] origin=<id>`-Freitext-Notes werden
weiterhin als Provenienz-Fallback geparst (Abschnitt 9). Für jeden Verstoß
wurde ein eigenes Beads-Ticket angelegt (fam-lfa, fam-mt6, fam-8sf).

Die anschließende Review dieses Audits (code-review-and-quality) hat einen
Architekturfehler in der Ticketaufteilung gefunden: **fam-lfa und fam-8sf
sind nicht unabhängig.** Die Vertiefung in diesem Plan bestätigt das mit
konkreter Evidenz — beide Tickets ändern denselben Code (Open-/Split-Undo-
Pfad in `use-inventory-mutations.ts` und `inventory-lifecycle.ts`) und lösen
sich gegenseitig: Ohne die 'open'-Ledgerzeile zu entfernen, bleibt der
Freitext-Fallback für Split-Provenienz nötig (er wird beim Undo der
`open`-Zeile referenziert); ohne die typisierte Provenienz zu erzwingen,
kann die 'open'-Ledgerzeile nicht gefahrlos entfernt werden (der Merge-Undo-
Pfad braucht dann eine andere Quelle, um den ursprünglichen Verbrauch zu
finden). Dieser Plan führt beide als eine zusammenhängende Slice A. fam-mt6
(undone-Spalte) ist strukturell unabhängig und bildet Slice B — mit einer
wichtigen Korrektur gegenüber der ursprünglichen Ticketbeschreibung: `undone`
ist **kein toter Code**, sondern eine aktiv gelesene, aber redundante
Guard-Variable (siehe Evidenz unten).

## Bestätigte Codebasis-Evidenz

- `validateInventoryOperation`/`ALL_CANONICAL_OPERATION_TYPES`
  (`src/features/inventory/inventory-lifecycle.ts`) haben null Aufrufer
  außerhalb der eigenen Testdatei — reiner Typkörper, kein Laufzeitpfad.
- `reseal_inventory` existiert nur als Lifecycle-Plantyp (Zeilen 314, 450,
  610, 1151-1157, 1322), es gibt **keine** Runtime-Mutation dafür in
  `use-inventory-mutations.ts`. Contract Abschnitt 5.1 verlangt genau diese
  Operation als "bewusste Gegenaktion" zum reinen Öffnen — sie muss gebaut
  werden, bevor der Open-Undo-Pfad umgestellt werden kann.
- `transaction.undone` wird an drei Stellen gelesen, aber **immer** zusammen
  mit einer äquivalenten Prüfung: `use-inventory-transactions.ts:49-54`
  (`isInventoryTransactionUndoable`) prüft `undone || notes.includes('[Undone]')
  || reversal_of != null || has_reversal`. `has_reversal` selbst ist bereits
  eine SQL-Subquery (`use-inventory-transactions.ts:116`), die exakt dasselbe
  über `reversal_of`-Existenz beantwortet. `use-inventory-mutations.ts:915,1353`
  und `inventory-lifecycle.ts:252` (`planUndoOpenTransaction`) prüfen `undone`
  redundant neben `notes.includes('[Undone]')`. Die Spalte ist also entfernbar,
  aber nicht ersatzlos — jede Stelle braucht eine Ersatzabfrage auf
  `reversal_of`-Existenz (Muster existiert bereits: `select id from
  transactions where reversal_of = ? limit 1`, siehe
  `enqueueQuantityReversal`/`resolve-inventory-conflict.ts`).
- Fünf bereits gelöschte Dateien (`inventory-quantity-correction.ts` u. a.)
  bestätigen: der lokale Schreibpfad ist vollständig in
  `sync/inventory-quantity.ts` konsolidiert — neue Operationen entstehen dort,
  nicht in neuen Dateien (CONSTRAINTS.md, Owner-Prinzip).

## Slice A: Open-Ledger-Legacyform entfernen + typisierte Split-Provenienz
(löst fam-lfa und fam-8sf gemeinsam)

**A1 — `reseal_inventory`-Laufzeitmutation bauen**
Neue Mutation (`useResealInventoryItemMutation` in `use-inventory-mutations.ts`,
Befehl in `sync/inventory-quantity.ts` nach bestehendem Muster
`applyLocalMirrorWrite(..., 'update', ...)`, kein Ledger). Setzt `opened_at =
null`, stellt versiegelte Haltbarkeitsfelder wieder her (Lifecycle-Plan dafür
existiert bereits: `inventory-lifecycle.ts` case `'reseal_inventory'`, Zeile
1151). Das ist die in Abschnitt 5.1 verlangte "bewusste Gegenaktion" zum
reinen Öffnen und Voraussetzung für A3.
- Dateien: `use-inventory-mutations.ts`, `sync/inventory-quantity.ts`,
  je ein Test in `use-inventory-mutations.test.tsx` +
  `use-inventory-mutations.integration.test.tsx`.
- Akzeptanz: Reseal setzt `opened_at=null` + Haltbarkeit zurück, erzeugt
  keine Ledgerzeile, keine Mengenänderung; idempotent über `operation_id`.
- Verify: `bun run test -- src/features/inventory/use-inventory-mutations.test.tsx src/features/inventory/use-inventory-mutations.integration.test.tsx --runInBand --watchman=false`

**A2 — `open_inventory` ledgerfrei machen, Freitext-Split-Fallback entfernen**
`useOpenInventoryItemMutation` schreibt keine `type:'open'`-Zeile mehr
(weder in-place noch Split-Zweig). `getSplitOriginItemId`
(`inventory-lifecycle.ts`) verliert den `notes`-Fallback und
`SPLIT_NOTE_PREFIX`; Split-Identität kommt ausschließlich aus
`origin_item_id` (bereits vorhanden, wird bereits bevorzugt gelesen).
- Dateien: `use-inventory-mutations.ts`, `inventory-lifecycle.ts`,
  `inventory-lifecycle.test.ts`, `use-inventory-mutations.integration.test.tsx`.
- Akzeptanz: Öffnen (einzeln oder Split) erzeugt null Ledgerzeilen; Split-
  Identität wird ausschließlich über `origin_item_id` aufgelöst; kein
  `notes`-Parsing für Provenienz mehr im Produktionscode.
- Verify: `bun run test -- src/features/inventory/inventory-lifecycle.test.ts src/features/inventory/use-inventory-mutations.integration.test.tsx --runInBand --watchman=false`
- **Checkpoint:** `grep -rn "type: 'open'\|SPLIT_NOTE_PREFIX" src/features/inventory/*.ts src/lib/sync/*.ts` (außer Tests/Kommentare) muss leer sein, bevor A3 beginnt.

**A3 — Undo-Pfad umstellen: Merge-Undo referenziert die Verbrauchsbuchung, nicht eine Phantom-Open-Zeile**
`merge_undo_open` (Undo des ersten Teilverbrauchs mit `opens_remainder`)
findet das Ursprungslos jetzt über `origin_item_id` auf dem geöffneten Los,
nicht mehr über eine zu reversierende `type='open'`-Ledgerzeile. Undo eines
reinen Öffnens (kein Verbrauch) ist ab jetzt kein Ledger-Undo mehr, sondern
ein Aufruf der A1-Reseal-Mutation aus der UI. `useUndoOpenTransactionMutation`
wird entsprechend umgebaut (vermutlich umbenannt/aufgeteilt, da es zwei
unterschiedliche Fachfälle bedient); `use-inventory-transactions.ts`
(Verlaufsanzeige/Undo-Label) verliert den `type==='open'`-Fall.
- Dateien: `use-inventory-mutations.ts`, `use-inventory-transactions.ts`,
  `inventory-lifecycle.ts` (Signatur `planUndoOpenTransaction`), zugehörige
  Tests in allen dreien.
- Akzeptanz: Merge-Undo-Fallback-Tests (bereits vorhanden, z. B. "führt
  Split-Merge über den generischen Undo-Hook aus") bleiben grün mit neuer
  Provenienzquelle; UI bietet für ein reines Öffnen "Wieder versiegeln"
  (Reseal) statt "Rückgängig".
- Verify: `bun run test -- src/features/inventory/use-inventory-mutations.integration.test.tsx src/features/inventory/use-inventory-mutations.test.tsx src/features/inventory/inventory-lifecycle.test.ts --runInBand --watchman=false`

**A4 — Serverseite nachziehen**
`supabase/schemas/08_inventory.sql`: RPCs, die bisher `type='open'` schreiben
oder darauf prüfen, auf denselben ledgerfreien Open-Fluss umstellen;
`bun run db:diff` erzeugt die Migration.
- Dateien: `supabase/schemas/08_inventory.sql`, generierte Migration,
  betroffene `supabase/tests/*.sql`.
- Verify: `bun run db:diff` (muss danach leer sein), gezielter pgTAP-Lauf
  gemäß CONSTRAINTS.md (aktuell laut CONSTRAINTS.md als nicht-lokal-startbar
  markiert — DB-Ausführung bleibt ggf. Blocker, dann explizit so vermerken,
  keine ungeprüfte Migration als "fertig" ausgeben).

## Slice B: `transactions.undone` entfernen (fam-mt6, unabhängig von A)

**B1 — Guard-Checks auf Reversal-Existenz statt `undone`-Spalte umstellen**
Jede der drei Leseslellen (`use-inventory-transactions.ts` — `has_reversal`
deckt das schon ab, nur `undone` aus der Bedingung entfernen;
`use-inventory-mutations.ts:915,1353`; `inventory-lifecycle.ts:252`) auf eine
Reversal-Existenzprüfung umstellen. Für die beiden Mutationsstellen: dieselbe
`select id from transactions where reversal_of = ?`-Abfrage nutzen, die
`enqueueQuantityReversal` bereits hat, statt der Spalte.
- Dateien: `use-inventory-transactions.ts`, `use-inventory-mutations.ts`,
  `inventory-lifecycle.ts`, deren Tests.
- Akzeptanz: Verhalten unverändert (ein Undo mit existierender Gegenbuchung
  gilt weiterhin als "bereits rückgängig"); null verbleibende Lesezugriffe
  auf `.undone`.
- Verify: `bun run test -- <die vier Testdateien oben> --runInBand --watchman=false`
- **Checkpoint:** `grep -rn "\.undone\b" src/` (außer Schreibzugriffe/Kommentare) muss leer sein, bevor B2 beginnt.

**B2 — Spalte deklarativ entfernen**
`src/lib/db/schemas/inventory.ts` (lokal) und
`supabase/schemas/08_inventory.sql` (Server): `undone`-Spalte löschen, alle
`undone: false`/`undone,`-Schreibzugriffe in `sync/inventory-quantity.ts`
und `use-inventory-mutations.ts` entfernen.
- Verify: `bun run db:diff` leer, `bun run typecheck`, fokussiertes Biome,
  betroffene Tests aus B1 erneut grün.

## Reihenfolge & Nebenbedingungen

A und B sind unabhängig voneinander startbar; innerhalb A ist die Reihenfolge
A1→A2→A3→A4 zwingend (jede baut auf der vorigen auf). Jeder Schritt bleibt
innerhalb der CONSTRAINTS.md-Grenze von ≤5 handbearbeiteten Dateien. Keine
neue Produktionsdatei — alle Änderungen in bestehenden Owner-Dateien
(`sync/inventory-quantity.ts`, `inventory-lifecycle.ts`,
`use-inventory-mutations.ts`) gemäß Contract Abschnitt 8. TDD pro Schritt:
Testerwartung zuerst ändern (RED), dann Produktionscode (GREEN), wie in den
bisherigen fam-lem.30.7.x-Inkrementen dieser Session gehandhabt.

## Beads-Abbildung nach Freigabe

Dieses Projekt trackt Aufgaben ausschließlich über Beads (CLAUDE.md), nicht
über `tasks/todo.md`. Nach Freigabe dieses Plans lege ich A1-A4 als Kinder
von `fam-lfa` an, B1-B2 als Kinder von `fam-mt6`, und schließe `fam-8sf` als
"gelöst durch fam-lfa/A2" (kein eigenständiges Ticket mehr, da beide
Verstöße durch dieselbe Änderung behoben werden). `fam-lem.21` bleibt bis
zum Abschluss aller Kinder offen.

## Verifikation gesamt

`bun run typecheck`, `bun run check`, `git diff --check` nach jedem
TS-Inkrement; `bun run db:diff` leer nach jeder Schemaänderung; nur die oben
genannten fokussierten Testdateien, keine volle Suite, kein `bun test`, kein
lokaler Supabase-Start ohne erneute explizite Freigabe (bestehende Freigabe
in Erinnerung `fam-inventory-local-supabase-authorized` galt für eine
bereits laufende Instanz in einem früheren Engagement — vor A4/B2 erneut
gegenprüfen, ob eine Instanz läuft, nicht automatisch annehmen).
