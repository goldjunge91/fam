import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FamIcon } from '@/components/icons/fam-icon';
import { radius, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { getSpeedDialOptions } from '@/constants/feature-registry';
import { Txt } from '@/constants/ui';
import { DEFAULT_FAB_POSITION, useFabPosition } from '@/features/navigation/fab-position-settings';
import { useFeatureAccess } from '@/features/settings/use-feature-access';
import { useNavigationChrome } from './navigation-chrome-provider';

const styles = StyleSheet.create({
  backdrop: StyleSheet.absoluteFill,
  column: {
    position: 'absolute',
    gap: space.md,
  },
  columnLeft: {
    alignItems: 'flex-start',
  },
  columnRight: {
    alignItems: 'flex-end',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  chip: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
  },
  overlay: {
    zIndex: 19,
  },
});

export function SpeedDialMenu() {
  const { isQuickAddOpen } = useNavigationChrome();
  const pathname = usePathname();
  const isBrochureRoute = pathname === '/brochures' || pathname.includes('/brochures/');

  if (isBrochureRoute) return null;

  return <SpeedDialMenuContent isOpen={isQuickAddOpen} />;
}

function SpeedDialMenuContent({ isOpen }: { isOpen: boolean }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { closeQuickAdd } = useNavigationChrome();
  const { data: position = DEFAULT_FAB_POSITION } = useFabPosition();
  const { isFeatureEnabled } = useFeatureAccess();
  const isRight = position !== 'left';

  function go(href: string) {
    closeQuickAdd();
    router.push(href as Parameters<typeof router.push>[0]);
  }

  const speedDialOptions = getSpeedDialOptions();
  const visibleOptions = speedDialOptions.filter((option) => isFeatureEnabled(option.feature));

  useEffect(() => {
    if (!isOpen) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeQuickAdd();
      return true;
    });
    return () => subscription.remove();
  }, [closeQuickAdd, isOpen]);

  return (
    <View
      accessibilityViewIsModal={isOpen}
      accessibilityElementsHidden={!isOpen}
      importantForAccessibility={isOpen ? 'yes' : 'no-hide-descendants'}
      pointerEvents={isOpen ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, styles.overlay, isOpen ? styles.visible : styles.hidden]}>
      <Pressable
        style={styles.backdrop}
        onPress={closeQuickAdd}
        accessibilityRole="button"
        accessibilityLabel="Schließen"
      />
      <View
        pointerEvents="box-none"
        style={[
          styles.column,
          isRight ? styles.columnRight : styles.columnLeft,
          {
            // Gleiche Außenkante wie der globale FAB im App-Shell-Container.
            [isRight ? 'right' : 'left']: space.xxl + space.xs,
            // Die kompakte Liste endet mit konstantem Abstand oberhalb des FAB.
            bottom: insets.bottom + space.xxxl + space.xl,
          },
        ]}>
        {visibleOptions.map((option) => (
          <Pressable
            key={option.title}
            onPress={() => go(typeof option.href === 'function' ? option.href() : option.href)}
            accessibilityRole="button"
            // Rechts stehen Icon und Label in umgekehrter Reihenfolge.
            style={[styles.row, isRight && styles.rowReverse]}>
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: option.backgroundColor,
                  borderCurve: 'continuous',
                  boxShadow: `0 4px 10px ${withAlpha(colors.shadowCard, 0.14)}`,
                },
              ]}>
              <FamIcon name={option.icon} size={space.xl} />
            </View>
            <View
              style={[
                styles.label,
                { backgroundColor: colors.backgroundElement, borderColor: colors.border },
              ]}>
              <Txt variant="body" weight="700">
                {option.title}
              </Txt>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
