import { GlassView } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { BUTTON_DEPTH, radius } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useGlassAvailable } from '@/components/ui/glass-card';
import { medium as hapticMedium } from '@/lib/haptics';

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
  const { colors } = useTheme();
  const canUseGlass = useGlassAvailable();
  const depth = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: depth.value }],
  }));
  const backgroundColor = active ? colors.backgroundSoft : colors.backgroundElement;

  const face = {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderCurve: 'continuous' as const,
  };

  return (
    <View
      style={{
        paddingBottom: BUTTON_DEPTH,
        borderRadius: radius.lg,
        backgroundColor: colors.border,
      }}>
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
            depth.value = withTiming(BUTTON_DEPTH, { duration: 60 });
          }}
          onPressOut={() => {
            depth.value = withSpring(0, { damping: 14, stiffness: 320, mass: 0.5 });
          }}
          style={[
            face,
            !canUseGlass && {
              backgroundColor,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}>
          {canUseGlass ? (
            <GlassView glassEffectStyle="regular" isInteractive style={face}>
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
