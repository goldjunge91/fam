import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { GroupedFridgeItems } from '../use-fridge-items';

export type TabKind = 'fridge' | 'freezer' | 'pantry';

export const TABS: { kind: TabKind; label: string; icon: string }[] = [
  { kind: 'fridge', label: 'Kühl', icon: '🧊' },
  { kind: 'freezer', label: 'Froster', icon: '❄️' },
  { kind: 'pantry', label: 'Kammer', icon: '🗄' },
];

interface FridgeTabBarProps {
  activeTab: TabKind;
  onTabChange: (kind: TabKind) => void;
  groups: GroupedFridgeItems[];
}

export function FridgeTabBar({ activeTab, onTabChange, groups }: FridgeTabBarProps) {
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
});
