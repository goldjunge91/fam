import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Layout } from '@/constants/layout';
import { useInterstitialAd } from '@/features/ads';
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

/**
 * Gemeinsame Einkaufsliste (#85/#86), markt-gruppiert.
 *
 * "Alle Listen": eine Karte je Markt mit Fortschritt + geschätzter Summe.
 * Markt antippen (Karte oder Chip) filtert auf die bekannte kategorisierte
 * Checkliste dieses Markts, mit markt-farbigem "Einkauf abschließen"-Button.
 *
 * Die Marktansicht rendert als eigene, wirklich virtualisierte SectionList
 * statt einer nicht-scrollenden Liste innerhalb eines ScrollView — sonst
 * werden bei langen Listen alle Zeilen sofort gemountet.
 */
export function ShoppingListScreen() {
  const params = useLocalSearchParams<{ action?: string }>();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [shoppingModeOpen, setShoppingModeOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LocalShoppingItem | null>(null);
  const [storeFilter, setStoreFilter] = useState<string>(ALL_FILTER);
  const [pendingAdOnDismiss, setPendingAdOnDismiss] = useState(false);
  const interstitialAd = useInterstitialAd();
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
  const completeActionColor = theme.accent;
  // const completeActionColor = isUnassignedFilter
  //   ? theme.textSecondary
  //   : (activeStore?.color ?? theme.danger);

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

  /* Einstieg in den Einkaufsmodus — bewusst unten im Footer statt oben im
     Header, damit er dem Nutzer nicht im Weg steht, waehrend er die Liste
     noch zusammenstellt (Feedback: "einkaufsmodus starten soll nach unten"). */
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
            {/* Übersichtszeilen pro Markt (Anzahl, abgehakt, offene Kategorien, Preisschätzung) */}
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

            {/* Übersichtszeile für Artikel ohne Marktzuordnung */}
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
            /* Kategorie-Titel (z. B. Obst & Gemüse, Kühlung) — nur ein
               kleiner Farbpunkt zur Wiedererkennung, kein farbiges Band.
               Zurückhaltender als vorher: viele Kategorien nebeneinander
               mit vollem Farbband wirkten zu bunt und ließen den
               Abgehakt-Zustand (Accent-Farbe der Checkbox) untergehen. */
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
            /* Einzelne Einkaufsartikel-Zeile — Status-Anzeige, antippen
               öffnet Bearbeiten. Abhaken passiert nur im Einkaufsmodus. */
            <ShoppingItemRow
              item={item}
              onDelete={() => handleDeletePress(item)}
              onEdit={() => setEditingItem(item)}
            />
          )}
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* Modal zum Hinzufügen neuer Einkaufsartikel */}
      <AddItemModal
        visible={addModalOpen}
        householdId={householdId}
        initialStoreId={activeStore?.id ?? null}
        onDismiss={() => {
          setPendingAdOnDismiss(false);
          setAddModalOpen(false);
        }}
        onItemAdded={() => {
          setPendingAdOnDismiss(true);
          setAddModalOpen(false);
          // Auf Plattformen ohne natives onDismiss-Event (z.B. Android) Timeout-Fallback nutzen
          if (Platform.OS !== 'ios') {
            setTimeout(() => {
              interstitialAd.show();
            }, 400);
          }
        }}
        onDismissFinished={() => {
          if (pendingAdOnDismiss) {
            setPendingAdOnDismiss(false);
            // Kleiner Delay stellt sicher, dass iOS UIKit den View-Controller vollständig entladen hat
            setTimeout(() => {
              interstitialAd.show();
            }, 100);
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
