import { useLocalSearchParams } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Layout, Spacing } from '@/constants/layout';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { ProductDetailModal } from '@/features/inventory/product-detail-modal';
import { useStorageLocations } from '@/features/inventory/use-storage-locations';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileInitials } from '@/features/navigation/use-profile-initials';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { EditInventoryItemSheet } from './components/edit-inventory-item-sheet';
import { InventoryItemActionsSheet } from './components/inventory-item-actions-sheet';
import { InventoryItemRow } from './components/inventory-item-row';
import { InventorySearchField } from './components/inventory-search-field';
import { InventorySummaryCard } from './components/inventory-summary-card';
import { InventoryTabBar } from './components/inventory-tab-bar';
import { compareByExpiry, getExpiryInfo } from './expiry';
import { type LocalInventoryItem, useInventoryItems } from './use-inventory-items';
import { useUpdateInventoryItemQuantityMutation } from './use-inventory-mutations';

/**
 * Vorrat-Bestand, dynamisch gefiltert nach Lagerort (#67).
 *
 * - Dynamische Tab-Filter basierend auf den Lagerorten aus den Einstellungen
 * - Farbiger linker Rand als MHD-Ampel (#71, expiry.ts)
 * - Grosszuegige Zusammenfassung mit kompakter Arbeitsliste
 * - Vertikaler MHD-Indikator ohne dekorative Produktkacheln
 * - Kurzer Tap = Aktionen, langer Tap = Produktinformationen
 * - Eine einzige virtualisierte FlatList (Summary/Tabs/Sortierzeile als
 *   ListHeaderComponent) statt verschachtelter Listen, damit lange
 *   Bestände nicht komplett gerendert werden.
 */
type SortMode = 'expiry' | 'name';

export function InventoryScreen() {
  const hubGradient = useHubGradient();
  const { openDrawer, openProfile } = useNavigationChrome();
  const initials = useProfileInitials();
  const params = useLocalSearchParams<{ filter?: string }>();
  const showExpiringOnly = params.filter === 'expiring';
  const [activeLocationId, setActiveLocationId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('expiry');
  const [actionItem, setActionItem] = useState<LocalInventoryItem | null>(null);
  const [informationItem, setInformationItem] = useState<LocalInventoryItem | null>(null);
  const [editItem, setEditItem] = useState<LocalInventoryItem | null>(null);

  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;

  const { data: locations = [], isLoading: locationsLoading } = useStorageLocations(householdId);
  const { data: allItems = [], isLoading } = useInventoryItems(householdId);
  const updateQty = useUpdateInventoryItemQuantityMutation();

  const today = new Date();
  const expiryCounts = allItems.reduce(
    (counts, item) => {
      const bucket = getExpiryInfo(item.expiry_date, today).bucket;
      if (bucket === 'expired' || bucket === 'critical') counts.critical += 1;
      if (bucket === 'soon') counts.soon += 1;
      return counts;
    },
    { critical: 0, soon: 0 },
  );

  const { bottom } = useSafeAreaInsets();
  const paddingBottom = Math.max(bottom, Spacing.four) + Layout.floatingActionClearance;

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
  const visibleItems = useMemo(() => {
    let result = allItems;
    if (selectedLocationId !== 'all') {
      result = result.filter((item) => item.location_id === selectedLocationId);
    }
    if (showExpiringOnly) {
      result = result.filter((item) =>
        ['expired', 'critical'].includes(getExpiryInfo(item.expiry_date, today).bucket),
      );
    }
    const q = deferredSearchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((item) => item.name.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) =>
      sortMode === 'name'
        ? a.name.localeCompare(b.name, 'de')
        : compareByExpiry(getExpiryInfo(a.expiry_date, today), getExpiryInfo(b.expiry_date, today)),
    );
  }, [allItems, selectedLocationId, showExpiringOnly, deferredSearchQuery, sortMode, today]);
  const currentActionItem = actionItem
    ? (allItems.find((item) => item.id === actionItem.id) ?? actionItem)
    : null;

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

  const chrome = { onMenuPress: openDrawer, onAvatarPress: openProfile, initials };

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
      {/* Virtuelle Vorratsliste mit Header, Filtern und MHD-Einträgen */}
      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom }}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        ListHeaderComponent={
          <View className="gap-three pb-two">
            {/* Vorrats-Statistik: Gesamtanzahl & kritische/bald ablaufende Artikel */}
            <InventorySummaryCard
              totalCount={allItems.length}
              criticalCount={expiryCounts.critical}
              soonCount={expiryCounts.soon}
            />

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
                <ThemedText
                  type="captionCompact"
                  themeColor="textSecondary"
                  className="uppercase tracking-[0.5px] font-bold">
                  {sortMode === 'expiry' ? 'Nach Haltbarkeit' : 'Alphabetisch'}
                </ThemedText>
                <Button
                  variant="link"
                  label="Sortieren"
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
            onPress={() => setActionItem(item)}
            onLongPress={() => setInformationItem(item)}
            onRemove={() => handleDeletePress(item)}
          />
        )}
      />

      {/* Aktions-Bottom-Sheet für schnelles Verbrauchen, Ändern und Löschen */}
      <InventoryItemActionsSheet
        visible={!!currentActionItem}
        item={currentActionItem}
        onClose={() => setActionItem(null)}
        onQuantityChange={(value) =>
          currentActionItem && updateQuantity(currentActionItem, value - currentActionItem.quantity)
        }
        onEdit={() => currentActionItem && handleEdit(currentActionItem)}
        onConsume={() => currentActionItem && handleConsume(currentActionItem)}
        onRemove={() => currentActionItem && handleDeletePress(currentActionItem)}
        onProductInformation={() => {
          setInformationItem(currentActionItem);
          setActionItem(null);
        }}
      />

      {/* Detail-Modal für Produktinformationen & Nährwerte */}
      <ProductDetailModal
        visible={!!informationItem}
        item={informationItem}
        onClose={() => setInformationItem(null)}
      />

      {/* Bearbeitungs-Sheet für Name, Lagerort, Menge und Mindesthaltbarkeitsdatum */}
      <EditInventoryItemSheet
        visible={!!editItem}
        item={editItem}
        locations={locations}
        onClose={() => setEditItem(null)}
      />
    </Screen>
  );
}
