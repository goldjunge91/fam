import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { BUTTON_DEPTH, radius, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';

type FloatingActionButtonProps = {
  label: string;
  onPress: () => void;
  children: ReactNode;
};

export function FloatingActionButton({ label, onPress, children }: FloatingActionButtonProps) {
  const { colors } = useTheme();
  const depth = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: depth.value }, { scale: pressScale.value }],
  }));

  return (
    <View
      style={{
        paddingBottom: BUTTON_DEPTH,
        borderRadius: radius.pill,
        backgroundColor: colors.buttonPrimaryDepth,
      }}>
      <Animated.View style={faceStyle}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={({ pressed }) => [
            styles.face,
            {
              backgroundColor: colors.accent,
              boxShadow: `0 10px 22px ${withAlpha(colors.shadowSheet, 0.22)}`,
              borderCurve: 'continuous',
              elevation: 8,
              shadowColor: colors.shadowSheet,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.22,
              shadowRadius: 11,
            },
            pressed && styles.pressed,
          ]}
          onPressIn={() => {
            depth.value = withTiming(BUTTON_DEPTH, { duration: 60 });
            pressScale.value = withTiming(0.96, { duration: 60 });
          }}
          onPressOut={() => {
            depth.value = withSpring(0, { damping: 14, stiffness: 320, mass: 0.5 });
            pressScale.value = withSpring(1, { damping: 14, stiffness: 320, mass: 0.5 });
          }}>
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    width: 72,
    height: 72,
    minWidth: 72,
    minHeight: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.9,
  },
});
