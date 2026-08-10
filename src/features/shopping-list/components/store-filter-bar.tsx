import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Store } from '../use-stores';

export const ALL_FILTER = 'all';
export const UNASSIGNED_FILTER = 'unassigned';

interface FilterChipProps {
  label: string;
  count: number;
  isActive: boolean;
  /** Hintergrund im aktiven Zustand; im inaktiven Zustand wird daraus ein Tint. */
  tint: string;
  /** Textfarbe im aktiven Zustand — weiss bei Markenfarben, sonst der Hintergrund selbst. */
  activeTextColor: string;
  onPress: () => void;
}

function FilterChip({ label, count, isActive, tint, activeTextColor, onPress }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      style={[styles.chip, { backgroundColor: isActive ? tint : `${tint}22` }]}>
      <ThemedText
        type="small"
        style={{ color: isActive ? activeTextColor : tint, fontWeight: isActive ? '700' : '500' }}>
        {label}
      </ThemedText>
      {count > 0 && (
        <View
          style={[
            styles.badge,
            { backgroundColor: isActive ? `${activeTextColor}33` : `${tint}33` },
          ]}>
          <ThemedText
            type="small"
            style={{ color: isActive ? activeTextColor : tint, fontWeight: '700', fontSize: 11 }}>
            {count}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

interface StoreFilterBarProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  stores: Store[];
  totalCount: number;
  unassignedCount: number;
  countForStore: (storeId: string) => number;
}

/**
 * Markt-Chips ueber der Einkaufsliste — "Alle Listen" + ein farbiger Chip je
 * Markt + optional "Ohne Markt". Nach dem Vorbild von
 * `src/features/fridge/components/fridge-tab-bar.tsx`, aber markt-farbig
 * statt emoji-basiert.
 */
export function StoreFilterBar({
  activeFilter,
  onFilterChange,
  stores,
  totalCount,
  unassignedCount,
  countForStore,
}: StoreFilterBarProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabBar}>
      <FilterChip
        label="Alle Listen"
        count={totalCount}
        isActive={activeFilter === ALL_FILTER}
        tint={theme.text}
        activeTextColor={theme.background}
        onPress={() => onFilterChange(ALL_FILTER)}
      />

      {stores.map((store) => (
        <FilterChip
          key={store.id}
          label={store.name}
          count={countForStore(store.id)}
          isActive={activeFilter === store.id}
          tint={store.color}
          activeTextColor="#fff"
          onPress={() => onFilterChange(store.id)}
        />
      ))}

      {unassignedCount > 0 && (
        <FilterChip
          label="Ohne Markt"
          count={unassignedCount}
          isActive={activeFilter === UNASSIGNED_FILTER}
          tint={theme.textSecondary}
          activeTextColor="#fff"
          onPress={() => onFilterChange(UNASSIGNED_FILTER)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
