import { useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHouseholds } from '@/features/household/api';
import { useStorageLocations } from '@/features/inventory/use-storage-locations';

import { FridgeItemRow } from './components/fridge-item-row';
import { FridgeTabBar } from './components/fridge-tab-bar';
import { getExpiryInfo } from './expiry';
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
export function FridgeScreen() {
  const [activeTab, setActiveTab] = useState<string>('all');

  const { data: households } = useHouseholds();
  const currentHousehold = households?.[0];
  const householdId = currentHousehold?.id;

  const { data: locations = [] } = useStorageLocations(householdId);
  const { data: allItems = [], isLoading } = useFridgeItems(householdId);
  const updateQty = useUpdateFridgeItemQuantityMutation();

  const expiringCount = allItems.filter((item) => {
    if (!item?.expiry_date) return false;
    const info = getExpiryInfo(item.expiry_date, new Date());
    return info.bucket === 'critical' || info.bucket === 'expired';
  }).length;

  const visibleItems =
    activeTab === 'all' ? allItems : allItems.filter((item) => item.location_id === activeTab);

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
    Alert.alert('Artikel löschen', `"${item.name}" sofort aus dem Vorrat entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () =>
          updateQty.mutate({
            id: item.id,
            household_id: householdId,
            delta: -item.quantity,
          }),
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
        expiringCount > 0 ? (
          <View style={styles.expiringBadge}>
            <ThemedText style={styles.expiringBadgeText}>⚠ {expiringCount} ablaufend</ThemedText>
          </View>
        ) : undefined
      }>
      {/* Dynamic Tab-Leiste für alle Lagerorte aus den Einstellungen */}
      <FridgeTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        locations={locations}
        items={allItems}
      />

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
              onDecrement={() => handleDecrement(item)}
              onIncrement={() => handleIncrement(item)}
              onDelete={() => handleDeletePress(item)}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
