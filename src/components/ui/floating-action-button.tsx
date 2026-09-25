import type { ReactNode } from 'react';
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
};

export function FloatingActionButton({ label, onPress, children }: FloatingActionButtonProps) {
  const depth = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reducedMotion ? 0 : depth.value }],
  }));

  return (
    <View style={floatingActionButtonStyles.outer}>
      <Animated.View style={faceStyle}>
        <Press
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
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
