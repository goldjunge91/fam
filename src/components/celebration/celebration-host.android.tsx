import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { font, type Palette, radius, shadow } from '@/components/theme';
import { useTheme } from '@/components/theme/ThemeProvider';
import { type CelebrationBurst, subscribeToCelebrations } from '@/lib/celebration';

const PIECES = 28;
const PIECE_IDS = Array.from({ length: PIECES }, (_, index) => `piece-${index}`);

function ConfettiPiece({
  index,
  seed,
  width,
  height,
  colors,
}: {
  index: number;
  seed: number;
  width: number;
  height: number;
  colors: Palette;
}) {
  const random = (salt: number) => {
    const value = Math.sin((index + 1) * 12.9898 + seed * 78.233 + salt * 3.7) * 43758.5453;
    return value - Math.floor(value);
  };

  const startX = width / 2 + (random(1) - 0.5) * 80;
  const startY = height * 0.42;
  const driftX = (random(2) - 0.5) * width * 0.9;
  const fall = height * (0.45 + random(3) * 0.4);
  const rise = -(60 + random(4) * 140);
  const size = 7 + Math.floor(random(5) * 7);
  const rotationAmount = (random(8) > 0.5 ? 1 : -1) * (720 + random(9) * 720);
  const colorPalette = [
    colors.basil,
    colors.butter,
    colors.tomato,
    colors.grape,
    colors.sky,
    colors.carrot,
    colors.pink,
    colors.teal,
  ];
  const color = colorPalette[index % colorPalette.length];
  const round = random(6) > 0.5;
  const duration = 1100 + Math.floor(random(7) * 700);

  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withSequence(
      withTiming(rise, { duration: 320, easing: Easing.out(Easing.quad) }),
      withTiming(fall, { duration, easing: Easing.in(Easing.quad) }),
    );
    translateX.value = withTiming(driftX, {
      duration: duration + 320,
      easing: Easing.out(Easing.cubic),
    });
    rotation.value = withTiming(rotationAmount, {
      duration: duration + 320,
      easing: Easing.linear,
    });
    opacity.value = withDelay(duration, withTiming(0, { duration: 320 }));
  }, [driftX, duration, fall, rise, rotation, rotationAmount, opacity, translateX, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: startX,
          top: startY,
          width: size,
          height: size * (round ? 1 : 1.6),
          backgroundColor: color,
          borderRadius: round ? size : 2,
        },
        animatedStyle,
      ]}
    />
  );
}

function Badge({ message, colors }: { message: string; colors: Palette }) {
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.08, { damping: 8, stiffness: 320 }),
      withSpring(1, { damping: 12, stiffness: 260 }),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 160 }),
      withDelay(1100, withTiming(0, { duration: 320 })),
    );
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.badge, { backgroundColor: colors.shadowSheet }, animatedStyle]}>
      <Text style={[styles.badgeText, { color: colors.onAccent }]}>{message}</Text>
    </Animated.View>
  );
}

export function CelebrationHost() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const [burst, setBurst] = useState<CelebrationBurst | null>(null);

  useEffect(() => subscribeToCelebrations(setBurst), []);

  useEffect(() => {
    if (!burst) return;
    const timeout = setTimeout(() => {
      setBurst((current) => (current?.id === burst.id ? null : current));
    }, 2200);
    return () => clearTimeout(timeout);
  }, [burst]);

  if (!burst) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {PIECE_IDS.map((pieceId, index) => (
        <ConfettiPiece
          key={`${burst.id}-${pieceId}`}
          index={index}
          seed={burst.id}
          width={width}
          height={height}
          colors={colors}
        />
      ))}
      {burst.message ? (
        <View style={styles.badgeWrap} pointerEvents="none">
          <Badge key={burst.id} message={burst.message} colors={colors} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
  },
  badgeWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    ...shadow.lg,
  },
  badgeText: {
    fontWeight: '800',
    fontSize: font.sizes.lg,
  },
});
