import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDayIcon } from '@/components/calendar-day-icon';
import { FamIcon, type FamIconName } from '@/components/fam-icon';
import { ThemedText } from '@/components/themed-text';
import { withAlpha } from '@/constants/theme';
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
          className="absolute inset-0"
          // Dynamische Opazitaet (withAlpha), kein fester Token-Schritt.
          style={{ backgroundColor: withAlpha(theme.shadowSheet, 0.3) }}
          onPress={closeDrawer}
          accessibilityRole="button"
          accessibilityLabel="Menü schließen"
        />
        <Animated.View
          className="drawer"
          // Safe-Area-Insets, Breite (Verhaeltnis), Hintergrund-Opazitaet,
          // Schatten und Animated-Transform sind echte Laufzeitwerte.
          style={{
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
          }}>
          <View className="drawer-header">
            <ThemedText type="subtitle" className="drawer-brand">
              fam
            </ThemedText>
            <Pressable
              onPress={closeDrawer}
              accessibilityRole="button"
              accessibilityLabel="Menü schließen"
              hitSlop={12}>
              <ThemedText type="title" themeColor="textSecondary" className="drawer-close-glyph">
                ×
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {GROUPS.map((group) => (
              <View key={group.title} className="drawer-group">
                <ThemedText type="small" themeColor="textSecondary" className="drawer-group-title">
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
                      className={`drawer-nav-row ${isActive ? 'bg-background-selected' : ''}`}>
                      <View className="drawer-nav-icon">
                        {route.icon === 'calendarDay' ? (
                          <CalendarDayIcon size={35} />
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
                        className={`drawer-nav-label ${isActive ? 'drawer-nav-label-active' : ''}`}>
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
            className="drawer-manage-row">
            <View className="drawer-settings-icon">
              <FamIcon name="settings" size={37} color={theme.text} />
            </View>
            <ThemedText type="smallBold" className="drawer-nav-label">
              Einstellungen
            </ThemedText>
            <ThemedText themeColor="textSecondary">›</ThemedText>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}
