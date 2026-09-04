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

type FloatingActionButtonProps = {
  label: string;
  onPress: () => void;
  children: ReactNode;
};

export function FloatingActionButton({ label, onPress, children }: FloatingActionButtonProps) {
  const { colors } = useTheme();
  const depth = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: depth.value }],
  }));

  return (
    <View
      style={{
        paddingBottom: BUTTON_DEPTH,
        borderRadius: radius.pill,
        backgroundColor: colors.shadowCard,
      }}>
      <Animated.View style={faceStyle}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          className="btn-fab-corner"
          style={{ backgroundColor: colors.accent }}
          onPressIn={() => {
            depth.value = withTiming(BUTTON_DEPTH, { duration: 60 });
          }}
          onPressOut={() => {
            depth.value = withSpring(0, { damping: 14, stiffness: 320, mass: 0.5 });
          }}>
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}
