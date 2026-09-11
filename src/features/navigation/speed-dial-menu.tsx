import { router, usePathname } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FamIcon } from '@/components/icons/fam-icon';
import { radius, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { getSpeedDialOptions } from '@/constants/feature-registry';
import { Txt } from '@/constants/ui';
import { DEFAULT_FAB_POSITION, useFabPosition } from '@/features/navigation/fab-position-settings';
import { useFeatureAccess } from '@/features/settings/use-feature-access';
import { useDeferredMount } from '@/hooks/use-deferred-mount';
import { useNavigationChrome } from './navigation-chrome-provider';

const styles = StyleSheet.create({
  backdrop: StyleSheet.absoluteFill,
  column: {
    position: 'absolute',
    gap: space.lg,
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
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    paddingHorizontal: space.lg,
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
});

export function SpeedDialMenu() {
  const { isQuickAddOpen } = useNavigationChrome();
  const pathname = usePathname();
  const isBrochureRoute = pathname === '/brochures' || pathname.includes('/brochures/');
  const mounted = useDeferredMount(isQuickAddOpen && !isBrochureRoute, 180);

  if (!mounted || isBrochureRoute) return null;

  return <SpeedDialMenuContent />;
}

function SpeedDialMenuContent() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isQuickAddOpen, closeQuickAdd } = useNavigationChrome();
  const { data: position = DEFAULT_FAB_POSITION } = useFabPosition();
  const { isFeatureEnabled } = useFeatureAccess();
  const isRight = position !== 'left';

  function go(href: string) {
    closeQuickAdd();
    router.push(href as Parameters<typeof router.push>[0]);
  }

  const speedDialOptions = getSpeedDialOptions();
  const visibleOptions = speedDialOptions.filter((option) => isFeatureEnabled(option.feature));

  return (
    <Modal visible={isQuickAddOpen} transparent animationType="fade" onRequestClose={closeQuickAdd}>
      <View style={StyleSheet.absoluteFill}>
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
              // Die Liste endet mit konstantem Abstand oberhalb des größeren FAB.
              bottom: insets.bottom + space.xxxl + space.xxl + space.sm,
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
                    boxShadow: `0 8px 20px ${withAlpha(colors.shadowCard, 0.2)}`,
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
    </Modal>
  );
}
