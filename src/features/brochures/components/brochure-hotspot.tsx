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
import { borderWidth, font, radius, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
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
    scale.value = withSpring(isActive ? 1.05 : 1, { damping: 15, stiffness: 200 });
    glow.value = isLinkout
      ? withRepeat(
          withSequence(withTiming(0.62, { duration: 900 }), withTiming(0.28, { duration: 900 })),
          -1,
          true,
        )
      : withDelay(
          700,
          withSequence(withTiming(1, { duration: 220 }), withTiming(0.72, { duration: 700 })),
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
          <Txt variant="body" tone="onAccent" style={styles.linkoutArrow}>
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
    marginLeft: -(space.sm + space.xs / 4),
    marginTop: -(space.sm + space.xs / 4),
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
  linkoutArrow: {
    fontSize: font.sizes.base,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'center',
  },
  activeBorder: {
    borderWidth: borderWidth.strong,
    borderRadius: radius.sm,
  },
});
