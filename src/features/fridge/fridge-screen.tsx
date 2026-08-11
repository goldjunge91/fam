import { useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { useSnackbar } from '@/components/snackbar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useStorageLocations } from '@/features/inventory/use-storage-locations';
import { useTheme } from '@/hooks/use-theme';

import { FridgeItemRow } from './components/fridge-item-row';
import { FridgeTabBar } from './components/fridge-tab-bar';
import { compareByExpiry, getExpiryInfo } from './expiry';
import { type LocalFridgeItem, useFridgeItems } from './use-fridge-items';
import {
  useRestoreFridgeItemMutation,
  useUpdateFridgeItemQuantityMutation,
} from './use-fridge-mutations';

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
  const [activeTab, setActiveTab] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('expiry');

  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;

  const { data: locations = [] } = useStorageLocations(householdId);
  const { data: allItems = [], isLoading } = useFridgeItems(householdId);
  const updateQty = useUpdateFridgeItemQuantityMutation();
  const restoreItem = useRestoreFridgeItemMutation();
  const { showUndoSnackbar } = useSnackbar();

  const expiringCount = allItems.filter((item) => {
    if (!item?.expiry_date) return false;
    const info = getExpiryInfo(item.expiry_date, new Date());
    return info.bucket === 'critical' || info.bucket === 'expired';
  }).length;

  // SQL liefert bereits MHD-sortiert (default) — der Toggle sortiert nur
  // client-seitig um, keine Requery noetig fuer "Name" (#71).
  const visibleItems = [
    ...(activeTab === 'all' ? allItems : allItems.filter((item) => item.location_id === activeTab)),
  ].sort((a, b) =>
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

  // Loescht sofort statt eines Bestaetigungs-Dialogs (#69) — die Snackbar mit
  // "Rueckgaengig" ersetzt die Bestaetigung, statt sie zu ergaenzen.
  function handleDeletePress(item: LocalFridgeItem) {
    if (!householdId) return;
    updateQty.mutate({ id: item.id, household_id: householdId, delta: -item.quantity });
    showUndoSnackbar({
      message: `"${item.name}" gelöscht`,
      onUndo: () => {
        restoreItem.mutate({ id: item.id, household_id: householdId });
      },
    });
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
