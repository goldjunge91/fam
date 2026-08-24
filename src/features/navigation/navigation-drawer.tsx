import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDayIcon } from '@/components/icons/calendar-day-icon';
import { FamIcon } from '@/components/icons/fam-icon';
import { ThemedText } from '@/components/theme/themed-text';
import { getDrawerGroups } from '@/constants/feature-registry';
import { withAlpha } from '@/constants/theme';
import { useFeatureAccess } from '@/features/settings/use-feature-access';
import { useDeferredMount } from '@/hooks/use-deferred-mount';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationChrome } from './navigation-chrome-provider';

const DRAWER_WIDTH_RATIO = 0.84;

/**
 * Hamburger-Drawer als Ersatz der frueheren Bottom-Tab-Leiste (#150, Figma
 * "00.02 · Navigation — Hamburger geöffnet"). Alle Produktbereiche
 * gleichberechtigt in einer Liste statt in sieben Tabs.
 */
export function NavigationDrawer() {
  const { isDrawerOpen, closeDrawer } = useNavigationChrome();
  const mounted = useDeferredMount(isDrawerOpen);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const translateX = useSharedValue(-1);

  useEffect(() => {
    translateX.value = withTiming(isDrawerOpen ? 0 : -1, { duration: 220 });
  }, [isDrawerOpen, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(translateX.value, [-1, 0], [-320, 0]),
      },
    ],
  }));

  if (!mounted) return null;

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
          // Safe-Area-Insets, Breite (Verhaeltnis), Hintergrund-Opazitaet und
          // Schatten sind echte Laufzeitwerte; der Animated-Transform kommt
          // ueber `animatedStyle` (Reanimated, UI-Thread) hinzu.
          style={[
            {
              paddingTop: Math.max(insets.top - 20, 27),
              paddingBottom: Math.max(insets.bottom, 26),
              width: `${DRAWER_WIDTH_RATIO * 100}%`,
              // Deckend statt 0.97 Alpha — bei leicht transparentem
              // Hintergrund schien der Screen dahinter (Titel, Avatar) durch
              // den Drawer-Header hindurch.
              backgroundColor: theme.backgroundElement,
              boxShadow: `24px 0 64px ${withAlpha(theme.shadowSheet, 0.18)}`,
            },
            animatedStyle,
          ]}>
          {isDrawerOpen && <DrawerContent />}
        </Animated.View>
      </View>
    </Modal>
  );
}

// Eigene Komponente statt Inline-JSX im Drawer-Body: `{isDrawerOpen &&
// <DrawerContent />}` unmountet den kompletten Inhalt (inkl. ScrollView der
// Navigationsgruppen) beim Schliessen, statt ihn nur unsichtbar zu halten.
function DrawerContent() {
  const theme = useTheme();
  const pathname = usePathname();
  const { closeDrawer } = useNavigationChrome();
  const { isFeatureEnabled } = useFeatureAccess();

  function navigateTo(href: string) {
    closeDrawer();
    setTimeout(() => router.push(href as Parameters<typeof router.push>[0]), 250);
  }

  const drawerGroups = getDrawerGroups();
  const visibleGroups = drawerGroups
    .map((group) => ({
      ...group,
      routes: group.routes.filter((route) => isFeatureEnabled(route.feature)),
    }))
    .filter((group) => group.routes.length > 0);

  return (
    <>
      <View className="drawer-header">
        <ThemedText type="subtitle" className="drawer-brand">
          fam
        </ThemedText>
        <Pressable
          onPress={closeDrawer}
          accessibilityRole="button"
          accessibilityLabel="Menü schließen"
          className="drawer-close-btn"
          hitSlop={8}>
          <ThemedText
            type="default"
            themeColor="textSecondary"
            className="drawer-close-glyph"
            // `type="title"` (48px/52 Zeilenhoehe) konkurrierte mit der
            // 22px/26px-Klasse um dieselben Eigenschaften — je nachdem, wie
            // NativeWind die beiden Klassenquellen kaskadiert, gewann mal die
            // eine, mal die andere Zeilenhoehe, und das "×" sass zu tief im
            // Kreis (untere Spitzen fast am Rand). Expliziter `style` gewinnt
            // immer, unabhaengig von der Klassen-Reihenfolge.
            style={{ fontSize: 20, lineHeight: 20, fontWeight: '400' }}>
            ×
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {visibleGroups.map((group) => (
          <View key={group.title} className="drawer-group">
            {group.hideTitle ? null : (
              <ThemedText type="small" themeColor="textSecondary" className="drawer-group-title">
                {group.title.toUpperCase()}
              </ThemedText>
            )}
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
    </>
  );
}
