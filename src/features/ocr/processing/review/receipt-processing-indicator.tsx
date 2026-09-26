import { Feather } from '@expo/vector-icons';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { useTheme } from '@/components/theme/ThemeProvider';

const styles = StyleSheet.create((theme) => ({
  container: {
    alignItems: 'center',
    gap: theme.space.md,
    paddingVertical: theme.space.lg,
  },
  receipt: {
    width: 132,
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.backgroundElement,
  },
  pulse: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderWidth: theme.borderWidth.strong,
    borderRadius: theme.radius.pill,
    borderColor: theme.accent,
  },
  scanBeam: {
    position: 'absolute',
    left: theme.space.sm,
    right: theme.space.sm,
    height: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accent,
  },
  lines: {
    width: 66,
    gap: theme.space.sm,
  },
  line: {
    height: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.border,
  },
  shortLine: {
    width: '68%',
  },
}));

type ReceiptProcessingIndicatorProps = {
  label: string;
};

/** Gives the OCR wait state a visible, non-blocking sense of progress. */
export function ReceiptProcessingIndicator({ label }: ReceiptProcessingIndicatorProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 0;
      return;
    }

    progress.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );

    return () => cancelAnimation(progress);
  }, [progress, reducedMotion]);

  const scanBeamStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * 104 - 52 }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + progress.value * 0.22,
    transform: [{ scale: 0.92 + progress.value * 0.08 }],
  }));

  return (
    <View
      testID="receipt-processing-animation"
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={styles.container}>
      <View style={styles.receipt}>
        <Animated.View pointerEvents="none" style={[styles.pulse, pulseStyle]} />
        <View style={styles.lines}>
          <View style={styles.line} />
          <View style={styles.line} />
          <View style={[styles.line, styles.shortLine]} />
        </View>
        <Feather name="file-text" size={34} color={colors.accent} />
        <Animated.View pointerEvents="none" style={[styles.scanBeam, scanBeamStyle]} />
      </View>
    </View>
  );
}
