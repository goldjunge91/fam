# Inventory-Sync V3: Owner- und Dateimatrix

Status: verbindliche Implementierungsreferenz für den unabhängigen `fam-9vt`-
Arbeitsbaum. Diese Datei beantwortet vor dem Edit drei Fragen: Welche Datei
entscheidet fachlich, welche Exporte sind erlaubt und welchem Slice gehört die
Datei. Verhalten steht in `contract.md`, Qualitätsgrenzen in `CONSTRAINTS.md`
und die Reihenfolge in `execution-plan.md`.

## Verbindliche Regeln

- Eine fachliche Entscheidung hat genau einen Produktions-Owner.
- Pro Inkrement werden höchstens vier Produktionsdateien bearbeitet. Tests,
  Harnesses und generierte Artefakte werden separat genannt.
- KISS / DRY / YAGNI gilt für jede neue Datei, jeden Helper und jede
  Abstraktion. Vor einer neuen Produktionsdatei muss im Beads-Ticket stehen,
  warum ein bestehender Owner nicht reicht, warum keine Entscheidung dupliziert
  wird und warum die Datei für den aktuellen Slice notwendig ist.
- Es gibt keine Datei pro Operation. Operationsnamen werden als Typen und
  Funktionen im benannten Owner abgebildet.
- Produktionsdateien dürfen keine Testdaten, Zufallsquellen oder Test-Builder
  importieren.
- Neue Dateien werden erst angelegt, wenn sie hier mit Verantwortung,
  Exportgrenze und Slice registriert sind.

## Mengenbasis vor dem ersten Code-Inkrement

Die Zahl `3_000` bedeutet bei einer Tausendstel-Skalierung `3.000` in der
jeweiligen Basis-Einheit. Sie bedeutet nicht automatisch `300 g`.

- Bei `unit = 'g'` ist `300 g` als `300.000 g` gleich `300_000`.
- Bei `unit = 'kg'` ist `300 g` als `0.300 kg` gleich `300`.
- `300 g = 3_000` wäre nur dann korrekt, wenn die fachliche Basis-Einheit
  `10 g` wäre; diese Einheit ist nicht vorgesehen.

Vor `fam-9vt.9` müssen Contract, Konversionsfunktion und Test-Fixtures dieselbe
Mengenbasis verwenden. Jede gemeinsame Fixture nennt deshalb die physische
Menge und ihre `unit`; ein nackter Wert wie `3_000` ist ohne Einheit kein
zulässiger fachlicher Testfall.

## Produktions-Owner

| Datei | Status | Einzige Verantwortung | Erlaubte öffentliche Grenze | Slice / Beads |
| --- | --- | --- | --- | --- |
| `src/lib/inventory-quantity.ts` | vorhanden | Integer-Tausendstel, Grenzprüfung und Konversion an der benannten Mengen-/UI-Grenze | `INVENTORY_QUANTITY_SCALE`, `MAX_INVENTORY_QUANTITY_UNITS`, `isPositiveIntegerThousandths`, `isNonNegativeIntegerThousandths`, `toInventoryQuantityUnits`, `fromInventoryQuantityUnits`, `sumInventoryQuantities`, `subtractInventoryQuantities` | Integer-Grenze / `fam-9vt.9` |
| `src/lib/db/schemas/inventory.ts` | fehlt, neu | Lokale Drizzle-Tabellen und Inventory-Spalten für Lose, Orte und Ledger | `fridgeItems`, `storageLocations`, `transactions` | Integer-Grenze / `fam-9vt.9` |
| `src/lib/db/schemas/system.ts` | vorhanden | Gemeinsame Outbox-, Sync-State- und App-Meta-Persistenz | bestehende `outbox`, `syncState`, `appMeta`; keine Inventory-Fachlogik | Integer-Grenze / `fam-9vt.9` |
| `supabase/schemas/08_inventory.sql` | fehlt, neu | Deklaratives Server-Schema, Inventory-RPCs, Receipts, Snapshots und RLS-Basis | Tabellen, Funktionen, Constraints und Policies dieser Datei; Migrationen werden generiert | Integer-/Server-Grenze / `fam-9vt.9`, `fam-9vt.11` |
| `supabase/schemas/20_privileges.sql` | vorhanden | Ausführungsrechte für die autoritativen Inventory-RPCs | bestehende Privilegdefinitionen, keine fachliche Clientlogik | Server-Receipt / `fam-9vt.11` |
| `src/features/inventory/inventory-lifecycle.ts` | fehlt, neu | Reine Operationstypen, Eingangsvalidierung, Footprint und fachliche Planung | `InventoryOperationV1`, `InventoryOperationFootprint`, `MergeSnapshotV1`, `validateInventoryOperation`, `assertValidInventoryOperation`, `computeInventoryOperationFootprint`, `planInventoryOperation` | Owner-/Operationsmodell / `fam-9vt.1`; lokale Slices / `fam-9vt.2`, `.10`, `.3` |
| `src/lib/sync/inventory-quantity.ts` | fehlt, neu | Lokaler exklusiver Commit von Bestand, Ledger und Outbox nach einem Lifecycle-Plan | ein kanonischer `commitInventoryOperation`-Einstieg plus Ergebnis-/Fehlertypen; keine zweite Payload-Validierung | Lokale Operationen / `fam-9vt.2`, `.10`, `.3` |
| `src/lib/db/outbox.ts` | vorhanden | Generisches Speichern, Laden, Retry- und Outcome-Lifecycle der Outbox | bestehende Outbox-API; keine fachliche Inventory-Entscheidung | Lokale Operationen / `fam-9vt.2`; Konflikte / `fam-9vt.11` |
| `src/features/inventory/use-inventory-mutations.ts` | vorhanden, Reset-Datei | React-Query-Mutationsadapter, Invalidierung und UI-Absicht an den lokalen Commit weiterreichen | bestehende Hook-Grenze wie `useAddFridgeItemMutation`, `useRestoreFridgeItemMutation`, `useUpdateInventoryItemQuantityMutation`, `useUpdateFridgeItemMutation`; keine eigene Mengen-/Undo-Regel | Lokale Operationen / `fam-9vt.2`, `.10`, `.3` |
| `src/lib/sync/push.ts` | vorhanden | Generischer Outbox-Transport, Retry, RPC-Aufruf und Ack-/Fehlerklassifikation | bestehende Push-API erweitern; Inventory-Receipt nur weiterleiten, nicht fachlich neu berechnen | Server-Receipt / `fam-9vt.11`; Unknown / `fam-9vt.11` |
| `src/lib/sync/mirror-write.ts` | vorhanden | Generische atomare Projektion bestätigter lokaler oder entfernter Zeilen | `applyLocalMirrorWrite`, `applyRemoteRow`, `upsertMirrorRow`, `deleteMirrorRow`; keine Inventory-Operationstypen | Server-Receipt / `fam-9vt.11`; Reconciliation / `fam-9vt.11` |
| `src/lib/sync/resolve-inventory-conflict.ts` | fehlt, neu | Inventory-spezifische Konfliktentscheidung und Reconfirm-/Discard-Orchestrierung | `resolveInventoryConflict`, `reconfirmInventoryConflict`, `discardInventoryConflict` sowie typisierte Ergebnis-/Fehlertypen | Unknown-/Konflikt-Reconciliation / `fam-9vt.11` |
| `src/lib/sync/pull.ts` | vorhanden | Generischer Pull von Serverbasis und Cursor-Fortschreibung | bestehende Pull-Grenze; Inventory-Projektion an `mirror-write` delegieren | Read-/Reconciliation / `fam-9vt.11` |
| `src/lib/sync/realtime.ts` | vorhanden | Generisches Realtime-Abonnement und Weitergabe von Row-Events | bestehende `subscribeHouseholdRealtime`-Grenze; keine Inventory-Facharithmetik | Read-/Reconciliation / `fam-9vt.11` |
| `src/features/inventory/use-inventory-items.ts` | vorhanden, Reset-Datei | Inventory-Read-Model und genau eine Persistenz-/View-Konversion | `LocalInventoryItem`, `mapFridgeItemRow`, `useInventoryItems`; keine Mutation oder Mengenberechnung | Read-Verbraucher / `fam-9vt.11` |
| `src/features/inventory/use-inventory-transactions.ts` | fehlt, neu | History-Read, Gruppierung und Anzeige aus kanonischen Transaktionen | `useInventoryTransactions` plus reine Anzeige-/Gruppierungshelper; keine eigene Undo-Entscheidung | Lifecycle-Read / `fam-9vt.10`, `.3` |
| `src/features/inventory/use-inventory-conflicts.ts` | fehlt, neu | Lokale Darstellung des Konfliktstatus | `useInventoryConflicts`; keine Auflösungsentscheidung außerhalb des Konflikt-Owners | Konflikt-Read / `fam-9vt.11` |
| `src/features/shopping-list/hooks/use-complete-shopping-run.ts` | vorhanden | Einkaufsabschluss an den kanonischen Inventory-Commit anbinden | bestehender `useCompleteShoppingRun`; keine parallele Ledger-/Inventory-Erzeugung | Read-/Write-Verbraucher / `fam-9vt.2`, `.11` |

## Test- und Fixture-Owner

Diese Dateien sind Test-Infrastruktur. Sie sind keine Produktions-Owner und
werden nicht in die Grenze von vier Produktionsdateien eingerechnet.

| Datei | Verantwortung | Erlaubte Grenze | Nachweis |
| --- | --- | --- | --- |
| `test/shared-test-data.ts` | Fachliche, benannte Inventory-Basisszenarien und gemeinsame Mengenwerte | unveränderliche Basen oder Factory-Funktionen; keine globale Mutation | fokussierte Lifecycle-/Mutationstests |
| `test/test-data.ts` | Generische Testdaten-Builder und deterministische Grenzwert-Helfer | `createTestData`, explizit injizierbare Zufallsquelle oder Seed; keine fachliche Inventory-Regel | `test/test-data.test.ts` |
| `test/test-data.test.ts` | Vertrag der generischen Testdaten-Helper | Merge, Grenzwerte, invalides Input und Reproduzierbarkeit | `bun run test test/test-data.test.ts --runInBand --watchman=false` |
| `test/conventions/inventory-operation-ownership.test.ts` | Architektur-Gate für Owner und verbotene Direktimporte | genau ein Register-/Ownerpfad je Operation | fokussierter Convention-Test |
| `test/adversarial-inventory-lifecycle.test.ts` | adversariale Invarianten des reinen Lifecycle-Owners | kein Mock des getesteten Owners; keine abgeschwächten Assertions | fokussierter Lifecycle-Lauf |
| `src/features/inventory/inventory-lifecycle.test.ts` | Unit-Nachweise für Operationstypen, Validierung, Footprint und Planung | nur erzeugen, wenn die bestehende Testabdeckung diese Verantwortung nicht bereits vollständig prüft | `bun run test <datei> --runInBand --watchman=false` |
| `supabase/tests/27_inventory_quantity_atomic.test.sql` | Mengen-Receipt, Idempotenz und Atomarität | pgTAP gegen deklaratives Schema | fokussierter DB-Gate-Lauf |
| `supabase/tests/28_inventory_quantity_correction_atomic.test.sql` | Korrektur-CAS und Atomarität | pgTAP | fokussierter DB-Gate-Lauf |
| `supabase/tests/29_inventory_quantity_reversal_atomic.test.sql` | append-only Reversal und Fehlerrollback | pgTAP | fokussierter DB-Gate-Lauf |
| `supabase/tests/30_inventory_split_atomic.test.sql` | Öffnungsrest, Provenienz und Split-Atomarität | pgTAP | fokussierter DB-Gate-Lauf |
| `supabase/tests/31_inventory_merge_undo_atomic.test.sql` | Merge-Undo und Snapshot-Wiederherstellung | pgTAP | fokussierter DB-Gate-Lauf |

## Datenregeln für wiederholbare Tests

- Ein Test erhält immer eine frische Dateninstanz. Gemeinsame Basen werden
  nicht mutiert.
- Variable Fälle werden über explizite Overrides oder eine domänenspezifische
  Factory erzeugt, nicht über zufällige globale Zustände.
- `Math.random()` darf nicht der implizite Default für einen Test sein. Wenn
  Zufall fachlich für einen Helper geprüft wird, wird der Zufallsgeber oder ein
  reproduzierbarer Seed injiziert.
- `shared-test-data.ts` darf nur Werte teilen, die mindestens zwei fokussierte
  Tests tatsächlich gemeinsam brauchen. Sonst bleibt der Wert lokal im Test.
- Ein Fixture-Helper darf keine Produktionsvalidierung, Mengenarithmetik oder
  Operationserzeugung duplizieren. Er stellt Daten bereit; der Produktions-Owner
  entscheidet das Verhalten.

## Implementierungsreihenfolge

1. `fam-9vt.5` und `fam-9vt.1`: diese Matrix, Operationsregister,
   Mengenbasis und Importgrenzen freigeben.
2. `fam-9vt.9`: Integer-Grenze und deklarative lokale/serverseitige Schemata.
3. `fam-9vt.2`: Insert, Korrektur und Move durch Lifecycle, Commit, Outbox und
   Mutation-Hooks vertikal schließen.
4. `fam-9vt.10`: Open, Consume, Waste und Provenienz vertikal schließen.
5. `fam-9vt.3`: Undo und Reseal mit derselben Owner-Richtung schließen.
6. `fam-9vt.11`: Receipt, Unknown, Konflikte, Pull/Realtime und Reads
   nachweisen.
7. `fam-9vt.4`: Nur danach kleine Implementierungs-Child-Tickets aus den
   tatsächlich offenen Owner-Lücken ableiten.

Eine neue Produktionsdatei wird nur in dieser Matrix ergänzt, nachdem das
Beads-Ticket den KISS-/DRY-/YAGNI-Check dokumentiert hat. Eine neue Testdatei
ist ebenfalls zu begründen, wenn ein bestehender Nachweis erweitert werden
kann. Der Dateiname allein ist kein Grund für einen neuen Owner.
