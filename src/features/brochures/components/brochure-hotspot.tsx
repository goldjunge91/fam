import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Hotspot } from '../types';

interface BrochureHotspotProps {
  hotspot: Hotspot;
  onPress: (hotspot: Hotspot) => void;
  isActive: boolean;
  isVisible: boolean;
}

export function BrochureHotspot({ hotspot, onPress, isActive, isVisible }: BrochureHotspotProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withSpring(isActive ? 1.05 : 1, { damping: 15, stiffness: 200 });
  }, [isActive, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.hotspotContainer,
        {
          left: `${hotspot.x}%`,
          top: `${hotspot.y}%`,
          width: `${hotspot.width}%`,
          height: `${hotspot.height}%`,
        },
        {
          borderColor: theme.accent,
          backgroundColor: withAlpha(theme.accent, isActive ? 0.24 : 0.12),
          zIndex: isActive ? 100 : 1,
        },
        animatedStyle,
      ]}>
      <Pressable
        role="button"
        aria-label={`${hotspot.title}${hotspot.discount ? `, ${hotspot.discount}` : ''}`}
        style={styles.pressableArea}
        onPress={() => onPress(hotspot)}
        android_ripple={{ color: withAlpha(theme.accent, 0.2) }}>
        {isActive && <View style={[styles.activeBorder, { borderColor: theme.onAccent }]} />}
        {hotspot.discount ? (
          <View style={[styles.discountBadge, { backgroundColor: theme.accent }]}>
            <Text style={[styles.discountText, { color: theme.onAccent }]}>{hotspot.discount}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hotspotContainer: {
    position: 'absolute',
    borderRadius: 8,
    borderWidth: 2,
    overflow: 'visible',
  },
  pressableArea: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  activeBorder: {
    ...StyleSheet.absoluteFill,
    borderWidth: 2,
    borderRadius: 8,
  },
  discountBadge: {
    position: 'absolute',
    right: 4,
    top: 4,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  discountText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
