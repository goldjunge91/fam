import { useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHouseholds } from '@/features/household/api';

import { FridgeItemRow } from './components/fridge-item-row';
import { FridgeTabBar, TABS, type TabKind } from './components/fridge-tab-bar';
import { getExpiryInfo } from './expiry';
import { type LocalFridgeItem, useFridgeItems } from './use-fridge-items';
import { useUpdateFridgeItemQuantityMutation } from './use-fridge-mutations';

/**
 * Vorrat-Bestand, gruppiert nach Lagerort (#67).
 *
 * - Tab-Filter: Kühl / Froster / Kammer
 * - Farbiger linker Rand als MHD-Ampel (#71, expiry.ts)
 * - MHD-Badge + Stepper (− / + )
 * - Lang drücken = Löschen-Bestätigung
 */
export function FridgeScreen() {
  const [activeTab, setActiveTab] = useState<TabKind>('fridge');

  const { data: households } = useHouseholds();
  const currentHousehold = households?.[0];
  const householdId = currentHousehold?.id;

  const { data: groups = [], isLoading } = useFridgeItems(householdId);
  const updateQty = useUpdateFridgeItemQuantityMutation();

  const allItems = groups.flatMap((g) => g.items);
  const expiringCount = allItems.filter((item) => {
    const info = getExpiryInfo(item.expiry_date, new Date());
    return info.bucket === 'critical' || info.bucket === 'expired';
  }).length;

  const activeGroup = groups.find((g) => g.locationKind === activeTab);
  const visibleItems = activeGroup?.items ?? [];

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
      {/* Tab-Leiste */}
      <FridgeTabBar activeTab={activeTab} onTabChange={setActiveTab} groups={groups} />

      {/* Artikel-Liste des aktiven Tabs */}
      {isLoading ? null : visibleItems.length === 0 ? (
        <Card>
          <EmptyState
            symbol="archivebox"
            title={`${TABS.find((t) => t.kind === activeTab)?.label ?? 'Lagerort'} ist leer`}
            hint="Schließe einen Einkauf ab, um Artikel automatisch einzulagern."
          />
        </Card>
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
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
