import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { ProductDetailModal } from '@/features/inventory/product-detail-modal';
import { useStorageLocations } from '@/features/inventory/use-storage-locations';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileInitials } from '@/features/navigation/use-profile-initials';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { useTheme } from '@/hooks/use-theme';
import { EditFridgeItemSheet } from './components/edit-fridge-item-sheet';
import { FridgeItemActionsSheet } from './components/fridge-item-actions-sheet';
import { FridgeItemRow } from './components/fridge-item-row';
import { FridgeSummaryCard } from './components/fridge-summary-card';
import { FridgeTabBar } from './components/fridge-tab-bar';
import { compareByExpiry, getExpiryInfo } from './expiry';
import { type LocalFridgeItem, useFridgeItems } from './use-fridge-items';
import { useUpdateFridgeItemQuantityMutation } from './use-fridge-mutations';

/**
 * Vorrat-Bestand, dynamisch gefiltert nach Lagerort (#67).
 *
 * - Dynamische Tab-Filter basierend auf den Lagerorten aus den Einstellungen
 * - Farbiger linker Rand als MHD-Ampel (#71, expiry.ts)
 * - Grosszuegige Zusammenfassung mit kompakter Arbeitsliste
 * - Vertikaler MHD-Indikator ohne dekorative Produktkacheln
 * - Kurzer Tap = Aktionen, langer Tap = Produktinformationen
 */
type SortMode = 'expiry' | 'name';

export function FridgeScreen() {
  const theme = useTheme();
  const hubGradient = useHubGradient();
  const { openDrawer, openProfile } = useNavigationChrome();
  const initials = useProfileInitials();
  const params = useLocalSearchParams<{ filter?: string }>();
  const showExpiringOnly = params.filter === 'expiring';
  const [activeLocationId, setActiveLocationId] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('expiry');
  const [actionItem, setActionItem] = useState<LocalFridgeItem | null>(null);
  const [informationItem, setInformationItem] = useState<LocalFridgeItem | null>(null);
  const [editItem, setEditItem] = useState<LocalFridgeItem | null>(null);

  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;

  const { data: locations = [], isLoading: locationsLoading } = useStorageLocations(householdId);
  const { data: allItems = [], isLoading } = useFridgeItems(householdId);
  const updateQty = useUpdateFridgeItemQuantityMutation();

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

  function updateQuantity(item: LocalFridgeItem, delta: number) {
    if (!householdId) return;
    updateQty.mutate({ id: item.id, household_id: householdId, delta });
  }

  function handleEdit(item: LocalFridgeItem) {
    setActionItem(null);
    setEditItem(item);
  }

  function handleConsume(item: LocalFridgeItem) {
    updateQuantity(item, -item.quantity);
    setActionItem(null);
  }

  function handleDeletePress(item: LocalFridgeItem) {
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
    <Screen title="Vorrat" chrome={chrome} backgroundGradient={hubGradient}>
      <FridgeSummaryCard
        totalCount={allItems.length}
        criticalCount={expiryCounts.critical}
        soonCount={expiryCounts.soon}
      />

      {/* Dynamische Lagerort-Auswahl aus den Haushaltseinstellungen. */}
      {locationsLoading || locations.length === 0 ? null : (
        <FridgeTabBar
          activeTab={selectedLocationId}
          onTabChange={setActiveLocationId}
          locations={locations}
        />
      )}

      {/* Kompakter Arbeitslisten-Kopf, #71 */}
      {allItems.length > 0 ? (
        <View style={styles.sortRow}>
          <ThemedText type="small" themeColor="textSecondary">
            {sortMode === 'expiry' ? 'Nach Haltbarkeit' : 'Alphabetisch'}
          </ThemedText>
          <Button
            variant="link"
            label="Sortieren"
            accessibilityLabel={`Sortierung ändern, aktuell ${
              sortMode === 'expiry' ? 'nach Haltbarkeit' : 'alphabetisch'
            }`}
            onPress={() => setSortMode((current) => (current === 'expiry' ? 'name' : 'expiry'))}
          />
        </View>
      ) : null}

      {/* Artikel-Liste des aktiven Tabs */}
      {isLoading ? null : visibleItems.length === 0 ? (
        <Card style={{ marginTop: Spacing.two }}>
          <EmptyState
            symbol="archivebox"
            title={`${activeLocationName} ist leer`}
            hint="Schließe einen Einkauf ab oder füge Artikel manuell hinzu."
          />
        </Card>
      ) : (
        <View
          style={[
            styles.listCard,
            {
              backgroundColor: theme.backgroundElement,
              marginTop: Spacing.two,
              boxShadow: `0 8px 24px ${withAlpha(theme.shadowCard, 0.08)}`,
            },
          ]}>
          <FlatList
            data={visibleItems}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <FridgeItemRow
                item={item}
                onPress={() => setActionItem(item)}
                onLongPress={() => setInformationItem(item)}
                onRemove={() => handleDeletePress(item)}
              />
            )}
          />
        </View>
      )}

      <FridgeItemActionsSheet
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

      <EditFridgeItemSheet
        visible={!!editItem}
        item={editItem}
        locations={locations}
        onClose={() => setEditItem(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    paddingLeft: Spacing.one,
  },
  listCard: {
    borderRadius: Radius.sheet,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
});
