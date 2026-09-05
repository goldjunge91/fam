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
import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { getDrawerGroups } from '@/constants/feature-registry';
import { Txt } from '@/constants/ui';
import { useFeatureAccess } from '@/features/settings/use-feature-access';
import { useDeferredMount } from '@/hooks/use-deferred-mount';
import { debugLogEvent } from '@/lib/debug-log';
import { useNavigationChrome } from './navigation-chrome-provider';

const DRAWER_WIDTH_RATIO = 0.84;
const ANDROID_DRAWER_CLOSE_DELAY_MS = 300;
type DrawerRoute = Parameters<typeof router.push>[0];

debugLogEvent('navigation-drawer.module-loaded', { variant: 'android' });

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

  function navigateTo(href: string) {
    debugLogEvent('navigation-drawer.navigate', { variant: 'android', href });
    // Die neue Route bleibt unter dem nativen Modal abgeschirmt, bis der Tap
    // abgeschlossen ist. So kann Android nicht in den darunterliegenden Screen
    // durchreichen und dort versehentlich ein zweites Sheet öffnen.
    router.push(href as DrawerRoute);
    setTimeout(closeDrawer, ANDROID_DRAWER_CLOSE_DELAY_MS);
  }

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
          // Laufzeitwert für die Abdunklung.
          style={{ backgroundColor: withAlpha(colors.text, 0.3) }}
          onPress={closeDrawer}
          accessibilityRole="button"
          accessibilityLabel="Menü schließen"
        />
        <Animated.View
          className="drawer"
          // Laufzeitwerte für Insets, Breite, Hintergrund und Schatten.
          style={[
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
          {isDrawerOpen && <DrawerContent onNavigate={navigateTo} />}
        </Animated.View>
      </View>
    </Modal>
  );
}

// Beim Schließen den Drawer-Inhalt vollständig unmounten.
function DrawerContent({ onNavigate }: { onNavigate: (href: string) => void }) {
  const { colors } = useTheme();
  const pathname = usePathname();
  const { closeDrawer } = useNavigationChrome();
  const { isFeatureEnabled } = useFeatureAccess();

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
      <View className="drawer-header">
        <Txt variant="title" className="drawer-brand">
          fam
        </Txt>
        <Pressable
          onPress={closeDrawer}
          accessibilityRole="button"
          accessibilityLabel="Menü schließen"
          className="drawer-close-btn"
          hitSlop={8}>
          <Txt variant="subheading" tone="secondary" weight="400" className="drawer-close-glyph">
            ×
          </Txt>
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {visibleGroups.map((group) => (
          <View
            key={group.title}
            className={`drawer-group ${group.key === 'household' ? 'drawer-group-household' : ''}`}>
            {group.hideTitle ? null : (
              <Txt variant="body" tone="secondary" className="drawer-group-title">
                {group.title.toUpperCase()}
              </Txt>
            )}
            {group.routes.map((route) => {
              const isActive = isRouteActive(pathname, route.href);
              return (
                <Pressable
                  key={route.href}
                  onPress={() => onNavigate(route.href)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  className="drawer-nav-row"
                  style={isActive ? { backgroundColor: colors.backgroundSoft } : undefined}>
                  <View className="drawer-nav-icon">
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
                    variant="body"
                    tone="primary"
                    weight={isActive ? '700' : '500'}
                    className={`drawer-nav-label ${isActive ? 'drawer-nav-label-active' : ''}`}>
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
        onPress={() => onNavigate('/settings')}
        accessibilityRole="button"
        accessibilityState={{ selected: settingsActive }}
        className="drawer-manage-row">
        <View className="drawer-settings-icon">
          <FamIcon name="settings" size={37} color={settingsActive ? colors.basil : colors.text} />
        </View>
        <Txt
          variant="body"
          tone="primary"
          weight={settingsActive ? '700' : '500'}
          className="drawer-nav-label">
          Einstellungen
        </Txt>
        <Txt tone="secondary">›</Txt>
      </Pressable>
    </>
  );
}
