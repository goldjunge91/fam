import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Layout } from '@/constants/layout';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileInitials } from '@/features/navigation/use-profile-initials';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { useTheme } from '@/hooks/use-theme';
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
import { useDeleteShoppingItem, useToggleShoppingItem } from '../hooks/use-shopping-list-mutations';
import { useStores } from '../hooks/use-stores';
import { AddItemModal } from '../modals/add-item-modal';
import { EditItemModal } from '../modals/edit-item-modal';
import { CategoryOrderSheet } from '../sheets/category-order-sheet';
import { CompleteRunSheet, type TransferItem } from '../sheets/complete-run-sheet';
import { ShoppingModeScreen } from './shopping-mode-screen';

/** Die Marktansicht bleibt als eigene SectionList auch bei langen Listen virtualisiert. */
export function ShoppingListScreen() {
  const params = useLocalSearchParams<{ action?: string }>();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [shoppingModeOpen, setShoppingModeOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LocalShoppingItem | null>(null);
  const [storeFilter, setStoreFilter] = useState<string>(ALL_FILTER);
  const theme = useTheme();
  const hubGradient = useHubGradient();
  const scrollRef = useRef<ScrollView>(null);
  const sectionListRef =
    useRef<SectionList<LocalShoppingItem, { title: string; data: LocalShoppingItem[] }>>(null);
  const { session } = useSession();
  const userId = session?.user.id;
  const { openDrawer, openProfile } = useNavigationChrome();
  const initials = useProfileInitials();
  const insets = useSafeAreaInsets();

  // Jeder Filter beginnt am Listenanfang statt an der Position des vorherigen Markts.
  useEffect(() => {
    if (storeFilter === ALL_FILTER) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      sectionListRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true });
    }
  }, [storeFilter]);

  // Der Screen bleibt gemountet; deshalb muss jede neue action den Dialog erneut oeffnen.
  useEffect(() => {
    if (params.action === 'add') setAddModalOpen(true);
  }, [params.action]);

  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;

  const { data: groups = [], isLoading } = useShoppingList(householdId);
  const { data: stores = [] } = useStores(householdId);

  const toggleItem = useToggleShoppingItem();
  const deleteItem = useDeleteShoppingItem();
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

  const totalEstimate = allItems.reduce((sum, i) => sum + (i.price_estimate ?? 0), 0);

  async function handleToggle(item: LocalShoppingItem) {
    await toggleItem.mutateAsync({
      id: item.id,
      household_id: item.household_id,
      checked_at: item.checked_at ? null : new Date().toISOString(),
      checked_by: item.checked_at ? null : (userId ?? null),
    });
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

  const chrome = { onMenuPress: openDrawer, onAvatarPress: openProfile, initials };

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

  const completeActionColor = isUnassignedFilter
    ? theme.textSecondary
    : (activeStore?.color ?? theme.danger);

  const completeActionLabel = activeStore
    ? `Einkaufsliste bei ${activeStore.name} abschließen`
    : 'Einkaufliste abschließen';

  const listContentPadding = { paddingBottom: insets.bottom + Layout.floatingActionClearance };

  const renderHeader = () => (
    <View className="row-between">
      <StorePickerMenu
        activeFilter={storeFilter}
        onFilterChange={setStoreFilter}
        stores={stores}
        totalCount={allItems.length}
        unassignedCount={unassignedItems.length}
        countForStore={(storeId) => allItems.filter((i) => i.store_id === storeId).length}
      />
      <Button size="compact" label="+ Artikel hinzufügen" onPress={() => setAddModalOpen(true)} />
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

  // Im Footer stoert der Einkaufsmodus nicht beim Zusammenstellen der Liste.
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
      {isLoading ? null : allItems.length === 0 ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-three"
          contentContainerStyle={listContentPadding}>
          {renderHeader()}
          <Card>
            <EmptyState
              symbol="cart"
              title="Einkaufsliste ist leer"
              hint="Tippe auf '+' um zu starten."
            />
          </Card>
        </ScrollView>
      ) : isAllFilter ? (
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
                  onPress={() => setStoreFilter(store.id)}
                />
              ),
            )}

            {unassignedItems.length > 0 && (
              <StoreSummaryCard
                name="Ohne Markt"
                color={theme.textSecondary}
                totalCount={unassignedItems.length}
                checkedCount={unassignedItems.filter((i) => i.checked_at !== null).length}
                totalEstimate={unassignedItems.reduce((sum, i) => sum + (i.price_estimate ?? 0), 0)}
                openCategoryColors={distinctCategoryColors(
                  unassignedItems.filter((i) => i.checked_at === null).map((i) => i.category),
                )}
                onPress={() => setStoreFilter(UNASSIGNED_FILTER)}
              />
            )}

            <TotalEstimateCard
              totalEstimate={totalEstimate}
              itemCount={allItems.length}
              storeCount={storeAggregates.length}
            />
          </View>
          {renderCompleteButton()}
        </ScrollView>
      ) : (
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
          renderSectionHeader={({ section }) => {
            const color = colorForCategory(section.title) ?? theme.textSecondary;
            return (
              <View className="flex-row items-center gap-[6px] px-three pt-three pb-one">
                <View className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: color }} />
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  className="uppercase tracking-wider text-body-small font-semibold">
                  {section.title}
                </ThemedText>
              </View>
            );
          }}
          renderItem={({ item }) => (
            <ShoppingItemRow
              item={item}
              onDelete={() => handleDeletePress(item)}
              onEdit={() => setEditingItem(item)}
            />
          )}
          stickySectionHeadersEnabled={false}
        />
      )}

      <AddItemModal
        visible={addModalOpen}
        householdId={householdId}
        initialStoreId={activeStore?.id ?? null}
        onDismiss={() => setAddModalOpen(false)}
      />

      <CompleteRunSheet
        isOpen={sheetOpen}
        checkedItems={checkedItems}
        onConfirm={handleCompleteRun}
        onClose={() => setSheetOpen(false)}
      />

      <CategoryOrderSheet
        isOpen={orderSheetOpen}
        store={activeStore}
        onClose={() => setOrderSheetOpen(false)}
      />

      <EditItemModal item={editingItem} onDismiss={() => setEditingItem(null)} />

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
