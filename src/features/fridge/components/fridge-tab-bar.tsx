import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { StorageLocation } from '@/features/inventory/use-storage-locations';
import { useTheme } from '@/hooks/use-theme';
import type { LocalFridgeItem } from '../use-fridge-items';

export function getIconForLocation(kind?: string | null, name?: string | null): string {
  const k = (kind ?? '').toLowerCase();
  const n = (name ?? '').toLowerCase();
  if (k === 'fridge') return '🫙';
  if (k === 'freezer') return '❄️';
  if (k === 'pantry') return '🥫';
  if (
    n.includes('tief') ||
    n.includes('frost') ||
    n.includes('eis') ||
    n.includes('frier') ||
    n.includes('freezer')
  )
    return '❄️';
  if (n.includes('kühl') || n.includes('fridge')) return '🫙';
  if (n.includes('kammer') || n.includes('schrank') || n.includes('regal') || n.includes('pantry'))
    return '🥫';
  return '📦';
}

interface FridgeTabBarProps {
  activeTab: string; // 'all' or location.id
  onTabChange: (id: string) => void;
  locations: StorageLocation[];
  items: LocalFridgeItem[];
}

export function FridgeTabBar({ activeTab, onTabChange, locations, items }: FridgeTabBarProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.tabBar, { backgroundColor: theme.backgroundElement }]}>
      <Pressable
        onPress={() => onTabChange('all')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'all' }}
        style={[
          styles.tab,
          activeTab === 'all' && {
            backgroundColor: theme.background,
            borderColor: theme.accent,
            borderWidth: 1,
          },
        ]}>
        <ThemedText style={styles.tabIcon}>📦</ThemedText>
        <ThemedText
          type="small"
          style={{
            color: activeTab === 'all' ? theme.text : theme.textSecondary,
            fontWeight: activeTab === 'all' ? '600' : '400',
          }}>
          Alle
        </ThemedText>
        {items.length > 0 && (
          <View
            style={[
              styles.tabBadge,
              { backgroundColor: activeTab === 'all' ? theme.accent : theme.textSecondary },
            ]}>
            <ThemedText style={styles.tabBadgeText}>{items.length}</ThemedText>
          </View>
        )}
      </Pressable>

      {locations.map((loc) => {
        const isActive = activeTab === loc.id;
        const icon = getIconForLocation(loc.kind, loc.name);
        const count = items.filter((i) => i.location_id === loc.id).length;

        return (
          <Pressable
            key={loc.id}
            onPress={() => onTabChange(loc.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={[
              styles.tab,
              isActive && {
                backgroundColor: theme.background,
                borderColor: theme.accent,
                borderWidth: 1,
              },
            ]}>
            <ThemedText style={styles.tabIcon}>{icon}</ThemedText>
            <ThemedText
              type="small"
              style={{
                color: isActive ? theme.text : theme.textSecondary,
                fontWeight: isActive ? '600' : '400',
              }}>
              {loc.name}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    padding: Spacing.half,
    gap: Spacing.half,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
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
});
