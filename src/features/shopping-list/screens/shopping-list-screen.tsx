import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { FamIcon, PlusIcon } from '@/components/icons/fam-icon';
import { Screen } from '@/components/layout/screen';
import { space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { ContentCard } from '@/components/ui/content-card';
import { EmptyState } from '@/components/ui/empty-state';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { Button, Txt } from '@/constants/ui';
import { useAdsEnabled, useInterstitialAd } from '@/features/ads';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { BarcodeScannerModal } from '@/features/inventory/barcode-scanner-modal';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileAvatar } from '@/features/navigation/use-profile-initials';
import { ReceiptCaptureReviewFlow } from '@/features/ocr/processing/review/receipt-capture-review-flow';
import { useProductBarcodeLookup } from '@/features/product-search/hooks/use-product-barcode-lookup';
import type { CatalogProduct } from '@/features/product-search/types';
import { debugLog, debugLogEvent } from '@/lib/observability/debug-log';
import { ShoppingItemRow } from '../components/ui/shopping-item-row';
import { shoppingListStyles } from '../components/ui/shopping-list-styles';
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
import { useShowPriceInMarketView } from '../preferences/display-settings';
import { CategoryOrderSheet } from '../sheets/category-order-sheet';
import { CompleteRunSheet, type TransferItem } from '../sheets/complete-run-sheet';
import { NaturalLanguageAdditionController } from '../stt-beta/components/stt-controller';
import { ShoppingModeScreen } from './shopping-mode-screen';

const styles = StyleSheet.create((theme) => ({
  flex: {
    flex: 1,
  },
  header: {
    gap: theme.space.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  selection: {
    gap: theme.space.sm,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.space.md,
  },
  shoppingActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: theme.space.sm,
    marginTop: theme.space.xxl,
    paddingHorizontal: theme.space.md,
  },
  shoppingAction: {
    flex: 1,
    minWidth: 0,
  },
  headerAction: {
    width: theme.controlSizes.touchTarget,
    height: theme.controlSizes.touchTarget,
  },
  summaryScrollContent: {
    gap: theme.space.lg,
  },
  summaryGroups: {
    gap: theme.space.lg,
    paddingTop: theme.space.sm,
  },
  emptyState: {
    paddingTop: theme.space.xxxl,
  },
}));

export function ShoppingListScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ action?: string }>();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [shoppingModeOpen, setShoppingModeOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [receiptFlowOpen, setReceiptFlowOpen] = useState(false);
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
  const shoppingStyles = shoppingListStyles;
  const scrollRef = useRef<ScrollView>(null);
  const sectionListRef =
    useRef<SectionList<LocalShoppingItem, { title: string; data: LocalShoppingItem[] }>>(null);
  const { session, isLoading: sessionLoading, accountReady } = useSession();
  const userId = session?.user.id;
  const { data: showPriceInMarketView = false } = useShowPriceInMarketView(userId);
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

  useEffect(() => {
    debugLogEvent('shopping.receipt_capture.screen_state', {
      session_loading: sessionLoading,
      account_ready: Boolean(accountReady),
      has_user: Boolean(userId),
      has_household: Boolean(householdId),
      flow_open: receiptFlowOpen,
    });
  }, [accountReady, householdId, receiptFlowOpen, sessionLoading, userId]);

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
  const hasOpenItems = filteredItems.some((item) => item.checked_at === null);
  const canStartShoppingMode = activeStore !== null && hasOpenItems;

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
    Alert.alert(
      t('shoppingList.screen.deleteItemTitle'),
      t('shoppingList.screen.deleteItemBody', { name: item.name }),
      [
        { text: t('shoppingList.screen.cancel'), style: 'cancel' },
        {
          text: t('shoppingList.screen.delete'),
          style: 'destructive',
          onPress: () => deleteItem.mutate({ id: item.id, household_id: item.household_id }),
        },
      ],
    );
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
      <Screen
        title={t('shoppingList.screen.title')}
        subtitle={t('shoppingList.screen.subtitle')}
        chrome={chrome}>
        <ContentCard>
          <EmptyState
            symbol="cart"
            title={t('shoppingList.screen.noHousehold.title')}
            hint={t('shoppingList.screen.noHousehold.hint')}
          />
        </ContentCard>
      </Screen>
    );
  }
  const completeActionLabel = activeStore
    ? t('shoppingList.screen.completeAction', { store: activeStore.name })
    : t('shoppingList.screen.completeActionGeneric');

  const listContentPadding = { paddingBottom: insets.bottom + space.xxxl };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <StorePickerMenu
          activeFilter={storeFilter}
          onFilterChange={handleFilterChange}
          stores={stores}
          totalCount={allItems.length}
          unassignedCount={unassignedItems.length}
          countForStore={(storeId) => allItems.filter((i) => i.store_id === storeId).length}
        />
        <View style={styles.headerActions}>
          <HeaderIconButton
            label={t('shoppingList.screen.scanBarcode')}
            onPress={() => {
              setScannedProduct(null);
              setScannerOpen(true);
            }}
            style={styles.headerAction}>
            <FamIcon name="camera" size={20} color={theme.accent} />
          </HeaderIconButton>
          <HeaderIconButton
            label={t('shoppingList.screen.captureReceipt')}
            onPress={() => {
              debugLogEvent('shopping.receipt_capture.button_pressed', {
                session_loading: sessionLoading,
                account_ready: Boolean(accountReady),
                has_user: Boolean(userId),
                has_household: Boolean(householdId),
                flow_open: receiptFlowOpen,
              });
              if (userId) {
                setReceiptFlowOpen(true);
                debugLogEvent('shopping.receipt_capture.open_requested');
              } else {
                debugLogEvent('shopping.receipt_capture.open_blocked', {
                  reason: sessionLoading ? 'session_loading' : 'missing_user',
                });
              }
            }}
            style={styles.headerAction}>
            <FamIcon name="receipt" size={20} color={theme.accent} />
          </HeaderIconButton>
          <HeaderIconButton
            label={t('shoppingList.addItem')}
            onPress={() => setAddModalOpen(true)}
            style={styles.headerAction}>
            <PlusIcon size={space.xl} color={theme.accent} />
          </HeaderIconButton>
          {!isAllFilter && filteredItems.length > 0 ? (
            <HeaderIconButton
              label={
                selectionMode
                  ? t('shoppingList.screen.closeSelection')
                  : t('shoppingList.screen.startSelection')
              }
              onPress={selectionMode ? closeSelection : () => setSelectionMode(true)}
              style={styles.headerAction}>
              <Txt variant="heading" weight="700" tone="secondary">
                {selectionMode ? '✕' : '☑'}
              </Txt>
            </HeaderIconButton>
          ) : null}
        </View>
      </View>
      {selectionMode ? (
        <View style={styles.selection}>
          <Txt variant="body" weight="700" numberOfLines={1}>
            {t('shoppingList.screen.selectedCount', { count: selectedItems.length })}
          </Txt>
          <View style={styles.selectionActions}>
            <Button
              size="sm"
              variant="link"
              title={
                selectedItems.length === filteredItems.length
                  ? t('shoppingList.screen.selectNone')
                  : t('shoppingList.screen.selectAll')
              }
              onPress={
                selectedItems.length === filteredItems.length
                  ? () => setSelectedItemIds(new Set())
                  : selectAllVisibleItems
              }
              accessibilityLabel={
                selectedItems.length === filteredItems.length
                  ? t('shoppingList.screen.deselectAllAccessibility')
                  : t('shoppingList.screen.selectAllAccessibility')
              }
            />
            <Button
              size="sm"
              title={t('shoppingList.screen.move')}
              disabled={selectedItems.length === 0}
              onPress={() => setMoveModalOpen(true)}
            />
          </View>
        </View>
      ) : null}
      {adsEnabled ? (
        <Button
          size="sm"
          variant="secondary"
          title={t('shoppingList.screen.testAd', {
            status: interstitialAd.isLoaded
              ? t('shoppingList.screen.testAdReady')
              : t('shoppingList.screen.testAdLoading'),
          })}
          onPress={() => {
            debugLog('[TestAd] Button gedrückt, isLoaded:', interstitialAd.isLoaded);
            interstitialAd.show();
          }}
        />
      ) : null}
    </View>
  );

  const renderShoppingActions = () => {
    if (!activeStore) return null;

    return (
      <View style={styles.shoppingActions}>
        <Button
          full
          size="sm"
          variant="accent"
          accentKey="fiber"
          flat={false}
          title={t('shoppingList.screen.startShoppingMode')}
          disabled={!canStartShoppingMode}
          onPress={() => setShoppingModeOpen(true)}
          style={styles.shoppingAction}
          accessibilityLabel={t('shoppingList.screen.startShoppingModeAccessibility', {
            store: activeStore.name,
          })}
        />
        <Button
          full
          size="sm"
          variant="accent"
          accentKey="fiber"
          flat={false}
          title={t('shoppingList.screen.completeActionShort')}
          disabled={!hasCheckedItems}
          onPress={() => setSheetOpen(true)}
          style={styles.shoppingAction}
          accessibilityLabel={t('shoppingList.screen.completeAccessibility', {
            label: completeActionLabel,
            count: checkedItems.length,
          })}
        />
      </View>
    );
  };

  return (
    <Screen title={t('shoppingList.screen.title')} scroll={false} chrome={chrome}>
      {isLoading ? null : isAllFilter ? (
        /* Gesamtübersicht: Zusammenfassung aller Märkte & Gesamtschätzung */
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.summaryScrollContent, listContentPadding]}>
          {renderHeader()}
          <View style={styles.summaryGroups}>
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
              name={t('shoppingList.screen.unassignedStore')}
              color={theme.textSecondary}
              totalCount={unassignedItems.length}
              checkedCount={unassignedItems.filter((i) => i.checked_at !== null).length}
              totalEstimate={unassignedItems.reduce((sum, i) => sum + (i.price_estimate ?? 0), 0)}
              openCategoryColors={distinctCategoryColors(
                unassignedItems.filter((i) => i.checked_at === null).map((i) => i.category),
              )}
              onPress={() => handleFilterChange(UNASSIGNED_FILTER)}
            />

            {allItems.length === 0 ? (
              <ContentCard>
                <EmptyState
                  symbol="cart"
                  title={t('shoppingList.screen.empty.title')}
                  hint={t('shoppingList.screen.empty.hint')}
                  action={
                    <Button
                      title={t('shoppingList.addItem')}
                      onPress={() => setAddModalOpen(true)}
                    />
                  }
                />
              </ContentCard>
            ) : (
              /* Gesamtkosten-Schätzung über alle Märkte */
              <TotalEstimateCard
                totalEstimate={totalEstimate}
                itemCount={allItems.length}
                storeCount={storeAggregates.length}
              />
            )}
          </View>
        </ScrollView>
      ) : (
        /* Marktspezifische Checkliste, nach Kategorien sortiert */
        <SectionList
          ref={sectionListRef}
          style={styles.flex}
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
                  title={t('shoppingList.screen.editOrder')}
                  onPress={() => setOrderSheetOpen(true)}
                  accessibilityLabel={t('shoppingList.screen.editOrderAccessibility')}
                />
              )}
            </>
          }
          ListFooterComponent={renderShoppingActions()}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <ContentCard>
                <EmptyState
                  symbol="cart"
                  title={
                    isUnassignedFilter
                      ? t('shoppingList.screen.emptyUnassigned')
                      : t('shoppingList.screen.empty.title')
                  }
                  hint={t('shoppingList.screen.empty.hint')}
                  action={
                    <Button
                      title={t('shoppingList.addItem')}
                      onPress={() => setAddModalOpen(true)}
                    />
                  }
                />
              </ContentCard>
            </View>
          }
          renderSectionHeader={({ section }) => {
            const color = colorForCategory(section.title) ?? theme.textSecondary;
            return (
              <View style={shoppingStyles.categoryHeader}>
                <View style={[shoppingStyles.categoryDot, { backgroundColor: color }]} />
                <Txt variant="label" tone="primary" weight="700">
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
              showPrice={showPriceInMarketView}
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

      {userId ? (
        <ReceiptCaptureReviewFlow
          visible={receiptFlowOpen}
          householdId={householdId}
          createdBy={userId}
          onDismiss={() => setReceiptFlowOpen(false)}
        />
      ) : null}

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

      <NaturalLanguageAdditionController householdId={householdId} stores={stores} />

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
