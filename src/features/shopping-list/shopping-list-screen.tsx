import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, SectionList, View } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useHouseholdMembers } from '@/features/household/api';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileInitials } from '@/features/navigation/use-profile-initials';
import { useTheme } from '@/hooks/use-theme';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { getLastSyncInfo } from '@/lib/sync/sync-runner';
import { CompleteRunSheet, type TransferItem } from './complete-run-sheet';
import { AddItemModal } from './components/add-item-modal';
import { CategoryOrderSheet } from './components/category-order-sheet';
import { EditItemModal } from './components/edit-item-modal';
import { ShoppingItemRow } from './components/shopping-item-row';
import { ALL_FILTER, StoreFilterBar, UNASSIGNED_FILTER } from './components/store-filter-bar';
import { StoreSummaryCard } from './components/store-summary-card';
import { TotalEstimateCard } from './components/total-estimate-card';
import { parseCategoryOrder } from './shopping-categories';
import { useCompleteShoppingRun } from './use-complete-shopping-run';
import { groupByCategory, type LocalShoppingItem, useShoppingList } from './use-shopping-list';
import { useDeleteShoppingItem, useToggleShoppingItem } from './use-shopping-list-mutations';
import { useStores } from './use-stores';

const UNASSIGNED_COLOR = '#8E8E93';

/**
 * Gemeinsame Einkaufsliste (#85/#86), markt-gruppiert.
 *
 * "Alle Listen": eine Karte je Markt mit Fortschritt + geschätzter Summe.
 * Markt antippen (Karte oder Chip) filtert auf die bekannte kategorisierte
 * Checkliste dieses Markts, mit markt-farbigem "Einkauf abschließen"-Button.
 */
export function ShoppingListScreen() {
  const params = useLocalSearchParams<{ action?: string }>();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LocalShoppingItem | null>(null);
  const [storeFilter, setStoreFilter] = useState<string>(ALL_FILTER);
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const { session } = useSession();
  const userId = session?.user.id;
  const { openDrawer, openProfile } = useNavigationChrome();
  const initials = useProfileInitials();

  // Beim Wechsel des Markt-Filters (Karte oder Chip antippen) an den Anfang
  // scrollen, damit die Tab-Leiste und der Anfang der gefilterten Liste
  // sofort sichtbar sind, statt an der bisherigen Scroll-Position zu bleiben.
  // biome-ignore lint/correctness/useExhaustiveDependencies: storeFilter ist der Trigger, wird im Body nicht gelesen.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
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
  const { data: members = [] } = useHouseholdMembers(activeHouseholdId ?? '');

  const toggleItem = useToggleShoppingItem();
  const deleteItem = useDeleteShoppingItem();
  const completeRun = useCompleteShoppingRun(householdId);

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const storeAggregates = useMemo(
    () =>
      stores
        .map((store) => {
          const items = allItems.filter((i) => i.store_id === store.id);
          return {
            store,
            totalCount: items.length,
            checkedCount: items.filter((i) => i.checked_at !== null).length,
            totalEstimate: items.reduce((sum, i) => sum + (i.price_estimate ?? 0), 0),
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
  const lastSyncTimestamp = getLastSyncInfo()?.timestamp;

  const subtitleParts = [
    lastSyncTimestamp
      ? `Zuletzt aktualisiert: ${formatRelativeTime(lastSyncTimestamp)}`
      : 'Noch nicht synchronisiert',
    `${members.length} ${members.length === 1 ? 'Mitglied' : 'Mitglieder'}`,
  ];

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
      <Screen title="Einkauf" subtitle="Gemeinsame Liste" chrome={chrome}>
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
    ? UNASSIGNED_COLOR
    : (activeStore?.color ?? theme.danger);
  const completeActionLabel = activeStore
    ? `Einkauf bei ${activeStore.name} abschließen`
    : 'Einkauf abschließen';

  return (
    <Screen title="Einkauf" subtitle={subtitleParts.join(' · ')} scroll={false} chrome={chrome}>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-three pb-four">
        <View className="row-between">
          <ThemedText type="smallMuted">
            {isAllFilter
              ? 'Deine Einkaufslisten'
              : isUnassignedFilter
                ? 'Ohne Markt'
                : (activeStore?.name ?? 'Einkaufsliste')}
          </ThemedText>
          <Button label="+ Artikel hinzufügen" onPress={() => setAddModalOpen(true)} />
        </View>

        {isLoading ? null : allItems.length === 0 ? (
          <Card>
            <EmptyState
              symbol="cart"
              title="Einkaufsliste ist leer"
              hint="Tippe auf '+' um zu starten."
            />
          </Card>
        ) : (
          <>
            <StoreFilterBar
              activeFilter={storeFilter}
              onFilterChange={setStoreFilter}
              stores={stores}
              totalCount={allItems.length}
              unassignedCount={unassignedItems.length}
              countForStore={(storeId) => allItems.filter((i) => i.store_id === storeId).length}
            />

            {isAllFilter ? (
              <View className="gap-three pt-two">
                {storeAggregates.map(
                  ({ store, totalCount, checkedCount, totalEstimate: storeTotal }) => (
                    <StoreSummaryCard
                      key={store.id}
                      name={store.name}
                      color={store.color}
                      totalCount={totalCount}
                      checkedCount={checkedCount}
                      totalEstimate={storeTotal}
                      onPress={() => setStoreFilter(store.id)}
                    />
                  ),
                )}

                {unassignedItems.length > 0 && (
                  <StoreSummaryCard
                    name="Ohne Markt"
                    color={UNASSIGNED_COLOR}
                    totalCount={unassignedItems.length}
                    checkedCount={unassignedItems.filter((i) => i.checked_at !== null).length}
                    totalEstimate={unassignedItems.reduce(
                      (sum, i) => sum + (i.price_estimate ?? 0),
                      0,
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
            ) : (
              <>
                {activeStore && (
                  <Button
                    variant="link"
                    label="⠿ Reihenfolge bearbeiten"
                    onPress={() => setOrderSheetOpen(true)}
                    accessibilityLabel="Reihenfolge für diesen Markt bearbeiten"
                  />
                )}
                <SectionList
                  sections={sections}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  renderSectionHeader={({ section }) => (
                    <ThemedText type="small" className="shopping-section-header">
                      {section.title}
                    </ThemedText>
                  )}
                  renderItem={({ item }) => (
                    <ShoppingItemRow
                      item={item}
                      onToggle={() => handleToggle(item)}
                      onDelete={() => handleDeletePress(item)}
                      onEdit={() => setEditingItem(item)}
                    />
                  )}
                  stickySectionHeadersEnabled={false}
                />
              </>
            )}
          </>
        )}

        {hasCheckedItems ? (
          <View className="mt-two">
            <Button
              size="large"
              label={`🛒 ${completeActionLabel} (${checkedItems.length})`}
              onPress={() => setSheetOpen(true)}
              accessibilityLabel={`${completeActionLabel}, ${checkedItems.length} Artikel abgehakt`}
              backgroundColor={completeActionColor}
            />
          </View>
        ) : null}
      </ScrollView>

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
    </Screen>
  );
}
