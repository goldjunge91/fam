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
import { radius, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { getDrawerGroups } from '@/constants/feature-registry';
import { Txt } from '@/constants/ui';
import { useFeatureAccess } from '@/features/settings/use-feature-access';
import { useDeferredMount } from '@/hooks/use-deferred-mount';
import { debugLogEvent } from '@/lib/debug-log';
import { useNavigationChrome } from './navigation-chrome-provider';

const DRAWER_WIDTH_RATIO = 0.84;

const styles = StyleSheet.create({
  backdrop: StyleSheet.absoluteFill,
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
    paddingHorizontal: 11,
    paddingTop: 11,
    paddingBottom: 21,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  group: {
    paddingTop: 14,
  },
  householdGroup: {
    marginTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  groupTitle: {
    paddingHorizontal: 14,
    paddingBottom: 5,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    height: 55,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
  },
  navIcon: {
    width: 35,
    height: 35,
  },
  navLabel: {
    flex: 1,
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    height: 65,
    padding: 15,
    borderRadius: radius.lg,
  },
  settingsIcon: {
    width: 37,
    height: 35,
  },
});

debugLogEvent('navigation-drawer.module-loaded', { variant: 'shared' });

function isRouteActive(pathname: string, href: string): boolean {
  // Expo Router kann den sichtbaren Route-Group-Namen liefern, obwohl die
  // Navigationseinträge mit den öffentlichen Pfaden konfiguriert sind.
  const normalizedPathname = pathname.replace(/\/\([^/]+\)/g, '') || '/';
  return href === '/'
    ? normalizedPathname === '/'
    : normalizedPathname === href || normalizedPathname.startsWith(`${href}/`);
}

export function NavigationDrawer() {
  const { isDrawerOpen, closeDrawer } = useNavigationChrome();
  const mounted = useDeferredMount(isDrawerOpen);
  const { colors } = useTheme();
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
          // Laufzeitwert für die Abdunklung.
          style={[styles.backdrop, { backgroundColor: withAlpha(colors.text, 0.3) }]}
          onPress={closeDrawer}
          accessibilityRole="button"
          accessibilityLabel="Menü schließen"
        />
        <Animated.View
          // Laufzeitwerte für Insets, Breite, Hintergrund und Schatten.
          style={[
            styles.drawer,
            {
              paddingTop: Math.max(insets.top - 20, 27),
              paddingBottom: Math.max(insets.bottom, 26),
              width: `${DRAWER_WIDTH_RATIO * 100}%`,
              // Deckender Hintergrund verhindert Durchscheinen im Header.
              backgroundColor: colors.surface,
              boxShadow: `24px 0 64px ${withAlpha(colors.text, 0.18)}`,
            },
            animatedStyle,
          ]}>
          {isDrawerOpen && <DrawerContent />}
        </Animated.View>
      </View>
    </Modal>
  );
}

// Beim Schließen den Drawer-Inhalt vollständig unmounten.
function DrawerContent() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const { closeDrawer } = useNavigationChrome();
  const { isFeatureEnabled } = useFeatureAccess();

  function navigateTo(href: string) {
    debugLogEvent('navigation-drawer.navigate', { variant: 'shared', href });
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
  const settingsActive = isRouteActive(pathname, '/settings');

  return (
    <>
      <View style={[styles.header, { borderBottomColor: withAlpha(colors.text, 0.15) }]}>
        <Txt variant="brand">fam</Txt>
        <Pressable
          onPress={closeDrawer}
          accessibilityRole="button"
          accessibilityLabel="Menü schließen"
          style={[styles.closeButton, { backgroundColor: colors.backgroundSoft }]}
          hitSlop={8}>
          <Txt variant="glyph">×</Txt>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {visibleGroups.map((group) => (
          <View
            key={group.title}
            style={[
              styles.group,
              group.key === 'household' && [
                styles.householdGroup,
                { borderTopColor: withAlpha(colors.text, 0.15) },
              ],
            ]}>
            {group.hideTitle ? null : (
              <Txt variant="eyebrow" style={styles.groupTitle}>
                {group.title.toUpperCase()}
              </Txt>
            )}
            {group.routes.map((route) => {
              const isActive = isRouteActive(pathname, route.href);
              return (
                <Pressable
                  key={route.href}
                  onPress={() => navigateTo(route.href)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  style={[styles.navRow, isActive && { backgroundColor: colors.backgroundSoft }]}>
                  <View style={styles.navIcon}>
                    {route.icon === 'calendarDay' ? (
                      <CalendarDayIcon size={35} />
                    ) : (
                      <FamIcon
                        name={route.icon}
                        size={35}
                        color={isActive ? colors.basil : colors.text}
                      />
                    )}
                  </View>
                  <Txt
                    variant="navigation"
                    tone="primary"
                    weight={isActive ? '700' : '500'}
                    style={styles.navLabel}>
                    {route.label}
                  </Txt>
                  <Txt tone="secondary">›</Txt>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <Pressable
        onPress={() => navigateTo('/settings')}
        accessibilityRole="button"
        accessibilityState={{ selected: settingsActive }}
        style={[styles.manageRow, { backgroundColor: colors.backgroundSoft }]}>
        <View style={styles.settingsIcon}>
          <FamIcon name="settings" size={37} color={settingsActive ? colors.basil : colors.text} />
        </View>
        <Txt
          variant="navigation"
          tone="primary"
          weight={settingsActive ? '700' : '500'}
          style={styles.navLabel}>
          Einstellungen
        </Txt>
        <Txt tone="secondary">›</Txt>
      </Pressable>
    </>
  );
}
