import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHouseholds } from '@/features/household/api';
import { useUpdateFridgeItemQuantityMutation } from '@/features/inventory/api';
import { useTheme } from '@/hooks/use-theme';

import { type ExpiryBucket, getExpiryInfo } from './expiry';
import { type GroupedFridgeItems, type LocalFridgeItem, useFridgeItems } from './use-fridge-items';

// ---------------------------------------------------------------------------
// Ampel-Farben (linker Rand pro Artikel)
// ---------------------------------------------------------------------------

const EXPIRY_LEFT_BORDER: Record<ExpiryBucket, string> = {
  expired: '#C62828',
  critical: '#C62828',
  soon: '#B26A00',
  ok: '#1A7F4B',
  none: 'transparent',
};

// ---------------------------------------------------------------------------
// Tab-Filter
// ---------------------------------------------------------------------------

type TabKind = 'fridge' | 'freezer' | 'pantry';

const TABS: { kind: TabKind; label: string; icon: string }[] = [
  { kind: 'fridge', label: 'Kühl', icon: '🧊' },
  { kind: 'freezer', label: 'Froster', icon: '❄️' },
  { kind: 'pantry', label: 'Kammer', icon: '🗄' },
];

interface TabBarProps {
  activeTab: TabKind;
  onTabChange: (kind: TabKind) => void;
  groups: GroupedFridgeItems[];
}

function TabBar({ activeTab, onTabChange, groups }: TabBarProps) {
  const theme = useTheme();

  return (
    <View style={[styles.tabBar, { backgroundColor: theme.backgroundElement }]}>
      {TABS.map(({ kind, label, icon }) => {
        const isActive = activeTab === kind;
        const count = groups.find((g) => g.locationKind === kind)?.items.length ?? 0;

        return (
          <Pressable
            key={kind}
            onPress={() => onTabChange(kind)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={[styles.tab, isActive && { backgroundColor: theme.background }]}>
            <ThemedText style={styles.tabIcon}>{icon}</ThemedText>
            <ThemedText
              type="small"
              style={{
                color: isActive ? theme.text : theme.textSecondary,
                fontWeight: isActive ? '600' : '400',
              }}>
              {label}
            </ThemedText>
            {count > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  { backgroundColor: isActive ? theme.accent : theme.textSecondary },
                ]}>
                <ThemedText style={styles.tabBadgeText}>{count}</ThemedText>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Einzel-Artikel-Zeile
// ---------------------------------------------------------------------------

interface FridgeItemRowProps {
  item: LocalFridgeItem;
  onDecrement: () => void;
  onIncrement: () => void;
  onDelete: () => void;
}

function FridgeItemRow({ item, onDecrement, onIncrement, onDelete }: FridgeItemRowProps) {
  const theme = useTheme();
  const expiry = getExpiryInfo(item.expiry_date, new Date());
  const borderColor = EXPIRY_LEFT_BORDER[expiry.bucket];

  return (
    <Pressable
      onLongPress={onDelete}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.quantity} ${item.unit}`}
      accessibilityHint="Lang drücken zum Löschen"
      style={[styles.itemRow, { borderBottomColor: theme.border }]}>
      {/* MHD-Ampel — linker farbiger Streifen */}
      <View style={[styles.expiryBar, { backgroundColor: borderColor }]} />

      {/* Inhalt */}
      <View style={styles.itemMain}>
        <ThemedText type="smallBold">{item.name}</ThemedText>
        <View style={styles.itemMeta}>
          {item.location_name ? (
            <ThemedText type="small" themeColor="textSecondary">
              {item.location_name}
            </ThemedText>
          ) : null}
          {expiry.bucket !== 'none' ? (
            <View style={[styles.mhdBadge, { backgroundColor: `${theme[expiry.themeColor]}22` }]}>
              <ThemedText type="small" style={{ color: theme[expiry.themeColor], fontSize: 11 }}>
                {item.expiry_date
                  ? new Date(item.expiry_date).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                  : ''}
                {' · '}
                {expiry.bucket === 'critical' || expiry.bucket === 'expired' ? 'Kritisch' : 'Bald'}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      {/* Mengen-Stepper */}
      <View style={styles.stepper}>
        <Pressable
          onPress={onDecrement}
          accessibilityRole="button"
          accessibilityLabel="Menge reduzieren"
          hitSlop={8}
          style={[styles.stepperButton, { borderColor: theme.border }]}>
          <ThemedText style={styles.stepperIcon}>−</ThemedText>
        </Pressable>

        <ThemedText type="smallBold" style={styles.quantity}>
          {item.quantity} {item.unit}
        </ThemedText>

        <Pressable
          onPress={onIncrement}
          accessibilityRole="button"
          accessibilityLabel="Menge erhöhen"
          hitSlop={8}
          style={[
            styles.stepperButton,
            styles.stepperButtonPlus,
            { borderColor: theme.success, backgroundColor: `${theme.success}18` },
          ]}>
          <ThemedText style={[styles.stepperIcon, { color: theme.success }]}>+</ThemedText>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Haupt-Screen
// ---------------------------------------------------------------------------

/**
 * Vorrat-Bestand, gruppiert nach Lagerort (#67).
 *
 * - Tab-Filter: Kühl / Froster / Kammer
 * - Farbiger linker Rand als MHD-Ampel (#71, expiry.ts)
 * - MHD-Badge + Stepper (− / + )
 * - Lang drücken = Löschen-Bestätigung
 * - FAB oben rechts (Platzhalter für zukünftiges Hinzufügen)
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
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} groups={groups} />

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
  tabBar: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    padding: Spacing.half,
    gap: Spacing.half,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two + 2,
  },
  tabIcon: {
    fontSize: 14,
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
  },
  expiryBar: {
    width: 4,
    height: '100%',
    minHeight: 44,
    borderRadius: 2,
  },
  itemMain: {
    flex: 1,
    gap: Spacing.half,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  mhdBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonPlus: {
    borderWidth: 1,
  },
  stepperIcon: {
    fontSize: 18,
    lineHeight: 22,
  },
  quantity: {
    minWidth: 54,
    textAlign: 'center',
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
