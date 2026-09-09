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

## Import-/Exportvertrag

Die folgende Matrix ergänzt die Owner-Tabelle um die tatsächliche
Abhängigkeitsrichtung. `Importiert von` meint die erlaubten direkten
Verbraucher. `Importiert` meint die erlaubten direkten Abhängigkeiten des
Owners. `Exporte` sind die öffentliche API; alle nicht genannten Helper
bleiben dateiintern. Namen mit dem Zusatz **Ziel** sind die verbindlichen
Exporte nach dem Reset, nicht die Behauptung, dass die fehlende Datei bereits
existiert.

Ein neuer direkter Import oder ein neuer öffentlicher Export ist ein
Ownership-Gate-Verstoß, wenn er nicht zuerst hier eingetragen wird. Die
Richtung ist absichtlich einseitig: UI importiert Commit-/Read-APIs, aber
Commit- und Sync-Owner importieren niemals UI oder React-Komponenten.

Die Importer in dieser Matrix sind für Inventory-Sync vollständig, sofern die
Datei ein Inventory-Owner ist. Bei generischen Ownern wie `outbox.ts` und
`mirror-write.ts` listet die Matrix nur die Inventory-relevanten Verbraucher;
andere Domänen dürfen diese generischen APIs weiterhin verwenden. Der Reset-
Arbeitsbaum kann vor dem jeweiligen Slice noch fehlende Ziel-APIs importieren;
solche Imports sind Baselinefehler und müssen vor der Slice-Aktivierung
entfernt oder auf den registrierten Owner umgestellt werden.

Für die Reconciliation gibt es genau eine erlaubte Schichtgrenze: Der
generische Owner `mirror-write.ts` darf die reinen Operationstypen,
Footprints und Projektionsergebnisse aus `inventory-lifecycle.ts` lesen und
anwenden. Er darf daraus keine zweite Fachplanung, Mengenregel,
Konfliktentscheidung oder Undo-Regel ableiten. Dafür wird kein neues
Reconciliation-Verzeichnis und keine zusätzliche Adapterdatei eingeführt.

| Datei | Importiert von | Importiert direkt | Öffentliche Exporte / Funktionsnamen | Verboten |
| --- | --- | --- | --- | --- |
| `src/lib/inventory-quantity.ts` | Lifecycle, lokaler Commit, Read-Mapping, fokussierte Tests | keine fachlichen Module; nur Standard-TypeScript | **Ziel:** `MAX_INVENTORY_QUANTITY`, `isPositiveInventoryQuantity`, `isNonNegativeInventoryQuantity`, `normalizeInventoryQuantity`, `sumInventoryQuantities`, `subtractInventoryQuantities` | DB, React, Sync, Zeit, Zufall, künstliche Skalierung oder Einheitenwechsel |
| `src/lib/db/schemas/inventory.ts` | `src/lib/db/schemas/index.ts`, lokale DB-Initialisierung, lokale DB-Tests | Drizzle-SQLite und gemeinsame DB-Spaltendefinitionen | **Ziel:** `fridgeItems`, `storageLocations`, `transactions` | Lifecycle-Regeln, React, Supabase-Client, Outbox-Entscheidungen |
| `src/lib/db/schemas/system.ts` | `src/lib/db/schemas/index.ts`, `src/lib/db/outbox.ts`, lokale DB-Initialisierung | Drizzle-SQLite | `outbox`, `syncState`, `appMeta` | Inventory-Operationen, UI, fachliche Mengenlogik |
| `supabase/schemas/08_inventory.sql` | deklarativer Supabase-Loader, generierte DB-Typen und RPC-Client | keine TypeScript-Imports | Tabellen, Constraints, RPCs, Receipts, Snapshots und RLS dieser Schemaquelle; der vertraglich benannte Read ist `read_inventory_sync_snapshot` | manuelle Migration, Client-Fachlogik, zweites Schema |
| `supabase/schemas/20_privileges.sql` | deklarativer Supabase-Loader | `08_inventory.sql`-Objekte innerhalb der deklarativen Schemaquelle | `GRANT`-/Ausführungsrechte für autoritative RPCs | Tabellenmodell, Client-API, fachliche Duplikate |
| `src/features/inventory/inventory-lifecycle.ts` | lokaler Commit, Mutation-Hooks, Push/Conflict-Reconciliation, `mirror-write.ts`, Transaction-Read, Lifecycle- und Convention-Tests | nur pure Mengen- und ggf. pure Datums-/Expiry-Helper; keine Persistenz | **Ziel:** `InventoryOperationV1`, `InventoryOperationFootprint`, `MergeSnapshotV1`, `CANONICAL_CONTRACT_VERSION`, `ALL_CANONICAL_OPERATION_TYPES`, `validateInventoryOperation`, `assertValidInventoryOperation`, `computeInventoryOperationFootprint`, `planInventoryOperation` | React, UI, SQLite, Supabase, Outbox, Netzwerk, globale IDs, globale Uhr, Test-Fixtures |
| `src/lib/sync/inventory-quantity.ts` | `use-inventory-mutations.ts`, Shopping-Completion, Conflict-Reconfirm, lokale Commit-Tests | Lifecycle-Owner, Mengen-Owner, lokale DB-Tabellen/DB-Client, `outbox.ts`, generische Mirror-Schreibgrenze | **Ziel:** `commitInventoryOperation`, `InventoryCommitResult`, typisierte Commit-/Konfliktfehler | React-Komponenten, Hooks, Netzwerk-Push, eigene zweite Validierung, eigene Ledger-Regeln |
| `src/lib/db/outbox.ts` | lokaler Commit, Sync-Runner, `push.ts`, generische Outbox-Tests | `system.ts`, DB-Entity-/Codec-Helper, Retry-/Zeitgrenze | `parseOutboxEntry`, `onOutboxChanged`, `enqueueMutation`, `enqueueMutations`, `loadDueOutboxEntries`, `deleteOutboxEntries`, `recordOutboxOutcome`, `EnqueueMutationInput`, `EnqueueMutationBuilder`, `OutboxOutcome` | Inventory-Planung, UI, React Query, direkte Server-RPC-Fachlogik |
| `src/features/inventory/use-inventory-mutations.ts` | Inventory-Screens, Shopping-Abschluss, fokussierte Hook-/Integrationstests | React Query, lokaler Commit, bestehende lokale Query-/Invalidierungsgrenzen | `FridgeItem`, `useAddFridgeItemMutation`, `useRestoreFridgeItemMutation`, `useUpdateInventoryItemQuantityMutation`, `useUpdateFridgeItemMutation` | direkte RPC-/Push-Aufrufe, Test-Fixtures, eigene Mengen-/Undo-/Ledger-Regeln |
| `src/lib/sync/push.ts` | `src/lib/sync/sync-runner.ts`, Push-Integrationstests, generische Sync-Tests | `outbox.ts`, generische Mirror-Schreibgrenze, Backoff-/Coalesce-Helper, Supabase-Client, ggf. Lifecycle-Receipt-Typen | `PushOutcome`, `PushResult`, `pushOutbox` | React, UI, Inventory-Planung, Receipt-Neuberechnung, direkter Zugriff auf UI-Hooks |
| `src/lib/sync/mirror-write.ts` | `push.ts`, `pull.ts`, `realtime.ts`, generischer Sync-Runner, Inventory-Reconciliation, Mirror-Tests | lokale DB-Entities, Cursor-/Row-Codec, generische Sync-Typen sowie reine Operationstypen/Footprints aus `inventory-lifecycle.ts` | `UpsertMirrorRowOptions`, `RemoteRow`, `LocalMirrorWriteOp`, `upsertMirrorRow`, `applyRemoteRow`, `applyLocalMirrorWrite`, `deleteMirrorRow` | Inventory-Fachplanung, Mengen-/Öffnungsregeln, Undo-/Konfliktentscheidung, React, UI |
| `src/lib/sync/resolve-inventory-conflict.ts` | `use-inventory-conflicts.ts`, Conflict-Reconfirm-UI, Reconciliation-Tests | Lifecycle-Owner, lokaler Commit, Outbox-/Konfliktdatensatz, generische Mirror-Schreibgrenze | **Ziel:** `resolveInventoryConflict`, `reconfirmInventoryConflict`, `discardInventoryConflict`, typisierte Conflict-Ergebnisse | Push-Transport, React-Komponenten, direkte SQL-Statements, zweiter Konflikt-Owner |
| `src/lib/sync/pull.ts` | `src/lib/sync/sync-runner.ts`, Pull-Integrationstests, generische Pull-Tests | Supabase-Read-Client, Cursor-State, `mirror-write.ts` | `PullOutcome`, `pullHousehold` | Inventory-Arithmetik, Mutation-Hooks, UI, eigene Konfliktentscheidung |
| `src/lib/sync/realtime.ts` | generischer Sync-Runner, Realtime-Tests | Supabase-Realtime-Client und generische Row-/Cursor-Typen | `RealtimeRowEvent`, `RealtimeSubscribeState`, `subscribeHouseholdRealtime` | Inventory-Regeln, lokale Commit-Entscheidung, UI-State |
| `src/features/inventory/use-inventory-items.ts` | Inventory-Screen, Item-Detail, Read-Tests | Query-/DB-Read-Grenze, `inventory-quantity.ts` nur für die definierte Darstellungskonversion | `LocalInventoryItem`, `useInventoryItems`; kein separater Row-Mapper | Mutation, Outbox, Push, eigene Mengenquelle, Testdaten |
| `src/features/inventory/use-inventory-transactions.ts` | Transaction-History-UI, Read-Tests | kanonische Transaction-Read-Grenze, Lifecycle-Typen für Labels/Operationen | **Ziel:** `useInventoryTransactions`, `groupInventoryTransactions`, `getInventoryTransactionLabel` | Undo-Entscheidung, Commit, Outbox, direkte Server-RPCs |
| `src/features/inventory/use-inventory-conflicts.ts` | Conflict-UI, Read-Tests | Conflict-Read-/Reconciliation-Owner, React Query | **Ziel:** `useInventoryConflicts` | Konfliktauflösung, Commit, direkte DB-Schreibvorgänge |
| `src/features/shopping-list/hooks/use-complete-shopping-run.ts` | Shopping-List-UI und Shopping-Completion-Tests | kanonischer lokaler Commit, bestehende Shopping-Query-/Invalidierungsgrenze | `useCompleteShoppingRun` | parallele Inventory-/Ledger-Erzeugung, direkte Outbox-/Mirror-Schreiblogik, direkte RPC-/Push-Logik |

### Test- und Fixture-Importe

Testdaten laufen nur in Richtung Test. Kein Produktions-Owner darf eine
Datei unter `test/` importieren. Gemeinsame Fixtures importieren keine
Produktionsimplementierung, wenn dadurch die zu testende Entscheidung
vorweggenommen würde.

| Datei | Importiert von | Importiert direkt | Öffentliche Exporte / Funktionsnamen |
| --- | --- | --- | --- |
| `test/shared-test-data.ts` | Lifecycle-, Mutation-, Commit- und DB-Tests | nur typisierte Testtypen bzw. Literale | `SHARED_TEST_QUANTITIES`, `SHARED_TEST_DATA`; spätere Factorys nur mit benannter `unit` und expliziten Overrides |
| `test/test-data.ts` | generische Test-Helper-Tests und fokussierte Fachtests | keine Produktions-Owner | `MIN_TEST_VALUE`, `MAX_TEST_VALUE`, `createTestData`, `randomInteger`; Zufall nur über injizierte oder reproduzierbare Quelle |
| `test/test-data.test.ts` | Test-Runner | `test/test-data.ts` | keine öffentlichen Produktions-Exporte |
| `test/conventions/inventory-operation-ownership.test.ts` | Test-Runner | Owner-Map, Repository-Dateien und statische Importanalyse | keine Produktions-Exporte; Architektur-Gate |
| `test/adversarial-inventory-lifecycle.test.ts` | Test-Runner | Lifecycle-Owner und gemeinsame Testdaten | keine Produktions-Exporte; adversariales Invarianten-Gate |
| `src/features/inventory/inventory-lifecycle.test.ts` | Test-Runner | Lifecycle-Owner, Mengen-Owner, gemeinsame Testdaten | keine Produktions-Exporte; Unit-Nachweis |
| `supabase/tests/27_inventory_quantity_atomic.test.sql` bis `31_inventory_merge_undo_atomic.test.sql` | lokaler pgTAP-Runner | deklaratives Supabase-Schema | keine TypeScript-Exporte; DB-Verträge und RLS-/Atomicity-Gates |

## Mengenbasis vor dem ersten Code-Inkrement

Die gespeicherte Zahl ist ein Dezimalwert in der ausdrücklich gespeicherten
Basis-`unit`. Es gibt keine künstliche Tausendstel-Skalierung:

- Bei `unit = 'g'` ist `300 g` als `300` gespeichert.
- Bei `unit = 'piece'` ist eine ganze Packung `1`, eine halbe Packung `0,5`.
- Bei `unit = 'dose'` ist eine halbe Dose `0,5`; die Einheit wird nicht
  automatisch in Gramm oder Milliliter umgerechnet.
- Werte mit mehr als einer Nachkommastelle werden an der Mengen-Grenze
  abgewiesen. `0,5` und `0,1` bleiben gültige Bruchteile.

Vor `fam-9vt.9` müssen Contract, Grenzfunktion und Test-Fixtures dieselbe
Mengenbasis verwenden. Jede gemeinsame Fixture nennt deshalb die physische
Menge und ihre `unit`; ein nackter Wert ohne Einheit ist kein zulässiger
fachlicher Testfall.

## Produktions-Owner

| Datei | Status | Einzige Verantwortung | Erlaubte öffentliche Grenze | Slice / Beads |
| --- | --- | --- | --- | --- |
| `src/lib/inventory-quantity.ts` | vorhanden, noch alte Skalierung | Dezimalwerte in der gespeicherten Einheit, Grenzprüfung und Normalisierung an der benannten Mengen-/UI-Grenze | **Ziel:** `MAX_INVENTORY_QUANTITY`, `isPositiveInventoryQuantity`, `isNonNegativeInventoryQuantity`, `normalizeInventoryQuantity`, `sumInventoryQuantities`, `subtractInventoryQuantities` | Mengen-Grenze / `fam-9vt.9` |
| `src/lib/db/schemas/inventory.ts` | fehlt, neu | Lokale Drizzle-Tabellen und Inventory-Spalten für Lose, Orte und Ledger; `location_id` ist vor v1 nicht nullable | `fridgeItems`, `storageLocations`, `transactions` | Mengen-Grenze / `fam-9vt.9` |
| `src/lib/db/schemas/system.ts` | vorhanden | Gemeinsame Outbox-, Sync-State- und App-Meta-Persistenz | bestehende `outbox`, `syncState`, `appMeta`; keine Inventory-Fachlogik | Mengen-Grenze / `fam-9vt.9` |
| `supabase/schemas/08_inventory.sql` | fehlt, neu | Deklaratives Server-Schema, Inventory-RPCs, Receipts, Snapshots und RLS-Basis; `location_id`-Pflicht gehört zum v1-Schema | Tabellen, Funktionen, Constraints und Policies dieser Datei; Migrationen werden generiert | Mengen-/Server-Grenze / `fam-9vt.9`, `fam-9vt.11` |
| `supabase/schemas/20_privileges.sql` | vorhanden, Reset-Grenze | Ausführungsrechte für die autoritativen Inventory-RPCs; alte RPC-Grants werden erst mit `08_inventory.sql` auf die Ziel-RPCs umgestellt | **Ziel:** Execute-Recht für `read_inventory_sync_snapshot` und die in `08_inventory.sql` definierten Mutations-RPCs; keine fachliche Clientlogik | Server-Receipt / `fam-9vt.11` |
| `src/features/inventory/inventory-lifecycle.ts` | fehlt, neu | Reine Operationstypen, Eingangsvalidierung, Footprint und fachliche Planung | `InventoryOperationV1`, `InventoryOperationFootprint`, `MergeSnapshotV1`, `validateInventoryOperation`, `assertValidInventoryOperation`, `computeInventoryOperationFootprint`, `planInventoryOperation` | Owner-/Operationsmodell / `fam-9vt.1`; lokale Slices / `fam-9vt.2`, `.10`, `.3` |
| `src/lib/sync/inventory-quantity.ts` | fehlt, neu | Lokaler exklusiver Commit von Bestand, Ledger und Outbox nach einem Lifecycle-Plan | ein kanonischer `commitInventoryOperation`-Einstieg plus Ergebnis-/Fehlertypen; keine zweite Payload-Validierung | Lokale Operationen / `fam-9vt.2`, `.10`, `.3` |
| `src/lib/db/outbox.ts` | vorhanden | Generisches Speichern, Laden, Retry- und Outcome-Lifecycle der Outbox | bestehende Outbox-API; keine fachliche Inventory-Entscheidung | Lokale Operationen / `fam-9vt.2`; Konflikte / `fam-9vt.11` |
| `src/features/inventory/use-inventory-mutations.ts` | vorhanden, Reset-Datei | React-Query-Mutationsadapter, Invalidierung und UI-Absicht an den lokalen Commit weiterreichen | bestehende Hook-Grenze wie `useAddFridgeItemMutation`, `useRestoreFridgeItemMutation`, `useUpdateInventoryItemQuantityMutation`, `useUpdateFridgeItemMutation`; keine eigene Mengen-/Undo-Regel | Lokale Operationen / `fam-9vt.2`, `.10`, `.3` |
| `src/lib/sync/push.ts` | vorhanden | Generischer Outbox-Transport, Retry, RPC-Aufruf und Ack-/Fehlerklassifikation | bestehende Push-API erweitern; Inventory-Receipt nur weiterleiten, nicht fachlich neu berechnen | Server-Receipt / `fam-9vt.11`; Unknown / `fam-9vt.11` |
| `src/lib/sync/mirror-write.ts` | vorhanden | Generische atomare Projektion bestätigter lokaler oder entfernter Zeilen; Inventory-Reconciliation ohne eigene Fachregel | `applyLocalMirrorWrite`, `applyRemoteRow`, `upsertMirrorRow`, `deleteMirrorRow`; darf reine Operationstypen/Footprints aus `inventory-lifecycle.ts` konsumieren | Server-Receipt / `fam-9vt.11`; Reconciliation / `fam-9vt.11` |
| `src/lib/sync/resolve-inventory-conflict.ts` | fehlt, neu | Inventory-spezifische Konfliktentscheidung und Reconfirm-/Discard-Orchestrierung | `resolveInventoryConflict`, `reconfirmInventoryConflict`, `discardInventoryConflict` sowie typisierte Ergebnis-/Fehlertypen | Unknown-/Konflikt-Reconciliation / `fam-9vt.11` |
| `src/lib/sync/pull.ts` | vorhanden | Generischer Pull von Serverbasis und Cursor-Fortschreibung | bestehende Pull-Grenze; Inventory-Projektion an `mirror-write` delegieren | Read-/Reconciliation / `fam-9vt.11` |
| `src/lib/sync/realtime.ts` | vorhanden | Generisches Realtime-Abonnement und Weitergabe von Row-Events | bestehende `subscribeHouseholdRealtime`-Grenze; keine Inventory-Facharithmetik | Read-/Reconciliation / `fam-9vt.11` |
| `src/features/inventory/use-inventory-items.ts` | vorhanden, Reset-Datei | Inventory-Read-Model und genau eine Persistenz-/View-Konversion innerhalb des Hooks | `LocalInventoryItem`, `useInventoryItems`; kein erfundener `mapFridgeItemRow`-Export | Read-Verbraucher / `fam-9vt.11` |
| `src/features/inventory/use-inventory-transactions.ts` | fehlt, neu | History-Read, Gruppierung und Anzeige aus kanonischen Transaktionen | `useInventoryTransactions` plus reine Anzeige-/Gruppierungshelper; keine eigene Undo-Entscheidung | Lifecycle-Read / `fam-9vt.10`, `.3` |
| `src/features/inventory/use-inventory-conflicts.ts` | fehlt, neu | Lokale Darstellung des Konfliktstatus | `useInventoryConflicts`; keine Auflösungsentscheidung außerhalb des Konflikt-Owners | Konflikt-Read / `fam-9vt.11` |
| `src/features/shopping-list/hooks/use-complete-shopping-run.ts` | vorhanden | Einkaufsabschluss an den kanonischen Inventory-Commit anbinden | bestehender `useCompleteShoppingRun`; keine parallele Ledger-/Inventory-Erzeugung | Read-/Write-Verbraucher und Aktivierungsgate / `fam-9vt.11` |

## Test- und Fixture-Owner

Diese Dateien sind Test-Infrastruktur. Sie sind keine Produktions-Owner und
werden nicht in die Grenze von vier Produktionsdateien eingerechnet.

Die pgTAP-Dateien `27` bis `31` bleiben als stabile Testpfade erhalten, sind
aber im Clean-Worktree zunächst Baseline und kein Beleg für den v1-Vertrag.
Verwendungen alter RPC-Namen, `bigint`, `transactions.undone`,
`transactions.type = 'open'` oder künstlich skalierter Mengen werden in den
jeweiligen Dateien auf das Dezimalmodell und den Receipt-Vertrag umgestellt.
Die bestehenden Dateinamen werden dafür nicht dupliziert oder gelöscht.

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
2. `fam-9vt.9`: Mengen-Grenze, `location_id`-Pflicht und deklarative
   lokale/serverseitige Schemata.
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
