import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { Layout, Spacing } from '@/constants/layout';
import { withAlpha } from '@/constants/theme';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { ProductDetailModal } from '@/features/inventory/product-detail-modal';
import { useStorageLocations } from '@/features/inventory/use-storage-locations';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileInitials } from '@/features/navigation/use-profile-initials';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { useTheme } from '@/hooks/use-theme';
import { EditInventoryItemSheet } from './components/edit-inventory-item-sheet';
import { InventoryItemActionsSheet } from './components/inventory-item-actions-sheet';
import { InventoryItemRow } from './components/inventory-item-row';
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
  const theme = useTheme();
  const hubGradient = useHubGradient();
  const { openDrawer, openProfile } = useNavigationChrome();
  const initials = useProfileInitials();
  const params = useLocalSearchParams<{ filter?: string }>();
  const showExpiringOnly = params.filter === 'expiring';
  const [activeLocationId, setActiveLocationId] = useState('all');
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

  // filter=expiring (#73, vom Dashboard-Widget) ueberschreibt den
  // Lagerort-Tab-Filter, statt ihn zu kombinieren — einfacher, und die
  // Tab-Auswahl bleibt fuer den naechsten Besuch ohne den Query-Param erhalten.
  const selectedLocationId =
    activeLocationId === 'all' || locations.some((location) => location.id === activeLocationId)
      ? activeLocationId
      : 'all';
  const locationFiltered =
    selectedLocationId !== 'all'
      ? allItems.filter((item) => item.location_id === selectedLocationId)
      : allItems;
  const baseItems = showExpiringOnly
    ? allItems.filter((item) =>
        ['expired', 'critical'].includes(getExpiryInfo(item.expiry_date, today).bucket),
      )
    : locationFiltered;

  // SQL liefert bereits MHD-sortiert (default) — der Toggle sortiert nur
  // client-seitig um, keine Requery noetig fuer "Name" (#71).
  const visibleItems = [...baseItems].sort((a, b) =>
    sortMode === 'name'
      ? a.name.localeCompare(b.name, 'de')
      : compareByExpiry(getExpiryInfo(a.expiry_date, today), getExpiryInfo(b.expiry_date, today)),
  );
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
      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        className="fridge-list-card"
        // boxShadow ist eine dynamische Opazitaet, hat keine
        // Tailwind-Entsprechung.
        style={{
          flex: 1,
          boxShadow: `0 8px 24px ${withAlpha(theme.shadowCard, 0.08)}`,
        }}
        contentContainerStyle={{ paddingBottom }}
        ListHeaderComponent={
          <>
            <InventorySummaryCard
              totalCount={allItems.length}
              criticalCount={expiryCounts.critical}
              soonCount={expiryCounts.soon}
            />

            {/* Dynamische Lagerort-Auswahl aus den Haushaltseinstellungen. */}
            {locationsLoading || locations.length === 0 ? null : (
              <InventoryTabBar
                activeTab={selectedLocationId}
                onTabChange={setActiveLocationId}
                locations={locations}
              />
            )}

            {/* Kompakter Arbeitslisten-Kopf, #71 */}
            {allItems.length > 0 ? (
              <View className="fridge-sort-row">
                <ThemedText type="small" themeColor="textSecondary">
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
          </>
        }
        ListEmptyComponent={
          isLoading ? null : visibleItems.length === 0 ? (
            <Card className="mt-two">
              <EmptyState
                symbol="archivebox"
                title={`${activeLocationName} ist leer`}
                hint="Schließe einen Einkauf ab oder füge Artikel manuell hinzu."
              />
            </Card>
          ) : null
        }
        renderItem={({ item }) => (
          <InventoryItemRow
            item={item}
            onPress={() => setActionItem(item)}
            onLongPress={() => setInformationItem(item)}
            onRemove={() => handleDeletePress(item)}
          />
        )}
      />

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
    </Screen>
  );
}
