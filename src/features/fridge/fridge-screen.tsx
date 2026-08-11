import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { ProductDetailModal } from '@/features/inventory/product-detail-modal';
import { useStorageLocations } from '@/features/inventory/use-storage-locations';
import { useTheme } from '@/hooks/use-theme';

import { FridgeItemRow } from './components/fridge-item-row';
import { FridgeTabBar } from './components/fridge-tab-bar';
import { compareByExpiry, getExpiryInfo } from './expiry';
import { type LocalFridgeItem, useFridgeItems } from './use-fridge-items';
import { useUpdateFridgeItemQuantityMutation } from './use-fridge-mutations';

/**
 * Vorrat-Bestand, dynamisch gefiltert nach Lagerort (#67).
 *
 * - Dynamische Tab-Filter basierend auf den Lagerorten aus den Einstellungen
 * - Farbiger linker Rand als MHD-Ampel (#71, expiry.ts)
 * - MHD-Badge + Stepper (− / + )
 * - Lang drücken = Löschen-Bestätigung
 */
type SortMode = 'expiry' | 'name';

export function FridgeScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ filter?: string }>();
  const showExpiringOnly = params.filter === 'expiring';
  const [activeTab, setActiveTab] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('expiry');
  const [selectedItem, setSelectedItem] = useState<LocalFridgeItem | null>(null);

  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;

  const { data: locations = [] } = useStorageLocations(householdId);
  const { data: allItems = [], isLoading } = useFridgeItems(householdId);
  const updateQty = useUpdateFridgeItemQuantityMutation();

  const expiringCount = allItems.filter((item) => {
    if (!item?.expiry_date) return false;
    const info = getExpiryInfo(item.expiry_date, new Date());
    return info.bucket === 'critical' || info.bucket === 'expired';
  }).length;

  // filter=expiring (#73, vom Dashboard-Widget) ueberschreibt den
  // Lagerort-Tab-Filter, statt ihn zu kombinieren — einfacher, und die
  // Tab-Auswahl bleibt fuer den naechsten Besuch ohne den Query-Param erhalten.
  const locationFiltered =
    activeTab === 'all' ? allItems : allItems.filter((item) => item.location_id === activeTab);
  const baseItems = showExpiringOnly
    ? allItems.filter((item) =>
        ['expired', 'critical'].includes(getExpiryInfo(item.expiry_date, new Date()).bucket),
      )
    : locationFiltered;

  // SQL liefert bereits MHD-sortiert (default) — der Toggle sortiert nur
  // client-seitig um, keine Requery noetig fuer "Name" (#71).
  const visibleItems = [...baseItems].sort((a, b) =>
    sortMode === 'name'
      ? a.name.localeCompare(b.name, 'de')
      : compareByExpiry(
          getExpiryInfo(a.expiry_date, new Date()),
          getExpiryInfo(b.expiry_date, new Date()),
        ),
  );

  function handleDecrement(item: LocalFridgeItem) {
    if (!householdId) return;
    if (item.quantity <= 1) {
      Alert.alert('Artikel verbraucht?', `"${item.name}" aus dem Vorrat entfernen?`, [
        { text: 'Behalten', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: () => updateQty.mutate({ id: item.id, household_id: householdId, delta: -1 }),
        },
      ]);
    } else {
      updateQty.mutate({ id: item.id, household_id: householdId, delta: -1 });
    }
  }

  function handleIncrement(item: LocalFridgeItem) {
    if (!householdId) return;
    updateQty.mutate({ id: item.id, household_id: householdId, delta: 1 });
  }

  function handleDeletePress(item: LocalFridgeItem) {
    if (!householdId) return;
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

  if (!householdId) {
    return (
      <Screen title="Vorrat" subtitle="Für alle im Haushalt sichtbar">
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

  const subtitle =
    allItems.length > 0
      ? `${allItems.length} Artikel gesamt · Tippe für Nährwerte`
      : 'Für alle im Haushalt sichtbar';

  const activeLocationName =
    activeTab === 'all'
      ? 'Vorrat'
      : (locations.find((l) => l.id === activeTab)?.name ?? 'Lagerort');

  return (
    <Screen
      title="Vorrat"
      subtitle={subtitle}
      action={
        <View style={styles.headerActions}>
          {expiringCount > 0 ? (
            <View style={styles.expiringBadge}>
              <ThemedText style={styles.expiringBadgeText}>⚠ {expiringCount} ablaufend</ThemedText>
            </View>
          ) : null}
          <Pressable
            onPress={() => router.push('/add-item')}
            accessibilityRole="button"
            accessibilityLabel="Artikel hinzufügen"
            style={[styles.addHeaderButton, { backgroundColor: theme.accent }]}>
            <ThemedText style={styles.addHeaderButtonText}>+</ThemedText>
          </Pressable>
        </View>
      }>
      {/* Dynamic Tab-Leiste für alle Lagerorte aus den Einstellungen */}
      <FridgeTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        locations={locations}
        items={allItems}
      />

      {/* Sortier-Toggle: MHD (Default) oder Name (#71) */}
      {allItems.length > 0 ? (
        <View style={styles.sortRow}>
          {(['expiry', 'name'] as const).map((mode) => (
            <ThemedText
              key={mode}
              onPress={() => setSortMode(mode)}
              style={[
                styles.sortPill,
                {
                  backgroundColor: sortMode === mode ? theme.accent : theme.backgroundElement,
                  color: sortMode === mode ? '#fff' : theme.text,
                },
              ]}>
              {mode === 'expiry' ? 'MHD' : 'Name'}
            </ThemedText>
          ))}
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
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          style={{ marginTop: Spacing.two }}
          renderItem={({ item }) => (
            <FridgeItemRow
              item={item}
              onPress={() => setSelectedItem(item)}
              onDecrement={() => handleDecrement(item)}
              onIncrement={() => handleIncrement(item)}
              onDelete={() => handleDeletePress(item)}
            />
          )}
        />
      )}

      <ProductDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sortRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  expiringBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  expiringBadgeText: {
    color: '#B26A00',
    fontSize: 12,
    fontWeight: '600',
  },
  addHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addHeaderButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
});
