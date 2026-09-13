import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { BUTTON_DEPTH, withAlpha } from '@/components/theme/index';
import { Press } from '@/constants/ui';

type FloatingActionButtonProps = {
  label: string;
  onPress: () => void;
  children: ReactNode;
};

const styles = StyleSheet.create((theme) => ({
  outer: {
    paddingBottom: BUTTON_DEPTH,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.buttonPrimaryDepth,
  },
  face: {
    width: 72,
    height: 72,
    minWidth: 72,
    minHeight: 72,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: theme.accent,
    boxShadow: `0 10px 22px ${withAlpha(theme.shadowSheet, 0.22)}`,
    borderCurve: 'continuous',
    elevation: 8,
    shadowColor: theme.shadowSheet,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 11,
  },
}));

export function FloatingActionButton({ label, onPress, children }: FloatingActionButtonProps) {
  const depth = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reducedMotion ? 0 : depth.value }],
  }));

  return (
    <View style={styles.outer}>
      <Animated.View style={faceStyle}>
        <Press
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={styles.face}
          onPressIn={() => {
            if (!reducedMotion) {
              depth.value = withTiming(BUTTON_DEPTH, { duration: 60 });
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
