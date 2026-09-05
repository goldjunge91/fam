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
import { medium as hapticMedium } from '@/lib/haptics';

type InventoryIconButtonProps = {
  label: string;
  onPress: () => void;
  children: ReactNode;
  active?: boolean;
};

export function InventoryIconButton({
  label,
  onPress,
  children,
  active = false,
}: InventoryIconButtonProps) {
  const { colors } = useTheme();
  const depth = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: depth.value }],
  }));
  const backgroundColor = active ? colors.backgroundSoft : colors.backgroundElement;

  return (
    <View
      className="w-[54px]"
      style={{
        paddingBottom: BUTTON_DEPTH,
        borderRadius: radius.lg,
        backgroundColor: active ? colors.border : colors.backgroundSoft,
      }}>
      <Animated.View style={faceStyle}>
        <Pressable
          className="h-[54px] w-[54px] items-center justify-center overflow-hidden"
          style={{ borderRadius: radius.lg, backgroundColor }}
          onPress={() => {
            hapticMedium();
            onPress();
          }}
          onPressIn={() => {
            depth.value = withTiming(BUTTON_DEPTH, { duration: 60 });
          }}
          onPressOut={() => {
            depth.value = withSpring(0, { damping: 14, stiffness: 320, mass: 0.5 });
          }}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ expanded: active }}>
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}
