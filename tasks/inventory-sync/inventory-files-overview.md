# Inventory-Dateiübersicht

Stand: 2026-09-08  
Scope: die 30 von Marco benannten Dateien unter `src/features/inventory/`.

Dieses Dokument ist eine Arbeitsübersicht und keine zweite normative Quelle. Für
fachliche Regeln, Owner und Änderungsgrenzen gelten weiterhin:

- `tasks/inventory-sync/contract.md`
- `tasks/inventory-sync/CONSTRAINTS.md`
- `tasks/inventory-sync/execution-plan.md`

## Größen-Hotspots

| Datei | Zeilen | Hauptverantwortung |
| --- | ---: | --- |
| `add-item-screen.tsx` | 464 | Artikelanlage, Produktsuche, Scanner, Lagerort |
| `inventory-lifecycle.ts` | 1.614 | Lifecycle-Planung, Validierung, Undo, Footprint |
| `inventory-screen.tsx` | 576 | Vorratsansicht und Aktionsorchestrierung |
| `product-search-dropdown.tsx` | 328 | Produktsuche und Dropdown-UI |
| `use-inventory-mutations.harness.tsx` | 1.020 | Test-Harness und SQLite-Fixtures |
| `use-inventory-mutations.integration.test.tsx` | 1.235 | SQLite-Integrationstests |
| `use-inventory-mutations.test.tsx` | 823 | Hook-/Mutation-Tests |
| `use-inventory-mutations.ts` | 1.415 | Inventory-Schreibpfade, Undo, Konflikte |

Die übrigen 22 Dateien liegen zwischen 1 und 285 Zeilen.

## Exportierte Funktionen und Komponenten

`api.ts` und `product-detail-modal.tsx` enthalten keine eigene Fachfunktion,
sondern nur Re-Exports.

| Datei | Exportierte Funktionen/Komponenten |
| --- | --- |
| `add-item-screen.tsx` | `AddItemScreen` |
| `add-product-screen.tsx` | `AddProductScreen` |
| `expiry.ts` | `getExpiryInfo`, `compareByExpiry` |
| `frequent-products-quick-select.tsx` | `FrequentProductsQuickSelect` |
| `inventory-lifecycle.ts` | `inventoryUndoMode`, `undoTransactionNotes`, `splitTransactionNotes`, `getSplitOriginItemId`, `planOpenInventoryItem`, `canUndoTransaction`, `planUndoOpenTransaction`, `inverseTransactionType`, `validateInventoryOperation`, `assertValidInventoryOperation`, `computeInventoryOperationFootprint` |
| `inventory-screen.tsx` | `InventoryScreen` |
| `opened-expiry.ts` | `estimateOpenedExpiryDays`, `getVacuumExpiryDays`, `calculateOpenedExpiryDate` |
| `product-search-dropdown.tsx` | `ProductSearchDropdown` als `forwardRef`-Komponente |
| `repair-fridge-item-push.ts` | `repairFridgeItemForeignKeyViolation` |
| `storage-locations-screen.tsx` | `StorageLocationsScreen` |
| `trigger-off-enrichment.ts` | `triggerOffEnrichment` |
| `use-inventory-items.ts` | `mapFridgeItemRow`, `readFridgeItemRow`, `useInventoryItems` |
| `use-inventory-transactions.ts` | `isInventoryMoveTransaction`, `isInventoryTransactionUndoable`, `transactionUndoLabel`, `useInventoryTransactions`, `filterTransactionsForProduct`, `groupTransactionsByDay`, `transactionLabel`, `transactionReasonLabel` |
| `visible-items.ts` | `selectVisibleInventoryItems` |
| `api.ts` | Re-Export von `useInventoryItems` |
| `barcode-scanner-modal.tsx` | `BarcodeScannerModal` |
| `grouped-items.ts` | `groupInventoryItems` |
| `pending-product-selection.ts` | `setPendingProductSelection`, `consumePendingProductSelection` |
| `persist-off-product.ts` | `persistOffProductIfNeeded` |
| `product-detail-modal.tsx` | Re-Export von `ProductInformation` als `ProductDetailModal` |
| `use-expiry-notifications.ts` | `useExpiryNotifications` |
| `use-inventory-conflicts.ts` | `useInventoryConflicts` |
| `use-inventory-mutations.ts` | `useAddFridgeItemMutation`, `useRestoreFridgeItemMutation`, `useUpdateInventoryItemQuantityMutation`, `useUpdateFridgeItemMutation`, `useOpenInventoryItemMutation`, `useWasteInventoryItemMutation`, `useMoveInventoryItemMutation`, `useUndoOpenTransactionMutation`, `useUndoInventoryTransactionMutation`, `useDiscardInventoryConflictMutation`, `useReconfirmInventoryConflictMutation` |
| `use-product-mutations.ts` | `useAddProductMutation` |
| `use-product.ts` | `useProduct` |
| `use-storage-locations.ts` | `useStorageLocations`, `useAddStorageLocationMutation`, `useUpdateStorageLocationMutation`, `useDeleteStorageLocationMutation` |

## Wichtige interne Owner

### Lifecycle-Owner

`inventory-lifecycle.ts` ist Owner für fachliche Planung und Validierung:

- `planOpenInventoryItem`
- `planUndoOpenTransaction`
- `validateInventoryOperation`
- `assertValidInventoryOperation`
- `computeInventoryOperationFootprint`
- `sameSplitIdentity`
- `validateMergeSnapshot`

Andere Schichten dürfen diese Entscheidungen nicht erneut interpretieren,
klassifizieren oder reconciliieren.

### Read-Grenze

`use-inventory-items.ts` ist die Read-Grenze für `LocalInventoryItem`:

- `mapFridgeItemRow` konvertiert Persistenzmengen an der Read-Grenze.
- `readFridgeItemRow` ist die gemeinsame Einzelzeilenabfrage.
- `useInventoryItems` liefert die Haushaltsliste.

Darauf bauen `grouped-items.ts`, `visible-items.ts`, `inventory-screen.tsx` und
`use-expiry-notifications.ts` auf.

### Schreib- und Reversal-Owner

`use-inventory-mutations.ts` bündelt die Inventory-Schreibpfade. Wichtige
interne Funktionen sind:

- `transactionMutation`
- `groupedMoveMutation`
- `transactionPayloadFromPlan`
- `lifecycleItemFromLocal`
- `lifecycleItemPayload`
- `lifecyclePatchPayload`
- `enqueueQuantityReversal`
- `enqueueMoveReversal`
- `invalidateAfterConflictResolution`

Die wiederholten Callback-Strukturen `mutationFn`, `applyLocally` und
`onSuccess` bilden den größten lokalen Komplexitätsblock.

## Wichtigste Überschneidungen

### 1. Direkte Test-Duplikation

`use-inventory-mutations.harness.tsx` und
`use-inventory-mutations.integration.test.tsx` enthalten nahezu dieselben
Testhelfer und SQL-Fixtures:

- `createQueryClient`
- `HookHarness`
- `renderMutationHook`
- `insertItem`
- `rowsForItem`
- `insertTransaction`
- `outboxRows`

Der wesentliche Unterschied ist das Backend: Native-/On-Device-SQLite im Harness
gegen Node-SQLite plus Migrationen im Integrationstest.

### 2. Doppelte Gruppierung

`inventory-screen.tsx` berechnet `allGroups` direkt mit
`groupInventoryItems`. Danach ruft der Screen `selectVisibleInventoryItems`
auf, das intern erneut `groupInventoryItems` ausführt.

Betroffene Dateien:

- `inventory-screen.tsx`
- `visible-items.ts`
- `grouped-items.ts`

Das ist eine konkrete doppelte Berechnung im Renderpfad.

### 3. Lifecycle, Mutationen und UI

- `inventory-lifecycle.ts`: fachliche Planung und Validierung
- `use-inventory-mutations.ts`: lokale Writes, Ledger, Outbox und Reversals
- `inventory-screen.tsx`: Benutzeraktionen und Mutation-Aufrufe

Die fachliche Entscheidung muss im Lifecycle-Owner bleiben.

### 4. Ablaufdatum-Logik

Der gemeinsame fachliche Bereich umfasst:

- `expiry.ts`: allgemeine Bucket-/Sortierlogik
- `opened-expiry.ts`: geöffnete Produkte und Regelbasis
- `inventory-lifecycle.ts`: Nutzung der geöffneten Ablaufberechnung
- `add-item-screen.tsx`: eigene Datumsoffset-Helfer
- `grouped-items.ts` und `visible-items.ts`: Anzeige und Sortierung
- `use-expiry-notifications.ts`: Benachrichtigungsfilter

Bei Änderungen muss verhindert werden, dass Ablaufregeln mehrfach fachlich
berechnet werden.

### 5. Produkt- und OFF-Fluss

Überschneidende Dateien:

- `add-item-screen.tsx`
- `add-product-screen.tsx`
- `frequent-products-quick-select.tsx`
- `product-search-dropdown.tsx`
- `barcode-scanner-modal.tsx`
- `pending-product-selection.ts`
- `persist-off-product.ts`
- `trigger-off-enrichment.ts`
- `use-product.ts`
- `use-product-mutations.ts`

`add-item-screen.tsx` ist hier der zentrale UI-Orchestrator.

### 6. Transaktionen und Undo

Undo ist über mehrere Schichten verteilt:

- Anzeige und Labels: `use-inventory-transactions.ts`
- Benutzeraktion: `inventory-screen.tsx`
- Mutation und Reversal: `use-inventory-mutations.ts`
- Inverse Operation und Footprint: `inventory-lifecycle.ts`

Diese Pfade müssen bei Änderungen gemeinsam geprüft werden.

### 7. Lagerorte

Lagerortlogik überschneidet sich zwischen:

- `storage-locations-screen.tsx`
- `use-storage-locations.ts`
- `add-item-screen.tsx`
- `inventory-screen.tsx`
- `repair-fridge-item-push.ts`

CRUD gehört in `use-storage-locations.ts`. UI-Dateien orchestrieren nur die
Aktion. Der FK-Reparaturpfad darf die fachliche Absicht nicht verändern.

### 8. Wiederholte React-Query-Strukturen

`queryFn`, `mutationFn`, `applyLocally` und `onSuccess` wiederholen sich in:

- `use-inventory-mutations.ts`
- `use-product-mutations.ts`
- `use-storage-locations.ts`
- `use-inventory-items.ts`
- `use-inventory-transactions.ts`
- `use-product.ts`
- `use-inventory-conflicts.ts`

Das ist teilweise das normale React-Query-Muster. Eine neue allgemeine
Abstraktionsschicht wäre nach `CONSTRAINTS.md` jedoch nicht zulässig.

## Priorisierte Review-Hotspots

1. `use-inventory-mutations.ts`: größte Produktionsdatei und zentraler
   Schreibpfad.
2. `inventory-lifecycle.ts`: einziger Owner für fachliche Operationen,
   Validierung und Footprint.
3. `inventory-screen.tsx`: UI-Orchestrator mit doppelter Gruppierungsarbeit.
4. `use-inventory-mutations.harness.tsx` und
   `use-inventory-mutations.integration.test.tsx`: größte Test-Duplikation.
5. `expiry.ts` und `opened-expiry.ts`: Ablaufregeln auf doppelte fachliche
   Berechnung prüfen.

