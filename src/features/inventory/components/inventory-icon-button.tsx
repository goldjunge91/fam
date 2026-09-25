import { GlassView } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { BUTTON_DEPTH } from '@/components/theme/index';
import { useGlassAvailable } from '@/components/ui/glass-card';
import { uiShadowStyles } from '@/constants/ui-shadow';
import { medium as hapticMedium } from '@/lib/platform/haptics';

const ICON_BUTTON_DEPTH = BUTTON_DEPTH / 2;

const styles = StyleSheet.create((theme) => ({
  outer: {
    paddingBottom: ICON_BUTTON_DEPTH,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.border,
  },
  activeOuter: {
    paddingBottom: 0,
    backgroundColor: 'transparent',
  },
  face: {
    width: 54,
    height: 54,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundElement,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  activeFace: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  glass: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
}));

type InventoryIconButtonProps = {
  label: string;
  onPress: () => void;
  children: ReactNode;
  active?: boolean;
};

/** Kompakter Glass-Button mit derselben 3D-Tiefe wie die übrigen Hauptaktionen. */
export function InventoryIconButton({
  label,
  onPress,
  children,
  active = false,
}: InventoryIconButtonProps) {
  const canUseGlass = useGlassAvailable();
  const depth = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: depth.value }],
  }));
  return (
    <View
      style={[
        styles.outer,
        active ? uiShadowStyles.none : uiShadowStyles.floatingControlBottom,
        active && styles.activeOuter,
      ]}>
      <Animated.View style={faceStyle}>
        <Pressable
          onPress={() => {
            hapticMedium();
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ expanded: active }}
          onPressIn={() => {
            depth.value = withTiming(ICON_BUTTON_DEPTH, { duration: 60 });
          }}
          onPressOut={() => {
            depth.value = withSpring(0, { damping: 14, stiffness: 320, mass: 0.5 });
          }}
          style={[styles.face, active && styles.activeFace]}>
          {canUseGlass && !active ? (
            <GlassView glassEffectStyle="regular" isInteractive style={styles.glass}>
              {children}
            </GlassView>
          ) : (
            children
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}
