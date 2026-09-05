import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HistoryIcon, SearchIcon } from '@/components/icons/fam-icon';
import { Screen } from '@/components/layout/screen';
import { space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Divider, Txt } from '@/constants/ui';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { ProductDetailModal } from '@/features/inventory/product-detail-modal';
import { useStorageLocations } from '@/features/inventory/use-storage-locations';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileAvatar } from '@/features/navigation/use-profile-initials';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { EditInventoryItemSheet } from './components/edit-inventory-item-sheet';
import { InventoryHistorySheet } from './components/inventory-history-sheet';
import { InventoryIconButton } from './components/inventory-icon-button';
import { InventoryItemActionsSheet } from './components/inventory-item-actions-sheet';
import {
  formatStateSubtitle,
  InventoryItemGroupSheet,
} from './components/inventory-item-group-sheet';
import { InventoryItemRow } from './components/inventory-item-row';
import { InventorySearchInput } from './components/inventory-search-field';
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
  const { colors } = useTheme();
  const hubGradient = useHubGradient();
  const { openDrawer, openProfile } = useNavigationChrome();
  const { initials, avatarUrl } = useProfileAvatar();
  const params = useLocalSearchParams<{ filter?: string }>();
  const showExpiringOnly = params.filter === 'expiring';
  const [activeLocationId, setActiveLocationId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortMode, setSortMode] = useState<InventorySortMode>('expiry');
  const [actionItem, setActionItem] = useState<LocalInventoryItem | null>(null);
  const [detailGroupId, setDetailGroupId] = useState<string | null>(null);
  const [actionReturnGroupId, setActionReturnGroupId] = useState<string | null>(null);
  const [informationItem, setInformationItem] = useState<LocalInventoryItem | null>(null);
  const [editItem, setEditItem] = useState<LocalInventoryItem | null>(null);
  const [openItem, setOpenItem] = useState<LocalInventoryItem | null>(null);
  const [wasteItem, setWasteItem] = useState<LocalInventoryItem | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [productHistoryGroup, setProductHistoryGroup] = useState<InventoryItemGroup | null>(null);
  const [productHistoryReturnGroupId, setProductHistoryReturnGroupId] = useState<string | null>(null);

  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;

  const { data: locations = [] } = useStorageLocations(householdId);
  const { data: allItems = [], isLoading } = useInventoryItems(householdId);
  const { data: transactions = [] } = useInventoryTransactions(householdId);
  const updateQty = useUpdateInventoryItemQuantityMutation();
  const updateItem = useUpdateFridgeItemMutation();
  const openMutation = useOpenInventoryItemMutation();
  const undoMutation = useUndoOpenTransactionMutation();
  const wasteMutation = useWasteInventoryItemMutation();

  const today = new Date();
  const allGroups = useMemo(() => groupInventoryItems(allItems, today), [allItems, today]);
  const detailGroup = useMemo(
    () => allGroups.find((group) => group.id === detailGroupId) ?? null,
    [allGroups, detailGroupId],
  );
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
  // Der globale + Button liegt als Overlay in einer 88pt hohen Aktionszone.
  // Die letzte Zeile muss vollständig darüber hinausscrollen können.
  const paddingBottom = Math.max(bottom, space.xxl) + space.xxxl + 88;

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
    if (!householdId) return;
    const returnGroupId = actionReturnGroupId;
    updateQty.mutate(
      { id: item.id, household_id: householdId, delta: -item.quantity },
      {
        onSuccess: () => {
          setActionItem(null);
          setActionReturnGroupId(null);
          if (returnGroupId) setDetailGroupId(returnGroupId);
        },
      },
    );
  }

  function handleOpen(item: LocalInventoryItem) {
    setActionItem(null);
    setOpenItem(item);
  }

  function handleWaste(item: LocalInventoryItem) {
    setActionItem(null);
    setWasteItem(item);
  }

  function closeOpenItem() {
    if (openItem) setActionItem(openItem);
    setOpenItem(null);
  }

  function closeWasteItem() {
    if (wasteItem) setActionItem(wasteItem);
    setWasteItem(null);
  }

  function closeEditItem() {
    if (editItem) setActionItem(editItem);
    setEditItem(null);
  }

  function confirmOpen(quantity: number) {
    if (!openItem) return;
    const returnGroupId = actionReturnGroupId;
    openMutation.mutate(
      { item: openItem, quantity },
      {
        onSuccess: () => {
          setOpenItem(null);
          setActionReturnGroupId(null);
          if (returnGroupId) setDetailGroupId(returnGroupId);
        },
      },
    );
  }

  function confirmWaste(reason: WasteReason) {
    if (!wasteItem) return;
    const returnGroupId = actionReturnGroupId;
    wasteMutation.mutate(
      { item: wasteItem, reason },
      {
        onSuccess: () => {
          setWasteItem(null);
          setActionReturnGroupId(null);
          if (returnGroupId) setDetailGroupId(returnGroupId);
        },
      },
    );
  }

  function quickOpen(item: LocalInventoryItem) {
    openMutation.mutate({ item, quantity: 1 });
  }

  function quickConsume(item: LocalInventoryItem) {
    if (!householdId) return;
    updateQty.mutate({ id: item.id, household_id: householdId, delta: -1 });
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
    setDetailGroupId(group.id);
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
      {/* Der Steuerbereich bleibt stehen, während nur die Artikel darunter scrollen. */}
      <View className="pb-two">
        {/* Vorrats-Statistik: Gesamtanzahl & kritische/bald ablaufende Artikel */}
        <InventorySummaryCard
          totalCount={allGroups.length}
          criticalCount={expiryCounts.critical}
          soonCount={expiryCounts.soon}
        />

        {/* Lagerort, Suche und Verlauf folgen direkt unter den Statuskarten. */}
        <View className="mt-four flex-row items-center justify-between">
          <InventoryTabBar
            activeTab={selectedLocationId}
            onTabChange={setActiveLocationId}
            locations={locations}
          />
          <View className="flex-row items-center gap-two">
            <InventoryIconButton
              label="Artikel suchen"
              active={searchOpen}
              onPress={() => setSearchOpen((open) => !open)}>
              <SearchIcon color={colors.text} />
            </InventoryIconButton>
            <InventoryIconButton
              label="Gesamten Vorratsverlauf öffnen"
              onPress={() => setHistoryOpen(true)}>
              <HistoryIcon color={colors.text} />
            </InventoryIconButton>
          </View>
        </View>

        {searchOpen ? (
          <InventorySearchInput value={searchQuery} onChangeText={setSearchQuery} />
        ) : null}

        {/* Sortierleiste (nach Haltbarkeit / alphabetisch) */}
        {allItems.length > 0 ? (
          <View className="mt-five px-one">
            <View className="flex-row items-center justify-between">
              <Txt
                variant="label"
                tone="secondary"
                weight="700"
                className="uppercase tracking-[1px]">
                {sortMode === 'expiry' ? 'Nach Haltbarkeit' : 'Alphabetisch'}
              </Txt>
              <Button
                variant="link"
                label="Sortieren"
                accessibilityLabel={`Sortierung ändern, aktuell ${
                  sortMode === 'expiry' ? 'nach Haltbarkeit' : 'alphabetisch'
                }`}
                onPress={() => setSortMode((current) => (current === 'expiry' ? 'name' : 'expiry'))}
              />
            </View>
            <Divider style={{ backgroundColor: withAlpha(colors.textSecondary, 0.35) }} />
          </View>
        ) : null}
      </View>

      {/* FlashList füllt den verbleibenden Platz; nur die Artikelzeilen scrollen. */}
      <FlashList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom }}
        bounces={false}
        alwaysBounceVertical={false}
        ListEmptyComponent={
          /* Leerzustand bei leerem Lagerort oder erfolgloser Suche */
          isLoading ? null : visibleItems.length === 0 ? (
            <View className="items-center gap-two py-four">
              <Txt>
                {deferredSearchQuery.trim()
                  ? `Keine Treffer für "${deferredSearchQuery.trim()}"`
                  : allItems.length === 0
                    ? 'Noch keine Artikel hinzugefügt'
                    : `${activeLocationName} ist leer`}
              </Txt>
              <Txt>
                {deferredSearchQuery.trim()
                  ? 'Prüfe die Schreibweise oder setze die Suche zurück.'
                  : allItems.length === 0
                    ? 'Klicke auf +, um deinen ersten Artikel hinzuzufügen.'
                    : 'Schließe einen Einkauf ab oder füge Artikel manuell hinzu.'}
              </Txt>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          /* Einzelne Artikelzeile mit MHD-Status und Mengensteuerung */
          <InventoryItemRow
            item={item}
            onPress={() => setDetailGroupId(item.id)}
            onLongPress={() => setInformationItem(item.lots[0])}
            onRemove={() => handleGroupRemove(item)}
          />
        )}
      />

      {/* MHD-Sheet für die aggregierte Artikelgruppe */}
      <InventoryItemGroupSheet
        visible={!!detailGroup}
        group={detailGroup}
        onClose={() => setDetailGroupId(null)}
        backgroundGradient={hubGradient}
        quickActionLoading={openMutation.isPending || updateQty.isPending}
        onQuickOpen={quickOpen}
        onQuickConsume={quickConsume}
        onHistory={() => {
          if (!detailGroup) return;
          setDetailGroupId(null);
          setProductHistoryGroup(detailGroup);
          setProductHistoryReturnGroupId(detailGroup.id);
        }}
        onSelectLot={(lot) => {
          if (!detailGroup) return;
          setDetailGroupId(null);
          setActionReturnGroupId(detailGroup.id);
          setActionItem(lot);
        }}
      />

      {/* Aktions-Bottom-Sheet für ein konkretes MHD-Los */}
      <InventoryItemActionsSheet
        visible={!!currentActionItem}
        item={currentActionItem}
        onClose={() => {
          setActionItem(null);
          if (actionReturnGroupId) setDetailGroupId(actionReturnGroupId);
          setActionReturnGroupId(null);
        }}
        onQuantityChange={(value) =>
          currentActionItem && updateQuantity(currentActionItem, value - currentActionItem.quantity)
        }
        onEdit={() => currentActionItem && handleEdit(currentActionItem)}
        onConsume={() => currentActionItem && handleConsume(currentActionItem)}
        onOpen={() => currentActionItem && handleOpen(currentActionItem)}
        onWaste={() => currentActionItem && handleWaste(currentActionItem)}
        backgroundGradient={hubGradient}
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
        onClose={closeEditItem}
      />

      <OpenInventoryItemSheet
        visible={!!openItem}
        item={openItem}
        onClose={closeOpenItem}
        onConfirm={confirmOpen}
        loading={openMutation.isPending}
      />

      <WasteInventoryItemSheet
        visible={!!wasteItem}
        item={wasteItem}
        onClose={closeWasteItem}
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
        onClose={() => {
          setProductHistoryGroup(null);
          if (productHistoryReturnGroupId) setDetailGroupId(productHistoryReturnGroupId);
          setProductHistoryReturnGroupId(null);
        }}
        onUndo={undoOpening}
        onOpenFullHistory={() => {
          setProductHistoryGroup(null);
          setProductHistoryReturnGroupId(null);
          setHistoryOpen(true);
        }}
      />
    </Screen>
  );
}
