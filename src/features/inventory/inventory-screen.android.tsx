import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/layout/screen';
import { space } from '@/components/theme/index';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Txt } from '@/constants/ui';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { ProductDetailModal } from '@/features/inventory/product-detail-modal';
import { useStorageLocations } from '@/features/inventory/use-storage-locations';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileAvatar } from '@/features/navigation/use-profile-initials';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { EditInventoryItemSheet } from './components/edit-inventory-item-sheet';
import { InventoryHistorySheet } from './components/inventory-history-sheet';
import { InventoryItemActionsSheet } from './components/inventory-item-actions-sheet';
import {
  formatStateSubtitle,
  InventoryItemGroupSheet,
} from './components/inventory-item-group-sheet';
import { InventoryItemRow } from './components/inventory-item-row';
import { InventorySearchField } from './components/inventory-search-field';
import { InventorySummaryCard } from './components/inventory-summary-card';
import { InventoryTabBar } from './components/inventory-tab-bar';
import { OpenInventoryItemSheet } from './components/open-inventory-item-sheet';
import { WasteInventoryItemSheet, type WasteReason } from './components/waste-inventory-item-sheet';
import { getExpiryInfo } from './expiry';
import { groupInventoryItems, type InventoryItemGroup } from './grouped-items';
import { type LocalInventoryItem, useInventoryItems } from './use-inventory-items';
import {
  useOpenInventoryItemMutation,
  useUndoOpenTransactionMutation,
  useUpdateFridgeItemMutation,
  useUpdateInventoryItemQuantityMutation,
  useWasteInventoryItemMutation,
} from './use-inventory-mutations';
import {
  filterTransactionsForProduct,
  type LocalInventoryTransaction,
  useInventoryTransactions,
} from './use-inventory-transactions';
import { type InventorySortMode, selectVisibleInventoryItems } from './visible-items';

export function InventoryScreen() {
  const hubGradient = useHubGradient();
  const { openDrawer, openProfile } = useNavigationChrome();
  const { initials, avatarUrl } = useProfileAvatar();
  const params = useLocalSearchParams<{ filter?: string }>();
  const showExpiringOnly = params.filter === 'expiring';
  const [activeLocationId, setActiveLocationId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<InventorySortMode>('expiry');
  const [actionItem, setActionItem] = useState<LocalInventoryItem | null>(null);
  const [detailGroup, setDetailGroup] = useState<InventoryItemGroup | null>(null);
  const [informationItem, setInformationItem] = useState<LocalInventoryItem | null>(null);
  const [editItem, setEditItem] = useState<LocalInventoryItem | null>(null);
  const [openItem, setOpenItem] = useState<LocalInventoryItem | null>(null);
  const [wasteItem, setWasteItem] = useState<LocalInventoryItem | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [productHistoryGroup, setProductHistoryGroup] = useState<InventoryItemGroup | null>(null);

  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;

  const { data: locations = [], isLoading: locationsLoading } = useStorageLocations(householdId);
  const { data: allItems = [], isLoading } = useInventoryItems(householdId);
  const { data: transactions = [] } = useInventoryTransactions(householdId);
  const updateQty = useUpdateInventoryItemQuantityMutation();
  const updateItem = useUpdateFridgeItemMutation();
  const openMutation = useOpenInventoryItemMutation();
  const undoMutation = useUndoOpenTransactionMutation();
  const wasteMutation = useWasteInventoryItemMutation();

  const today = new Date();
  const allGroups = useMemo(() => groupInventoryItems(allItems, today), [allItems, today]);
  const expiryCounts = allGroups.reduce(
    (counts, item) => {
      const bucket = getExpiryInfo(item.expiry_date, today).bucket;
      if (bucket === 'expired' || bucket === 'critical') counts.critical += 1;
      if (bucket === 'soon') counts.soon += 1;
      return counts;
    },
    { critical: 0, soon: 0 },
  );

  const { bottom } = useSafeAreaInsets();
  const paddingBottom = Math.max(bottom, space.xxl) + space.xxxl;

  const deferredSearchQuery = useDeferredValue(searchQuery);

  // filter=expiring (#73, vom Dashboard-Widget) ueberschreibt den
  // Lagerort-Tab-Filter, statt ihn zu kombinieren — einfacher, und die
  // Tab-Auswahl bleibt fuer den naechsten Besuch ohne den Query-Param erhalten.
  const selectedLocationId =
    activeLocationId === 'all' || locations.some((location) => location.id === activeLocationId)
      ? activeLocationId
      : 'all';

  // SQL liefert bereits MHD-sortiert (default) — der Toggle sortiert nur
  // client-seitig um, keine Requery noetig fuer "Name" (#71).
  const visibleItems = useMemo(
    () =>
      selectVisibleInventoryItems(allItems, {
        locationId: selectedLocationId,
        showExpiringOnly,
        searchQuery: deferredSearchQuery,
        sortMode,
        today,
      }),
    [allItems, selectedLocationId, showExpiringOnly, deferredSearchQuery, sortMode, today],
  );
  const currentActionItem = actionItem
    ? (allItems.find((item) => item.id === actionItem.id) ?? actionItem)
    : null;
  const productHistoryTransactions = useMemo(() => {
    if (!productHistoryGroup) return [];
    return filterTransactionsForProduct(
      transactions,
      productHistoryGroup.product_id,
      new Set(productHistoryGroup.lots.map((lot) => lot.id)),
    );
  }, [productHistoryGroup, transactions]);
  const productHistoryLotLabels = useMemo(
    () =>
      new Map(
        productHistoryGroup?.lots.map((lot, index) => [lot.id, `Los ${index + 1}`] as const) ?? [],
      ),
    [productHistoryGroup],
  );

  function updateQuantity(item: LocalInventoryItem, delta: number) {
    if (!householdId) return;
    updateQty.mutate({ id: item.id, household_id: householdId, delta });
  }

  function handleEdit(item: LocalInventoryItem) {
    setActionItem(null);
    setEditItem(item);
  }

  function handleConsume(item: LocalInventoryItem) {
    updateQuantity(item, -item.quantity);
    setActionItem(null);
  }

  function handleOpen(item: LocalInventoryItem) {
    setActionItem(null);
    setOpenItem(item);
  }

  function handleWaste(item: LocalInventoryItem) {
    setActionItem(null);
    setWasteItem(item);
  }

  function confirmOpen(quantity: number) {
    if (!openItem) return;
    openMutation.mutate({ item: openItem, quantity }, { onSuccess: () => setOpenItem(null) });
  }

  function confirmWaste(reason: WasteReason) {
    if (!wasteItem) return;
    wasteMutation.mutate({ item: wasteItem, reason }, { onSuccess: () => setWasteItem(null) });
  }

  function undoOpening(transaction: LocalInventoryTransaction) {
    undoMutation.mutate(
      { transaction },
      {
        onError: (error) =>
          Alert.alert(
            'Undo nicht möglich',
            error instanceof Error ? error.message : 'Bitte später erneut versuchen.',
          ),
      },
    );
  }

  function handleDeletePress(item: LocalInventoryItem) {
    if (!householdId) return;
    setActionItem(null);
    Alert.alert('Artikel löschen', `"${item.name}" aus dem Vorrat entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () =>
          updateQty.mutate({ id: item.id, household_id: householdId, delta: -item.quantity }),
      },
    ]);
  }

  function handleGroupRemove(group: InventoryItemGroup) {
    if (group.lots.length === 1) {
      handleDeletePress(group.lots[0]);
      return;
    }
    setDetailGroup(group);
  }

  const chrome = { onMenuPress: openDrawer, onAvatarPress: openProfile, initials, avatarUrl };

  if (!householdId) {
    return (
      <Screen title="Vorrat" chrome={chrome}>
        {/* Leerer Zustand wenn noch kein Haushalt aktiv/ausgewählt ist */}
        <Card>
          <EmptyState
            symbol="archivebox"
            title="Noch kein Haushalt"
            hint="Lege im Profil einen Haushalt an oder tritt einem bei. Danach teilt ihr Vorrat und Einkaufsliste in Echtzeit."
          />
        </Card>
      </Screen>
    );
  }

  const activeLocationName =
    selectedLocationId === 'all'
      ? 'Vorrat'
      : (locations.find((location) => location.id === selectedLocationId)?.name ?? 'Vorrat');

  return (
    <Screen
      title="Vorrat"
      chrome={chrome}
      backgroundGradient={hubGradient}
      scroll={false}
      applyBottomPadding={false}>
      {/* Virtuelle Vorratsliste mit Header, Filtern und Artikelgruppen.
          FlashList statt FlatList (#139): Batch-/Window-Tuning entfällt, das
          Recycling regelt die Liste selbst. */}
      <FlashList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom }}
        ListHeaderComponent={
          <View className="gap-three pb-two">
            {/* Vorrats-Statistik: Gesamtanzahl & kritische/bald ablaufende Artikel */}
            <InventorySummaryCard
              totalCount={allGroups.length}
              criticalCount={expiryCounts.critical}
              soonCount={expiryCounts.soon}
            />

            <View className="flex-row items-center justify-between border-b border-border pb-two">
              <Txt
                variant="caption"
                tone="secondary"
                weight="700"
                className="uppercase tracking-[0.5px]">
                Bewegungen
              </Txt>
              <Button
                variant="link"
                title="Verlauf"
                accessibilityLabel="Gesamten Vorratsverlauf öffnen"
                onPress={() => setHistoryOpen(true)}
              />
            </View>

            {/* Toolbar mit dynamischen Lagerort-Tabs und Artikelsuchfeld */}
            {locationsLoading || locations.length === 0 ? null : (
              <View className="inventory-toolbar-row">
                <InventoryTabBar
                  activeTab={selectedLocationId}
                  onTabChange={setActiveLocationId}
                  locations={locations}
                />
                <InventorySearchField value={searchQuery} onChangeText={setSearchQuery} />
              </View>
            )}

            {/* Sortierleiste (nach Haltbarkeit / alphabetisch) */}
            {allItems.length > 0 ? (
              <View className="fridge-sort-row">
                <Txt
                  variant="caption"
                  tone="secondary"
                  weight="700"
                  className="uppercase tracking-[0.5px]">
                  {sortMode === 'expiry' ? 'Nach Haltbarkeit' : 'Alphabetisch'}
                </Txt>
                <Button
                  variant="link"
                  title="Sortieren"
                  accessibilityLabel={`Sortierung ändern, aktuell ${
                    sortMode === 'expiry' ? 'nach Haltbarkeit' : 'alphabetisch'
                  }`}
                  onPress={() =>
                    setSortMode((current) => (current === 'expiry' ? 'name' : 'expiry'))
                  }
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          /* Leerzustand bei leerem Lagerort oder erfolgloser Suche */
          isLoading ? null : visibleItems.length === 0 ? (
            <Card className="mt-two">
              <EmptyState
                symbol="archivebox"
                title={
                  deferredSearchQuery.trim()
                    ? `Keine Treffer für "${deferredSearchQuery.trim()}"`
                    : `${activeLocationName} ist leer`
                }
                hint={
                  deferredSearchQuery.trim()
                    ? 'Prüfe die Schreibweise oder setze die Suche zurück.'
                    : 'Schließe einen Einkauf ab oder füge Artikel manuell hinzu.'
                }
              />
            </Card>
          ) : null
        }
        renderItem={({ item }) => (
          /* Einzelne Artikelzeile mit MHD-Status und Mengensteuerung */
          <InventoryItemRow
            item={item}
            onPress={() => setDetailGroup(item)}
            onLongPress={() => setInformationItem(item.lots[0])}
            onRemove={() => handleGroupRemove(item)}
          />
        )}
      />

      {/* MHD-Sheet für die aggregierte Artikelgruppe */}
      <InventoryItemGroupSheet
        visible={!!detailGroup}
        group={detailGroup}
        onClose={() => setDetailGroup(null)}
        onHistory={() => {
          if (!detailGroup) return;
          setDetailGroup(null);
          setProductHistoryGroup(detailGroup);
        }}
        onSelectLot={(lot) => {
          setDetailGroup(null);
          setActionItem(lot);
        }}
      />

      {/* Aktions-Bottom-Sheet für ein konkretes MHD-Los */}
      <InventoryItemActionsSheet
        visible={!!currentActionItem}
        item={currentActionItem}
        onClose={() => setActionItem(null)}
        onQuantityChange={(value) =>
          currentActionItem && updateQuantity(currentActionItem, value - currentActionItem.quantity)
        }
        onEdit={() => currentActionItem && handleEdit(currentActionItem)}
        onConsume={() => currentActionItem && handleConsume(currentActionItem)}
        onOpen={() => currentActionItem && handleOpen(currentActionItem)}
        onWaste={() => currentActionItem && handleWaste(currentActionItem)}
        onRemove={() => currentActionItem && handleDeletePress(currentActionItem)}
        onExpiryChange={(expiryDate) => {
          if (!currentActionItem) return;
          updateItem.mutate({ ...currentActionItem, expiry_date: expiryDate || null });
        }}
      />

      {/* Detail-Modal für Produktinformationen & Nährwerte */}
      <ProductDetailModal
        visible={!!informationItem}
        item={informationItem}
        onClose={() => setInformationItem(null)}
      />

      <EditInventoryItemSheet
        visible={!!editItem}
        item={editItem}
        locations={locations}
        onClose={() => setEditItem(null)}
      />

      <OpenInventoryItemSheet
        visible={!!openItem}
        item={openItem}
        onClose={() => setOpenItem(null)}
        onConfirm={confirmOpen}
        loading={openMutation.isPending}
      />

      <WasteInventoryItemSheet
        visible={!!wasteItem}
        item={wasteItem}
        onClose={() => setWasteItem(null)}
        onConfirm={confirmWaste}
        loading={wasteMutation.isPending}
      />

      <InventoryHistorySheet
        visible={historyOpen}
        title="Verlauf"
        subtitle="Kühlschrank & Vorrat"
        transactions={transactions}
        onClose={() => setHistoryOpen(false)}
        onUndo={undoOpening}
      />

      <InventoryHistorySheet
        visible={!!productHistoryGroup}
        title={productHistoryGroup?.name ?? 'Produkt-Verlauf'}
        subtitle={productHistoryGroup ? `${productHistoryGroup.lots.length} Lose im Bestand` : ''}
        transactions={productHistoryTransactions}
        productSummary={
          productHistoryGroup
            ? {
                sealed: productHistoryGroup.lots
                  .filter((lot) => !lot.opened_at)
                  .reduce((sum, lot) => sum + lot.quantity, 0),
                opened: productHistoryGroup.lots
                  .filter((lot) => !!lot.opened_at)
                  .reduce((sum, lot) => sum + lot.quantity, 0),
                unit: productHistoryGroup.unit,
                sealedSubtitle: formatStateSubtitle(
                  productHistoryGroup.lots.filter((lot) => !lot.opened_at),
                ),
                openedSubtitle: formatStateSubtitle(
                  productHistoryGroup.lots.filter((lot) => !!lot.opened_at),
                ),
              }
            : undefined
        }
        historyHeading={productHistoryGroup ? `Verlauf zu ${productHistoryGroup.name}` : undefined}
        footerNote={
          productHistoryGroup && productHistoryTransactions.length === 1
            ? 'Nur ein Eintrag. Dieses Los wurde noch nicht geöffnet, verbraucht oder korrigiert.'
            : undefined
        }
        lotLabels={productHistoryLotLabels}
        onClose={() => setProductHistoryGroup(null)}
        onUndo={undoOpening}
        onOpenFullHistory={() => {
          setProductHistoryGroup(null);
          setHistoryOpen(true);
        }}
      />
    </Screen>
  );
}
