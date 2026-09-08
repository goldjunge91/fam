Die Bestandsaufnahme ist abgeschlossen. Es wurden keine Dateien geändert.

Ausgewertet: 30 Dateien, insgesamt 9.359 Zeilen. Die Funktionserkennung erfolgte per TypeScript-AST, die Überschneidungen zusätzlich über den internen Importgraphen.

Legende: `E` = exportiert, `I` = intern, `C` = benannter Callback/Funktionswert.

## Dateien mit mehr als 300 Zeilen

| Datei | Zeilen | Schwerpunkt |
|---|---:|---|
| [`add-item-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/add-item-screen.tsx) | 464 | Artikelanlage, Produktsuche, Lagerort, Barcode |
| [`inventory-lifecycle.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/inventory-lifecycle.ts) | 1.614 | Lifecycle-Vertrag, Validierung, Undo, Footprint |
| [`inventory-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/inventory-screen.tsx) | 576 | Vorrats-Screen und Aktionsorchestrierung |
| [`product-search-dropdown.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/product-search-dropdown.tsx) | 328 | Produktsuche und Dropdown-UI |
| [`use-inventory-mutations.harness.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-mutations.harness.tsx) | 1.020 | Test-Harness, SQLite-Fixtures |
| [`use-inventory-mutations.integration.test.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-mutations.integration.test.tsx) | 1.235 | Integrations-Tests mit SQLite |
| [`use-inventory-mutations.test.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-mutations.test.tsx) | 823 | Hook-/Mutation-Tests |
| [`use-inventory-mutations.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-mutations.ts) | 1.415 | Alle Inventory-Schreibpfade, Undo, Konflikte |

## Funktionsinventar

### [`add-item-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/add-item-screen.tsx)

- `I` `formatOffsetDate` L43
- `I` `formatOffsetMonths` L49
- `I` `quickDateOffset` L64
- `E` `AddItemScreen` L79
- `C` `onFound` L144
- `I` `handleAddLocation` L162
- `I` `handleSave` L177

23 Funktionsknoten insgesamt, davon 16 anonyme/inline Callbacks.

### [`add-product-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/add-product-screen.tsx)

- `I` `parseOptionalNumber` L10
- `E` `AddProductScreen` L17
- `I` `handleSave` L31

### [`expiry.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/expiry.ts)

- `I` `calendarDaysBetween` L20
- `E` `getExpiryInfo` L26
- `E` `compareByExpiry` L81

### [`frequent-products-quick-select.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/frequent-products-quick-select.tsx)

- `I` `toOpenFoodFactsProduct` L15
- `E` `FrequentProductsQuickSelect` L41
- `C` `queryFn` L49

### [`inventory-lifecycle.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/inventory-lifecycle.ts)

- `E` `inventoryUndoMode` L82
- `E` `undoTransactionNotes` L92
- `E` `splitTransactionNotes` L100
- `E` `getSplitOriginItemId` L104
- `I` `toIsoTimestamp` L113
- `I` `assertValidOpenQuantity` L117
- `E` `planOpenInventoryItem` L132
- `E` `canUndoTransaction` L197
- `I` `sameSplitIdentity` L202
- `E` `planUndoOpenTransaction` L243
- `E` `inverseTransactionType` L296
- `I` `isNonEmptyString` L520
- `I` `isNonEmptyStringProp` L524
- `I` `validationError` L621
- `I` `validateMergeSnapshot` L631
- `E` `validateInventoryOperation` L651
- `E` `assertValidInventoryOperation` L1224
- `I` `emptyFootprint` L1234
- `E` `computeInventoryOperationFootprint` L1239

### [`inventory-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/inventory-screen.tsx)

- `E` `InventoryScreen` L55
- `I` `updateQuantity` L168
- `I` `handleEdit` L173
- `I` `handleConsume` L178
- `C` `onSuccess` L184
- `I` `handleOpen` L193
- `I` `handleWaste` L198
- `I` `closeOpenItem` L203
- `I` `closeWasteItem` L208
- `I` `closeEditItem` L213
- `I` `confirmOpen` L218
- `C` `onSuccess` L224
- `I` `confirmWaste` L233
- `C` `onSuccess` L239
- `I` `quickOpen` L248
- `I` `quickConsume` L252
- `I` `undoTransaction` L257
- `C` `onError` L261
- `I` `handleDeletePress` L270
- `C` `onPress` L278
- `I` `handleGroupRemove` L284

66 Funktionsknoten insgesamt, davon 45 weitere Inline-Funktionen.

### [`opened-expiry.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/opened-expiry.ts)

- `I` `normalize` L198
- `I` `normalizeLocation` L206
- `I` `firstMatch` L217
- `E` `estimateOpenedExpiryDays` L228
- `E` `getVacuumExpiryDays` L255
- `I` `toIsoDate` L259
- `I` `parseIsoDate` L266
- `E` `calculateOpenedExpiryDate` L273

### [`product-search-dropdown.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/product-search-dropdown.tsx)

- `E` `ProductSearchDropdown` L49, `forwardRef`-Komponente
- `I` `dismiss` L112

Zusätzlich 17 Inline-/Closure-Funktionen.

### [`repair-fridge-item-push.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/repair-fridge-item-push.ts)

- `E` `repairFridgeItemForeignKeyViolation` L3

### [`storage-locations-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/storage-locations-screen.tsx)

- `E` `StorageLocationsScreen` L14
- `I` `handleAdd` L27
- `I` `handleUpdate` L40
- `I` `handleDelete` L55
- `C` `onPress` L62

### [`trigger-off-enrichment.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/trigger-off-enrichment.ts)

- `E` `triggerOffEnrichment` L3

### [`use-inventory-items.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-items.ts)

- `E` `mapFridgeItemRow` L46
- `E` `readFridgeItemRow` L61
- `E` `useInventoryItems` L95
- `C` `queryFn` L98

### [`use-inventory-transactions.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-transactions.ts)

- `E` `isInventoryMoveTransaction` L33
- `E` `isInventoryTransactionUndoable` L44
- `E` `transactionUndoLabel` L67
- `E` `useInventoryTransactions` L75
- `C` `queryFn` L78
- `E` `filterTransactionsForProduct` L133
- `I` `localDayKey` L151
- `I` `startOfLocalDay` L157
- `I` `formatCalendarDate` L161
- `E` `groupTransactionsByDay` L167
- `E` `transactionLabel` L195
- `E` `transactionReasonLabel` L211

### [`visible-items.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/visible-items.ts)

- `E` `selectVisibleInventoryItems` L23

### [`api.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/api.ts)

- `R` `useInventoryItems` wird aus `use-inventory-items.ts` re-exportiert
- Keine eigene Funktion

### [`barcode-scanner-modal.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/barcode-scanner-modal.tsx)

- `I` `useCameraPermissionsHook` L12
- `E` `BarcodeScannerModal` L37
- `I` `handleBarcodeScanned` L59

### [`grouped-items.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/grouped-items.ts)

- `I` `normalizeName` L19
- `I` `groupKey` L23
- `I` `earliestLot` L28
- `E` `groupInventoryItems` L40

### [`pending-product-selection.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/pending-product-selection.ts)

- `E` `setPendingProductSelection` L18
- `E` `consumePendingProductSelection` L22

### [`persist-off-product.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/persist-off-product.ts)

- `E` `persistOffProductIfNeeded` L8

### [`product-detail-modal.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/product-detail-modal.tsx)

- `R` `ProductDetailModal` ist nur ein Re-export von `ProductInformation`
- Keine lokale Funktion

### [`use-expiry-notifications.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-expiry-notifications.ts)

- `E` `useExpiryNotifications` L7
- `I` `syncNotifications` L15

### [`use-inventory-conflicts.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-conflicts.ts)

- `E` `useInventoryConflicts` L18
- `C` `queryFn` L30

### [`use-inventory-mutations.harness.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-mutations.harness.tsx)

- `C` `useSession` L40
- `C` `trackAnalyticsEvent` L48
- `C` `randomUUID` L52
- `I` `createQueryClient` L86
- `I` `HookHarness` L95
- `I` `renderMutationHook` L100
- `C` `onReady` L107
- `C` Getter `current` L113
- `I` `insertItem` L120
- `I` `rowsForItem` L150
- `I` `insertTransaction` L171
- `I` `outboxRows` L215

### [`use-inventory-mutations.integration.test.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-mutations.integration.test.tsx)

- `I` `createQueryClient` L73
- `I` `HookHarness` L82
- `I` `renderMutationHook` L89
- `C` `onReady` L99
- `C` Getter `current` L106
- `C` `unmount` L110
- `I` `insertItem` L117
- `I` `rowsForItem` L147
- `I` `insertTransaction` L168
- `I` `outboxRows` L212

### [`use-inventory-mutations.test.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-mutations.test.tsx)

- `C` `useSession` L25
- `C` `getFirstAsync` L34
- `I` `wrapper` L68
- `I` `lastMutations` L84
- `I` `transactionPayloads` L88

### [`use-inventory-mutations.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-mutations.ts)

Exportierte Hooks:

- `E` `useAddFridgeItemMutation` L259
- `E` `useRestoreFridgeItemMutation` L332
- `E` `useUpdateInventoryItemQuantityMutation` L360
- `E` `useUpdateFridgeItemMutation` L495
- `E` `useOpenInventoryItemMutation` L691
- `E` `useWasteInventoryItemMutation` L809
- `E` `useMoveInventoryItemMutation` L865
- `E` `useUndoOpenTransactionMutation` L907
- `E` `useUndoInventoryTransactionMutation` L1343
- `E` `useDiscardInventoryConflictMutation` L1387
- `E` `useReconfirmInventoryConflictMutation` L1400

Interne Funktionen:

- `I` `transactionMutation` L87
- `C` `applyLocally` L102
- `I` `assertValidInventoryQuantity` L107
- `I` `groupedMoveMutation` L115
- `I` `transactionPayloadFromPlan` L180
- `I` `lifecycleItemFromLocal` L204
- `I` `lifecycleItemPayload` L225
- `I` `lifecyclePatchPayload` L244
- `I` `useInventoryActor` L254
- `C` `mutationFn` L264, L336, L365, L500, L696, L814, L870, L912, L1349, L1391, L1405
- `C` `applyLocally` L308, L346, L591, L740, L847, L1049, L1074
- `C` `onSuccess` L322, L351, L441, L680, L798, L854, L896, L1143, L1370, L1395, L1413
- `C` `genericReversalLedger` L1008
- `I` `enqueueQuantityReversal` L1161
- `I` `enqueueMoveReversal` L1257
- `I` `isMoveTransaction` L1325
- `I` `invalidateAfterConflictResolution` L1379

### [`use-product-mutations.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-product-mutations.ts)

- `E` `useAddProductMutation` L24
- `C` `mutationFn` L28
- `C` `applyLocally` L56
- `C` `onSuccess` L62

### [`use-product.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-product.ts)

- `E` `useProduct` L21
- `C` `queryFn` L24

### [`use-storage-locations.test.tsx`](/Users/marco/Github.tmp/fam/src/features/inventory/use-storage-locations.test.tsx)

- `C` `runAsync` L16
- `C` `getAllAsync` L17
- `I` `wrapper` L28

### [`use-storage-locations.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-storage-locations.ts)

- `E` `useStorageLocations` L16
- `C` `queryFn` L19
- `E` `useAddStorageLocationMutation` L31
- `C` `mutationFn` L35
- `C` `applyLocally` L68
- `C` `onSuccess` L80
- `E` `useUpdateStorageLocationMutation` L87
- `C` `mutationFn` L91
- `C` `applyLocally` L114
- `C` `onSuccess` L120
- `E` `useDeleteStorageLocationMutation` L127
- `C` `mutationFn` L131
- `C` `applyLocally` L146
- `C` `onSuccess` L152

## Direkte und fachliche Überschneidungen

### 1. Test-Harness-Duplikation

Die stärkste direkte Überschneidung besteht zwischen:

- [`use-inventory-mutations.harness.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-mutations.harness.tsx)
- [`use-inventory-mutations.integration.test.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-mutations.integration.test.tsx)

Beide enthalten nahezu dieselben Testhelfer:

- `createQueryClient`
- `HookHarness`
- `renderMutationHook`
- `insertItem`
- `rowsForItem`
- `insertTransaction`
- `outboxRows`

Der Unterschied liegt hauptsächlich im Test-Backend:

- Harness: echtes On-Device-/Native-SQLite
- Integrationstest: Node-SQLite-Adapter mit Drizzle-/Migrationssetup

Zusätzlich überschneidet sich [`use-inventory-mutations.test.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-mutations.test.tsx) bei Mocking, Wrappern und Mutation-Payload-Prüfungen.

### 2. Doppelte Gruppierung im Inventory-Screen

Diese drei Dateien überschneiden sich direkt:

- [`inventory-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/inventory-screen.tsx)
- [`visible-items.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/visible-items.ts)
- [`grouped-items.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/grouped-items.ts)

`inventory-screen.tsx` berechnet `allGroups` direkt mit `groupInventoryItems`. Danach ruft der Screen zusätzlich `selectVisibleInventoryItems` auf, das intern erneut `groupInventoryItems` ausführt.

Das ist eine echte doppelte Berechnung innerhalb eines Renderpfads.

### 3. Lifecycle und Mutation-Schreibpfad

Enge Kopplung zwischen:

- [`inventory-lifecycle.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/inventory-lifecycle.ts)
- [`use-inventory-mutations.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-mutations.ts)
- [`inventory-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/inventory-screen.tsx)

Verantwortungen:

- Lifecycle plant und validiert Operationen.
- Mutation-Hooks erzeugen lokale Writes, Ledger- und Outbox-Einträge.
- Screen orchestriert Benutzeraktionen und ruft die Mutation-Hooks auf.

`use-inventory-mutations.ts` ist dabei der zentrale Hotspot: 11 exportierte Mutations-Hooks plus zahlreiche lokale Payload-, Reversal-, Apply- und Success-Funktionen.

### 4. Inventory-Readmodell

Diese Dateien arbeiten auf demselben `LocalInventoryItem`-Modell:

- [`use-inventory-items.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-items.ts)
- [`visible-items.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/visible-items.ts)
- [`grouped-items.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/grouped-items.ts)
- [`inventory-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/inventory-screen.tsx)
- [`use-expiry-notifications.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-expiry-notifications.ts)
- Mutation- und Integrationstests

`use-inventory-items.ts` ist die eigentliche Read-Grenze. Alle übrigen Dateien verwenden daraus abgeleitete Mengen, Gruppen, Ablaufdaten und Filter.

### 5. Ablaufdatum-Logik

Fachliche Überschneidungen bestehen zwischen:

- [`expiry.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/expiry.ts)
- [`opened-expiry.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/opened-expiry.ts)
- [`inventory-lifecycle.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/inventory-lifecycle.ts)
- [`add-item-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/add-item-screen.tsx)
- [`grouped-items.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/grouped-items.ts)
- [`visible-items.ts`](/Users/marco/Github.tmp/fam/src/features/inventory/visible-items.ts)
- [`use-expiry-notifications.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-expiry-notifications.ts)

`expiry.ts` ist die allgemeine Anzeige-/Sortierlogik. `opened-expiry.ts` enthält die regelbasierte Berechnung nach dem Öffnen. `add-item-screen.tsx` besitzt zusätzlich eigene Datumsoffset-Funktionen.

### 6. Produkt- und Open-Food-Facts-Fluss

Diese Dateien bilden einen zusammenhängenden, teilweise überschneidenden Produktfluss:

- [`add-item-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/add-item-screen.tsx)
- [`add-product-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/add-product-screen.tsx)
- [`frequent-products-quick-select.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/frequent-products-quick-select.tsx)
- [`product-search-dropdown.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/product-search-dropdown.tsx)
- [`barcode-scanner-modal.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/barcode-scanner-modal.tsx)
- [`pending-product-selection.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/pending-product-selection.ts)
- [`persist-off-product.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/persist-off-product.ts)
- [`trigger-off-enrichment.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/trigger-off-enrichment.ts)
- [`use-product.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-product.ts)
- [`use-product-mutations.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-product-mutations.ts)

`add-item-screen.tsx` ist hier der größte UI-Orchestrator und verbindet Suche, Scanner, häufige Produkte, OFF-Persistierung, Produktmutation und Lagerortmutation.

### 7. Transaktionen und Undo

Überschneidung zwischen:

- [`use-inventory-transactions.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-transactions.ts)
- [`inventory-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/inventory-screen.tsx)
- [`use-inventory-mutations.ts`](/Users/marco/Github.tmp/fam/src/features/inventory/use-inventory-mutations.ts)
- [`inventory-lifecycle.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/inventory-lifecycle.ts)

Mehrere Ebenen kennen Undo fachlich:

- Anzeige und Label: `use-inventory-transactions.ts`
- Benutzeraktion: `inventory-screen.tsx`
- konkrete Reversal-Mutation: `use-inventory-mutations.ts`
- inverse Operation und Footprint: `inventory-lifecycle.ts`

### 8. Lagerorte

Überschneidung zwischen:

- [`storage-locations-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/storage-locations-screen.tsx)
- [`use-storage-locations.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-storage-locations.ts)
- [`add-item-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/add-item-screen.tsx)
- [`inventory-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/inventory-screen.tsx)
- [`repair-fridge-item-push.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/repair-fridge-item-push.ts)

Die CRUD-Hooks liegen zentral in `use-storage-locations.ts`, werden aber an mehreren UI-Stellen direkt orchestriert. `repair-fridge-item-push.ts` besitzt zusätzlich einen separaten Reparaturpfad für fehlende Fremdschlüssel.

### 9. Wiederholte React-Query-Mutationsstruktur

Wiederkehrende Funktionsstrukturen:

- `mutationFn`
- `applyLocally`
- `onSuccess`
- `queryFn`

Sie kommen in folgenden Dateien mehrfach vor:

- [`use-inventory-mutations.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-mutations.ts)
- [`use-product-mutations.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-product-mutations.ts)
- [`use-storage-locations.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-storage-locations.ts)
- [`use-inventory-items.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-items.ts)
- [`use-inventory-transactions.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-transactions.ts)
- [`use-product.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-product.ts)
- [`use-inventory-conflicts.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-conflicts.ts)

Das ist teilweise bewusstes React-Query-Muster, aber in `use-inventory-mutations.ts` besonders stark konzentriert.

### 10. Re-export-Überschneidungen

- [`api.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/api.ts) re-exportiert `useInventoryItems` aus `use-inventory-items.ts`.
- [`product-detail-modal.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/product-detail-modal.tsx) aliasiert `ProductInformation` als `ProductDetailModal`.

Beide Dateien enthalten keine eigene Fachlogik.

## Wichtigste Hotspots

1. [`use-inventory-mutations.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-mutations.ts): größter Produktions-Hotspot.
2. [`inventory-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/inventory-screen.tsx): viele UI-, Query-, Gruppierungs- und Mutationsverantwortungen.
3. [`inventory-lifecycle.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/inventory-lifecycle.ts): größter Vertrags-/Regel-Hotspot.
4. [`use-inventory-mutations.harness.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-mutations.harness.tsx) und [`use-inventory-mutations.integration.test.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/inventory/use-inventory-mutations.integration.test.tsx): stärkste direkte Test-Duplikation.
5. `inventory-screen.tsx` plus `visible-items.ts`: doppelte Gruppierung im Renderpfad.