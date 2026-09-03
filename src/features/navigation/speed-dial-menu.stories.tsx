import type { Meta, StoryObj } from '@storybook/react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FamIcon, PlusIcon } from '@/components/icons/fam-icon';
import { ThemedText } from '@/components/theme/themed-text';
import { FloatingActionButton } from '@/components/ui/buttons';
import { getSpeedDialOptions } from '@/constants/feature-registry';
import { IconSize, Layout, Spacing } from '@/constants/layout';
import { useDeferredMount } from '@/hooks/use-deferred-mount';
import { useTheme } from '@/hooks/use-theme';

// Die echte SpeedDialMenu/GlobalAddButton haengen an useNavigationChrome
// (Modal-Sichtbarkeit ueber einen globalen Store), Router, useFabPosition und
// useFeatureAccess (Session/Feature-Flags) — zu viel App-Kontext fuer Storybook.
// Original nutzt ein natives <Modal>, das seinen eigenen Vollbild-Koordinatenraum
// aufspannt — im (kleineren) Storybook-Preview-Canvas landet das Menue dadurch
// verschoben ueber dem FAB statt mit Abstand darueber. Deshalb hier bewusst kein
// Modal: gleicher Elternbaum wie der FAB, Fade per Reanimated statt Modal-Animation.
// Verhalten bleibt gleich: FAB oeffnet nur (kein Toggle), schliessen nur ueber
// Backdrop oder eine Option.
function SpeedDialPreview({ isRight = true }: { isRight?: boolean }) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const mounted = useDeferredMount(isOpen, 180);
  const opacity = useSharedValue(0);
  const speedDialOptions = getSpeedDialOptions();

  useEffect(() => {
    opacity.value = withTiming(isOpen ? 1 : 0, { duration: 180 });
  }, [isOpen, opacity]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Der ausloesende Button (GlobalAddButton in app-shell.tsx) — oeffnet nur, schliesst nie.
      Zuerst gerendert, damit das Menue (unten) im selben Stacking-Kontext darueber liegt. */}
      <View
        pointerEvents="box-none"
        className={`app-shell-wrap ${isRight ? 'items-end' : 'items-start'}`}>
        <FloatingActionButton label="Neu hinzufügen" onPress={() => setIsOpen(true)}>
          <PlusIcon color={theme.onAccent} />
        </FloatingActionButton>
      </View>

      {mounted ? (
        <Animated.View
          pointerEvents={isOpen ? 'auto' : 'none'}
          style={[StyleSheet.absoluteFill, overlayStyle]}>
          <Pressable
            className="speed-dial-backdrop"
            onPress={() => setIsOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Schließen"
          />
          <View
            pointerEvents="box-none"
            className={`speed-dial-column ${isRight ? 'items-end' : 'items-start'}`}
            style={{
              [isRight ? 'right' : 'left']: Spacing.four,
              bottom: Layout.floatingActionAreaHeight,
            }}>
            {speedDialOptions.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => setIsOpen(false)}
                accessibilityRole="button"
                className={`speed-dial-row ${isRight ? 'flex-row-reverse' : ''}`}>
                <View
                  className="speed-dial-chip"
                  style={{ backgroundColor: option.backgroundColor, borderCurve: 'continuous' }}>
                  <FamIcon name={option.icon} size={IconSize.nav} />
                </View>
                <ThemedText type="smallBold" className="speed-dial-label">
                  {option.title}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const meta = {
  title: 'Navigation/SpeedDialMenu',
  component: SpeedDialPreview,
  decorators: [
    (Story) => (
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <Story />
      </SafeAreaProvider>
    ),
  ],
  parameters: {
    noSafeArea: true,
    notes:
      'Tippe auf den +-Button zum Öffnen; schließen über Backdrop oder Option (wie im Original).',
  },
} satisfies Meta<typeof SpeedDialPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RightPositioned: Story = {
  args: { isRight: true },
};

export const LeftPositioned: Story = {
  args: { isRight: false },
};
