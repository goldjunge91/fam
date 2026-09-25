import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { BUTTON_DEPTH, motion } from '@/components/theme/index';
import { floatingActionButtonStyles, Press } from '@/constants/ui';

type FloatingActionButtonProps = {
  label: string;
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function FloatingActionButton({
  label,
  onPress,
  children,
  disabled = false,
  style,
}: FloatingActionButtonProps) {
  const depth = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reducedMotion ? 0 : depth.value }],
  }));

  return (
    <View style={[floatingActionButtonStyles.outer, style]}>
      <Animated.View style={faceStyle}>
        <Press
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          style={floatingActionButtonStyles.face}
          onPressIn={() => {
            if (!reducedMotion) {
              depth.value = withTiming(BUTTON_DEPTH, { duration: motion.pressIn });
            }
          }}
          onPressOut={() => {
            depth.value = reducedMotion
              ? 0
              : withSpring(0, { damping: 14, stiffness: 320, mass: 0.5 });
          }}>
          {children}
        </Press>
      </Animated.View>
    </View>
  );
}
