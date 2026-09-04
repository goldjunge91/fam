import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { withAlpha } from '@/components/theme/index';
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
          backgroundColor: isLinkout ? colors.basil : colors.inverse,
          borderColor: isActive ? colors.basil : withAlpha(colors.inverse, 0.86),
          zIndex: isActive ? 100 : 1,
        },
        animatedStyle,
      ]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.aura, { borderColor: colors.basil }, auraStyle]}
      />
      <Pressable
        role="button"
        aria-label={`${hotspot.title}${hotspot.discount ? `, ${hotspot.discount}` : ''}`}
        style={styles.pressableArea}
        onPress={() => onPress(hotspot)}
        android_ripple={{ color: withAlpha(colors.basil, 0.2) }}>
        {isActive && <View style={[styles.activeBorder, { borderColor: colors.basil }]} />}
        {isLinkout ? (
          <Txt variant="body" tone="inverse" style={styles.linkoutArrow}>
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
    marginLeft: -9,
    marginTop: -9,
    borderRadius: 12,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  pressableArea: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  aura: {
    ...StyleSheet.absoluteFill,
    margin: -8,
    borderRadius: 20,
    borderWidth: 8,
  },
  linkoutArrow: { fontSize: 16, fontWeight: '800', lineHeight: 18, textAlign: 'center' },
  activeBorder: {
    ...StyleSheet.absoluteFill,
    borderWidth: 2,
    borderRadius: 12,
  },
});
