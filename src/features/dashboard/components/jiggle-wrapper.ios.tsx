import * as Haptics from 'expo-haptics';
import { type ReactNode, useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import type { CardSize } from '@/features/dashboard/registry';

type JiggleWrapperProps = {
  isEditing: boolean;
  paused?: boolean;
  index: number;
  size?: CardSize;
  onToggleSize: () => void;
  onDelete?: () => void;
  children: ReactNode;
};

export function JiggleWrapper({
  isEditing,
  paused = false,
  index,
  size = 'large',
  onToggleSize,
  onDelete,
  children,
}: JiggleWrapperProps) {
  const { colors } = useTheme();
  const phase = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(phase);
    if (isEditing && !paused) {
      const direction = index % 2 === 0 ? 1 : -1;
      phase.value = -direction;
      phase.value = withRepeat(
        withTiming(direction, {
          duration: 140 + (index % 3) * 10,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      );
    } else {
      phase.value = withTiming(0, { duration: 100 });
    }
    return () => cancelAnimation(phase);
  }, [index, isEditing, paused, phase]);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: phase.value * 0.5 }, { rotateZ: `${phase.value}deg` }],
  }));

  const containerLayout =
    size === 'small' && !isEditing ? styles.smallContainer : styles.largeContainer;
  const contentLayout = size === 'small' ? styles.smallCardContent : styles.largeCardContent;

  return (
    <Animated.View
      collapsable={false}
      style={[styles.baseContainer, containerLayout, animatedStyle]}>
      <View style={contentLayout} pointerEvents={isEditing ? 'none' : 'auto'}>
        {children}
      </View>

      {isEditing && onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Karte entfernen"
          onPress={() => {
            triggerHaptic();
            onDelete();
          }}
          style={[
            styles.badge,
            styles.deleteBadge,
            {
              backgroundColor: colors.tomato,
              boxShadow: `0 2px 8px ${withAlpha(colors.text, 0.25)}`,
            },
          ]}>
          <Txt variant="subheading" tone="inverse" weight="700">
            −
          </Txt>
        </Pressable>
      ) : null}

      {isEditing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kartengröße umschalten"
          onPress={() => {
            triggerHaptic();
            onToggleSize();
          }}
          style={[
            styles.badge,
            styles.resizeBadge,
            {
              backgroundColor: colors.basil,
              boxShadow: `0 2px 8px ${withAlpha(colors.text, 0.25)}`,
            },
          ]}>
          <Txt variant="body" tone="inverse" weight="700">
            ⤢
          </Txt>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  baseContainer: {
    position: 'relative',
    overflow: 'visible',
  },
  largeContainer: {
    width: '100%',
  },
  smallContainer: {
    flex: 1,
    minHeight: 138,
  },
  largeCardContent: {
    width: '100%',
  },
  smallCardContent: {
    width: '100%',
    minHeight: 138,
  },
  badge: {
    position: 'absolute',
    top: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  deleteBadge: {
    left: -2,
  },
  resizeBadge: {
    right: -2,
  },
});
