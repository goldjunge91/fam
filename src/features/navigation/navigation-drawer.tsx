import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDayIcon } from '@/components/calendar-day-icon';
import { FamIcon, type FamIconName } from '@/components/fam-icon';
import { FontSize, ThemedText } from '@/components/themed-text';
import { Radius, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationChrome } from './navigation-chrome-provider';

// 'calendarDay' ist kein statisches FamIcon, sondern das Kalenderblatt mit
// dem heutigen Datum (CalendarDayIcon) — eigener Sentinel-Wert statt eines
// weiteren FamIconName-Eintrags, weil er dynamisch ist.
type NavRoute = { label: string; href: string; icon: FamIconName | 'calendarDay' };

const GROUPS: { title: string; routes: NavRoute[] }[] = [
  { title: 'Heute', routes: [{ label: 'Übersicht', href: '/', icon: 'overview' }] },
  {
    title: 'Haushalt & Planung',
    routes: [
      { label: 'Vorrat', href: '/fridge', icon: 'fridge' },
      { label: 'Einkauf', href: '/shopping-list', icon: 'shopping' },
      { label: 'Rezepte', href: '/recipes', icon: 'recipes' },
      { label: 'Essensplan', href: '/meal-planner', icon: 'calendarDay' },
    ],
  },
  {
    title: 'Privat',
    routes: [{ label: 'Tagebuch', href: '/diary', icon: 'diary' }],
  },
];

const DRAWER_WIDTH_RATIO = 0.84;

/**
 * Hamburger-Drawer als Ersatz der frueheren Bottom-Tab-Leiste (#150, Figma
 * "00.02 · Navigation — Hamburger geöffnet"). Alle Produktbereiche
 * gleichberechtigt in einer Liste statt in sieben Tabs.
 */
export function NavigationDrawer() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isDrawerOpen, closeDrawer } = useNavigationChrome();
  const pathname = usePathname();
  const translateX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: isDrawerOpen ? 0 : -1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isDrawerOpen, translateX]);

  function navigateTo(href: string) {
    closeDrawer();
    router.push(href as Parameters<typeof router.push>[0]);
  }

  return (
    <Modal visible={isDrawerOpen} transparent animationType="fade" onRequestClose={closeDrawer}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          style={[styles.dim, { top: 0, backgroundColor: withAlpha(theme.shadowSheet, 0.3) }]}
          onPress={closeDrawer}
          accessibilityRole="button"
          accessibilityLabel="Menü schließen"
        />
        <Animated.View
          style={[
            styles.drawer,
            {
              paddingTop: Math.max(insets.top - 20, 27),
              paddingBottom: Math.max(insets.bottom, 26),
              width: `${DRAWER_WIDTH_RATIO * 100}%`,
              backgroundColor: withAlpha(theme.backgroundElement, 0.97),
              boxShadow: `24px 0 64px ${withAlpha(theme.shadowSheet, 0.18)}`,
              transform: [
                {
                  translateX: translateX.interpolate({
                    inputRange: [-1, 0],
                    outputRange: [-320, 0],
                  }),
                },
              ],
            },
          ]}>
          <View style={[styles.header, { borderBottomColor: withAlpha(theme.text, 0.15) }]}>
            <ThemedText type="subtitle" style={styles.brand}>
              fam
            </ThemedText>
            <Pressable
              onPress={closeDrawer}
              accessibilityRole="button"
              accessibilityLabel="Menü schließen"
              hitSlop={12}>
              <ThemedText type="title" themeColor="textSecondary" style={styles.closeGlyph}>
                ×
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {GROUPS.map((group) => (
              <View key={group.title} style={styles.group}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.groupTitle}>
                  {group.title.toUpperCase()}
                </ThemedText>
                {group.routes.map((route) => {
                  const isActive =
                    route.href === '/' ? pathname === '/' : pathname.startsWith(route.href);
                  return (
                    <Pressable
                      key={route.href}
                      onPress={() => navigateTo(route.href)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      style={[
                        styles.navRow,
                        isActive && { backgroundColor: theme.backgroundSelected },
                      ]}>
                      <View style={styles.navIcon}>
                        {route.icon === 'calendarDay' ? (
                          <CalendarDayIcon size={35} color={isActive ? theme.accent : theme.text} />
                        ) : (
                          <FamIcon
                            name={route.icon}
                            size={35}
                            color={isActive ? theme.accent : theme.text}
                          />
                        )}
                      </View>
                      <ThemedText
                        type={isActive ? 'smallBold' : 'default'}
                        themeColor={isActive ? 'accent' : 'text'}
                        style={[styles.navLabel, isActive && styles.navLabelActive]}>
                        {route.label}
                      </ThemedText>
                      <ThemedText themeColor="textSecondary">›</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <Pressable
            onPress={() => navigateTo('/settings')}
            accessibilityRole="button"
            style={[styles.manageRow, { backgroundColor: theme.backgroundSelected }]}>
            <View style={styles.settingsIcon}>
              <FamIcon name="settings" size={37} color={theme.text} />
            </View>
            <ThemedText type="smallBold" style={styles.navLabel}>
              Einstellungen
            </ThemedText>
            <ThemedText themeColor="textSecondary">›</ThemedText>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFill,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    maxWidth: 340,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 67,
    paddingHorizontal: 11,
    paddingTop: 11,
    paddingBottom: 21,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scroll: {
    flex: 1,
  },
  brand: {
    ...FontSize[27],
    lineHeight: 34,
    fontWeight: '600',
  },
  closeGlyph: {
    ...FontSize[27],
    lineHeight: 34,
    fontWeight: '400',
  },
  group: {
    paddingTop: 14,
  },
  groupTitle: {
    paddingHorizontal: 14,
    paddingBottom: 5,
    ...FontSize[12],
    lineHeight: 15,
    fontWeight: '400',
    letterSpacing: 0.76,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    height: 55,
    paddingHorizontal: 14,
    borderRadius: Radius.sheet,
    borderCurve: 'continuous',
  },
  navIcon: {
    width: 35,
    height: 35,
  },
  navLabel: {
    flex: 1,
    ...FontSize[17],
    lineHeight: 21,
    fontWeight: '400',
  },
  navLabelActive: {
    fontWeight: '600',
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    height: 65,
    padding: 15,
    borderRadius: Radius.sheet,
    borderCurve: 'continuous',
  },
  settingsIcon: {
    width: 37,
    height: 35,
  },
});
