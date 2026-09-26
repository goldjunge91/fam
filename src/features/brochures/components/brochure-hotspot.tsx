import React from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { borderWidth, radius, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { motion } from '@/constants/motion';
import { Txt } from '@/constants/ui';
import type { Hotspot } from '../types';

interface BrochureHotspotProps {
  hotspot: Hotspot;
  onPress: (hotspot: Hotspot) => void;
  isActive: boolean;
  isVisible: boolean;
}

export function BrochureHotspot({ hotspot, onPress, isActive, isVisible }: BrochureHotspotProps) {
  const { colors } = useTheme();
  const isLinkout = hotspot.kind === 'linkout';
  const scale = useSharedValue(1);
  const glow = useSharedValue(isLinkout ? 0.35 : 0.72);

  React.useEffect(() => {
    scale.value = withSpring(isActive ? 1.05 : 1, motion.spring.interactive);
    glow.value = isLinkout
      ? withRepeat(
          withSequence(
            withTiming(0.62, { duration: motion.attentionPulse }),
            withTiming(0.28, { duration: motion.attentionPulse }),
          ),
          -1,
          true,
        )
      : withDelay(
          motion.progress,
          withSequence(
            withTiming(1, { duration: motion.navigation }),
            withTiming(0.72, { duration: motion.progress }),
          ),
        );
  }, [glow, isActive, isLinkout, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const auraStyle = useAnimatedStyle(() => ({
    opacity: isLinkout ? glow.value : 0,
    transform: [{ scale: 1 + glow.value * 0.35 }],
  }));

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.hotspotContainer,
        {
          left: `${hotspot.x + hotspot.width / 2}%`,
          top: `${hotspot.y + hotspot.height / 2}%`,
          backgroundColor: isLinkout ? colors.accent : colors.onAccent,
          borderColor: isActive ? colors.accent : withAlpha(colors.onAccent, 0.86),
          zIndex: isActive ? 100 : 1,
        },
        animatedStyle,
      ]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.aura, { borderColor: colors.accent }, auraStyle]}
      />
      <Pressable
        role="button"
        aria-label={`${hotspot.title}${hotspot.discount ? `, ${hotspot.discount}` : ''}`}
        style={styles.pressableArea}
        onPress={() => onPress(hotspot)}
        android_ripple={{ color: withAlpha(colors.accent, 0.2) }}>
        {isActive && (
          <View
            style={[StyleSheet.absoluteFill, styles.activeBorder, { borderColor: colors.accent }]}
          />
        )}
        {isLinkout ? (
          <Txt variant="glyphSmall" tone="onAccent" weight="800" center>
            ↗
          </Txt>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hotspotContainer: {
    position: 'absolute',
    width: 18,
    height: 18,
    marginLeft: -space.md,
    marginTop: -space.md,
    borderRadius: radius.sm,
    borderWidth: borderWidth.base,
  },
  pressableArea: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: radius.sm,
  },
  aura: {
    margin: -space.sm,
    borderRadius: radius.lg,
    borderWidth: 8,
  },
  activeBorder: {
    borderWidth: borderWidth.strong,
    borderRadius: radius.sm,
  },
});
