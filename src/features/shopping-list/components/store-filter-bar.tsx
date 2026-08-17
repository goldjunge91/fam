import { Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
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
      className="store-filter-chip"
      // Dynamische Markt-Farbe aus der Datenbank
      style={{ backgroundColor: isActive ? tint : `${tint}22` }}>
      <ThemedText
        type={isActive ? 'smallBold' : 'small'}
        // Dynamische Textfarbe passend zur Markt-Farbe
        style={{ color: isActive ? activeTextColor : tint }}>
        {label}
      </ThemedText>
      {count > 0 && (
        <View
          className="store-filter-badge"
          // Dynamische Badge-Farbe passend zur Markt-Farbe
          style={{ backgroundColor: isActive ? `${activeTextColor}33` : `${tint}33` }}>
          <ThemedText
            type="captionCompact"
            className="font-bold"
            // Dynamische Textfarbe passend zur Markt-Farbe
            style={{ color: isActive ? activeTextColor : tint }}>
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
      contentContainerClassName="flex-row gap-two py-one">
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
