import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FamIcon } from '@/components/icons/fam-icon';
import { Screen } from '@/components/layout/screen';
import { space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, HeaderIconButton } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Txt } from '@/constants/ui';
import { useAdsEnabled, useInterstitialAd } from '@/features/ads';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { BarcodeScannerModal } from '@/features/inventory/barcode-scanner-modal';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileAvatar } from '@/features/navigation/use-profile-initials';
import { useProductBarcodeLookup } from '@/features/product-search/hooks/use-product-barcode-lookup';
import type { CatalogProduct } from '@/features/product-search/types';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { ShoppingItemRow } from '../components/ui/shopping-item-row';
import { ALL_FILTER, StorePickerMenu, UNASSIGNED_FILTER } from '../components/ui/store-picker-menu';
import { StoreSummaryCard } from '../components/ui/store-summary-card';
import { TotalEstimateCard } from '../components/ui/total-estimate-card';
import {
  colorForCategory,
  distinctCategoryColors,
  parseCategoryOrder,
} from '../domain-logik/shopping-categories';
import { useCompleteShoppingRun } from '../hooks/use-complete-shopping-run';
import {
  groupByCategory,
  type LocalShoppingItem,
  useShoppingList,
} from '../hooks/use-shopping-list';
import {
  useDeleteShoppingItem,
  useMoveShoppingItems,
  useToggleShoppingItem,
} from '../hooks/use-shopping-list-mutations';
import { useStores } from '../hooks/use-stores';
import { AddItemModal } from '../modals/add-item-modal';
import { EditItemModal } from '../modals/edit-item-modal';
import { MoveItemsModal } from '../modals/move-items-modal';
import { CategoryOrderSheet } from '../sheets/category-order-sheet';
import { CompleteRunSheet, type TransferItem } from '../sheets/complete-run-sheet';
import { ShoppingModeScreen } from './shopping-mode-screen';

export function ShoppingListScreen() {
  const params = useLocalSearchParams<{ action?: string }>();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [shoppingModeOpen, setShoppingModeOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<CatalogProduct | null>(null);
  const [editingItem, setEditingItem] = useState<LocalShoppingItem | null>(null);
  const [storeFilter, setStoreFilter] = useState<string>(ALL_FILTER);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => new Set());
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const pendingAdRef = useRef(false);
  const adsEnabled = useAdsEnabled();
  const interstitialAd = useInterstitialAd();
  const { colors: theme } = useTheme();
  const hubGradient = useHubGradient();
  const scrollRef = useRef<ScrollView>(null);
  const sectionListRef =
    useRef<SectionList<LocalShoppingItem, { title: string; data: LocalShoppingItem[] }>>(null);
  const { session } = useSession();
  const userId = session?.user.id;
  const { openDrawer, openProfile } = useNavigationChrome();
  const { initials, avatarUrl } = useProfileAvatar();
  const insets = useSafeAreaInsets();

  // Beim Wechsel des Markt-Filters (Karte oder Chip antippen) an den Anfang
  // scrollen, damit die Tab-Leiste und der Anfang der gefilterten Liste
  // sofort sichtbar sind, statt an der bisherigen Scroll-Position zu bleiben.
  useEffect(() => {
    if (storeFilter === ALL_FILTER) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      sectionListRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true });
    }
  }, [storeFilter]);

  // ?action=add (#150, globaler Plus-Button -> Schnellauswahl "Einkaufsartikel").
  // Als Effekt statt Initialwert: navigiert man von hier aus erneut auf
  // /shopping-list?action=add, bleibt der Screen gemountet — nur ein neuer
  // Parameter-Wert loest das Oeffnen dann zuverlaessig aus.
  useEffect(() => {
    if (params.action === 'add') setAddModalOpen(true);
  }, [params.action]);

  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;

  const { data: groups = [], isLoading } = useShoppingList(householdId);
  const { data: stores = [] } = useStores(householdId);

  const toggleItem = useToggleShoppingItem();
  const deleteItem = useDeleteShoppingItem();
  const moveItems = useMoveShoppingItems();
  const completeRun = useCompleteShoppingRun(householdId);

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const storeAggregates = useMemo(
    () =>
      stores
        .map((store) => {
          const items = allItems.filter((i) => i.store_id === store.id);
          const openItems = items.filter((i) => i.checked_at === null);
          return {
            store,
            totalCount: items.length,
            checkedCount: items.filter((i) => i.checked_at !== null).length,
            totalEstimate: items.reduce((sum, i) => sum + (i.price_estimate ?? 0), 0),
            openCategoryColors: distinctCategoryColors(openItems.map((i) => i.category)),
          };
        })
        .filter((agg) => agg.totalCount > 0),
    [stores, allItems],
  );

  const unassignedItems = useMemo(() => allItems.filter((i) => !i.store_id), [allItems]);

  const activeStore = stores.find((s) => s.id === storeFilter) ?? null;
  const isUnassignedFilter = storeFilter === UNASSIGNED_FILTER;
  const isAllFilter = storeFilter === ALL_FILTER;

  const filteredItems = useMemo(() => {
    if (isAllFilter) return allItems;
    if (isUnassignedFilter) return unassignedItems;
    return allItems.filter((i) => i.store_id === storeFilter);
  }, [isAllFilter, isUnassignedFilter, storeFilter, allItems, unassignedItems]);

  const checkedItems = filteredItems.filter((i) => i.checked_at !== null);
  const hasCheckedItems = checkedItems.length > 0 && !isAllFilter;
  const selectedItems = filteredItems.filter((item) => selectedItemIds.has(item.id));

  const totalEstimate = allItems.reduce((sum, i) => sum + (i.price_estimate ?? 0), 0);

  async function handleToggle(item: LocalShoppingItem) {
    await toggleItem.mutateAsync({
      id: item.id,
      household_id: item.household_id,
      checked_at: item.checked_at ? null : new Date().toISOString(),
      checked_by: item.checked_at ? null : (userId ?? null),
    });
  }

  function closeSelection() {
    setSelectionMode(false);
    setSelectedItemIds(new Set());
    setMoveModalOpen(false);
  }

  function handleFilterChange(nextFilter: string) {
    closeSelection();
    setStoreFilter(nextFilter);
  }

  function toggleSelectedItem(itemId: string) {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function selectAllVisibleItems() {
    setSelectedItemIds(new Set(filteredItems.map((item) => item.id)));
  }

  async function handleMoveItems(storeId: string | null) {
    if (!householdId || selectedItems.length === 0) return;

    await moveItems.mutateAsync({
      household_id: householdId,
      item_ids: selectedItems.map((item) => item.id),
      store_id: storeId,
    });
    closeSelection();
  }

  function handleDeletePress(item: LocalShoppingItem) {
    Alert.alert('Artikel löschen', `"${item.name}" aus der Liste entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => deleteItem.mutate({ id: item.id, household_id: item.household_id }),
      },
    ]);
  }

  async function handleCompleteRun(transfers: TransferItem[]) {
    if (!householdId) return;

    await completeRun.mutateAsync({
      householdId,
      userId: userId ?? null,
      checkedItems,
      transfers,
    });

    setSheetOpen(false);
  }

  const sections = groupByCategory(filteredItems, parseCategoryOrder(activeStore?.category_order))
    .filter((g) => g.items.length > 0)
    .map((g) => ({ title: g.category, data: g.items }));

  const chrome = { onMenuPress: openDrawer, onAvatarPress: openProfile, initials, avatarUrl };

  function handleProductScanned(product: CatalogProduct) {
    setScannedProduct(product);
    setScannerOpen(false);
    setAddModalOpen(true);
  }

  const barcodeLookup = useProductBarcodeLookup({ onFound: handleProductScanned });

  function closeScanner() {
    setScannerOpen(false);
    barcodeLookup.reset();
  }

  if (!householdId) {
    return (
      <Screen title="Einkaufsliste" subtitle="Gemeinsame Liste" chrome={chrome}>
        <Card>
          <EmptyState
            symbol="cart"
            title="Noch kein Haushalt"
            hint="Lege im Profil einen Haushalt an oder tritt einem bei."
          />
        </Card>
      </Screen>
    );
  }
  const completeActionColor = theme.basil;
  // const completeActionColor = isUnassignedFilter
  //   ? theme.textMuted
  //   : (activeStore?.color ?? theme.tomato);

  const completeActionLabel = activeStore
    ? `Einkaufsliste bei ${activeStore.name} abschließen`
    : 'Einkaufliste abschließen';

  const listContentPadding = { paddingBottom: insets.bottom + space.xxxl };

  const renderHeader = () => (
    <View className="gap-two">
      <View className="row-between">
        <StorePickerMenu
          activeFilter={storeFilter}
          onFilterChange={handleFilterChange}
          stores={stores}
          totalCount={allItems.length}
          unassignedCount={unassignedItems.length}
          countForStore={(storeId) => allItems.filter((i) => i.store_id === storeId).length}
        />
        <View className="flex-row items-center gap-one">
          <HeaderIconButton
            label="Barcode scannen"
            onPress={() => {
              setScannedProduct(null);
              setScannerOpen(true);
            }}>
            <FamIcon name="camera" size={20} color={theme.basil} />
          </HeaderIconButton>
          {!isAllFilter && filteredItems.length > 0 ? (
            <HeaderIconButton
              label={selectionMode ? 'Auswahl schließen' : 'Mehrfachauswahl starten'}
              onPress={selectionMode ? closeSelection : () => setSelectionMode(true)}>
              <Txt variant="heading" weight="700" tone="secondary">
                {selectionMode ? '✕' : '☑'}
              </Txt>
            </HeaderIconButton>
          ) : null}
        </View>
      </View>
      {selectionMode ? (
        <View className="gap-one">
          <Txt variant="body" weight="700" numberOfLines={1}>
            {selectedItems.length} {selectedItems.length === 1 ? 'Artikel' : 'Artikel'} ausgewählt
          </Txt>
          <View className="flex-row items-center justify-end gap-two">
            <Button
              size="compact"
              variant="link"
              label={selectedItems.length === filteredItems.length ? 'Keine' : 'Alle'}
              onPress={
                selectedItems.length === filteredItems.length
                  ? () => setSelectedItemIds(new Set())
                  : selectAllVisibleItems
              }
              accessibilityLabel={
                selectedItems.length === filteredItems.length
                  ? 'Auswahl aufheben'
                  : 'Alle Artikel auswählen'
              }
            />
            <Button
              size="compact"
              label="Verschieben"
              disabled={selectedItems.length === 0}
              onPress={() => setMoveModalOpen(true)}
            />
          </View>
        </View>
      ) : null}
      {adsEnabled ? (
        <Button
          size="compact"
          variant="secondary"
          label={`🎬 Test Werbung (${interstitialAd.isLoaded ? 'Bereit' : 'Wird geladen...'})`}
          onPress={() => {
            console.log('[TestAd] Button gedrückt, isLoaded:', interstitialAd.isLoaded);
            interstitialAd.show();
          }}
        />
      ) : null}
    </View>
  );

  const renderCompleteButton = () => {
    if (!hasCheckedItems) return null;
    return (
      <View className="mt-two">
        <Button
          size="compact"
          label={`🛒 ${completeActionLabel} (${checkedItems.length})`}
          onPress={() => setSheetOpen(true)}
          accessibilityLabel={`${completeActionLabel}, ${checkedItems.length} Artikel abgehakt`}
          backgroundColor={completeActionColor}
        />
      </View>
    );
  };

  const renderShoppingModeButton = () => {
    if (!activeStore) return null;
    return (
      <View className="mt-two">
        <Button
          size="compact"
          variant="secondary"
          label="🛒 Einkaufsmodus starten"
          onPress={() => setShoppingModeOpen(true)}
          accessibilityLabel={`Einkaufsmodus für ${activeStore.name} starten`}
        />
      </View>
    );
  };

  return (
    <Screen title="Einkaufsliste" scroll={false} chrome={chrome} backgroundGradient={hubGradient}>
      {isLoading ? null : isAllFilter ? (
        /* Gesamtübersicht: Zusammenfassung aller Märkte & Gesamtschätzung */
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="gap-three"
          contentContainerStyle={listContentPadding}>
          {renderHeader()}
          <View className="gap-three pt-two">
            {storeAggregates.map(
              ({
                store,
                totalCount,
                checkedCount,
                totalEstimate: storeTotal,
                openCategoryColors,
              }) => (
                <StoreSummaryCard
                  key={store.id}
                  name={store.name}
                  color={store.color}
                  totalCount={totalCount}
                  checkedCount={checkedCount}
                  totalEstimate={storeTotal}
                  openCategoryColors={openCategoryColors}
                  onPress={() => handleFilterChange(store.id)}
                />
              ),
            )}

            {/* Übersichtszeile für Artikel ohne Marktzuordnung */}
            <StoreSummaryCard
              name="Ohne Markt"
              color={theme.textMuted}
              totalCount={unassignedItems.length}
              checkedCount={unassignedItems.filter((i) => i.checked_at !== null).length}
              totalEstimate={unassignedItems.reduce((sum, i) => sum + (i.price_estimate ?? 0), 0)}
              openCategoryColors={distinctCategoryColors(
                unassignedItems.filter((i) => i.checked_at === null).map((i) => i.category),
              )}
              onPress={() => handleFilterChange(UNASSIGNED_FILTER)}
            />

            {allItems.length === 0 ? (
              <Card>
                <EmptyState
                  symbol="cart"
                  title="Einkaufsliste ist leer"
                  hint="Tippe auf '+' um zu starten."
                />
              </Card>
            ) : (
              /* Gesamtkosten-Schätzung über alle Märkte */
              <TotalEstimateCard
                totalEstimate={totalEstimate}
                itemCount={allItems.length}
                storeCount={storeAggregates.length}
              />
            )}
          </View>
          {renderCompleteButton()}
        </ScrollView>
      ) : (
        /* Marktspezifische Checkliste, nach Kategorien sortiert */
        <SectionList
          ref={sectionListRef}
          className="flex-1"
          contentContainerStyle={listContentPadding}
          showsVerticalScrollIndicator={false}
          sections={sections}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <>
              {renderHeader()}
              {/* Option zum Anpassen der Laufweg- / Kategorienreihenfolge */}
              {activeStore && (
                <Button
                  variant="link"
                  label="⠿ Reihenfolge bearbeiten"
                  onPress={() => setOrderSheetOpen(true)}
                  accessibilityLabel="Reihenfolge für diesen Markt bearbeiten"
                />
              )}
            </>
          }
          ListFooterComponent={
            <>
              {renderShoppingModeButton()}
              {renderCompleteButton()}
            </>
          }
          ListEmptyComponent={
            <View className="pt-three">
              <Card>
                <EmptyState
                  symbol="cart"
                  title={isUnassignedFilter ? 'Keine Artikel ohne Markt' : 'Einkaufsliste ist leer'}
                  hint="Tippe auf '+' um zu starten."
                />
              </Card>
            </View>
          }
          renderSectionHeader={({ section }) => {
            const color = colorForCategory(section.title) ?? theme.textMuted;
            return (
              <View className="flex-row items-center gap-[6px] px-three pt-three pb-one">
                <View className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: color }} />
                <Txt
                  variant="bodySmall"
                  tone="secondary"
                  className="uppercase tracking-wider"
                  weight="600">
                  {section.title}
                </Txt>
              </View>
            );
          }}
          renderItem={({ item }) => (
            /* Einzelne Einkaufsartikel-Zeile — Status-Anzeige, antippen
               öffnet Bearbeiten. Abhaken passiert nur im Einkaufsmodus. */
            <ShoppingItemRow
              item={item}
              onDelete={() => handleDeletePress(item)}
              onEdit={() => setEditingItem(item)}
              selectionMode={selectionMode}
              selected={selectedItemIds.has(item.id)}
              onSelect={() => toggleSelectedItem(item.id)}
            />
          )}
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* Modal zum Hinzufügen neuer Einkaufsartikel */}
      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={closeScanner}
        onBarcodeDetected={barcodeLookup.lookup}
        looking={barcodeLookup.looking}
        errorMessage={barcodeLookup.errorMessage}
      />

      <AddItemModal
        visible={addModalOpen}
        householdId={householdId}
        initialStoreId={activeStore?.id ?? null}
        initialProduct={scannedProduct}
        onDismiss={() => {
          pendingAdRef.current = false;
          setScannedProduct(null);
          setAddModalOpen(false);
        }}
        onItemAdded={() => {
          pendingAdRef.current = true;
          setScannedProduct(null);
          setAddModalOpen(false);
          if (process.env.NODE_ENV === 'test') {
            if (pendingAdRef.current) {
              pendingAdRef.current = false;
              interstitialAd.show();
            }
          } else {
            // Robuster Fallback-Timer: löst aus, falls natives onDismissFinished nicht feuert
            setTimeout(() => {
              if (pendingAdRef.current) {
                pendingAdRef.current = false;
                interstitialAd.show();
              }
            }, 800);
          }
        }}
        onDismissFinished={() => {
          if (pendingAdRef.current) {
            pendingAdRef.current = false;
            // Delay für das vollständige Entladen des iOS-View-Controllers.
            setTimeout(() => {
              interstitialAd.show();
            }, 250);
          }
        }}
      />

      {/* Bottom Sheet zum Abschließen des Einkaufs (Übertrag in Vorrat) */}
      <CompleteRunSheet
        isOpen={sheetOpen}
        checkedItems={checkedItems}
        onConfirm={handleCompleteRun}
        onClose={() => setSheetOpen(false)}
      />

      {/* Bottom Sheet zum Konfigurieren der Kategorien-Reihenfolge */}
      <CategoryOrderSheet
        isOpen={orderSheetOpen}
        store={activeStore}
        onClose={() => setOrderSheetOpen(false)}
      />

      {/* Modal zum Bearbeiten eines bestehenden Einkaufsartikels */}
      <EditItemModal item={editingItem} onDismiss={() => setEditingItem(null)} />

      <MoveItemsModal
        visible={moveModalOpen}
        selectedItems={selectedItems}
        stores={stores}
        onSelect={handleMoveItems}
        onClose={() => setMoveModalOpen(false)}
      />

      {/* Vollbild-Einkaufsmodus fuer diesen Markt (nur Abhaken, kein Bearbeiten) */}
      {activeStore && (
        <ShoppingModeScreen
          visible={shoppingModeOpen}
          store={activeStore}
          items={filteredItems}
          onToggle={handleToggle}
          onClose={() => setShoppingModeOpen(false)}
          onFinish={() => {
            setShoppingModeOpen(false);
            setSheetOpen(true);
          }}
        />
      )}
    </Screen>
  );
}
