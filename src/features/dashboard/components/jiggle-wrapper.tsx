import * as Haptics from 'expo-haptics';
import { type ReactNode, useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SortableItem } from 'react-native-reanimated-dnd';
import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import type { CardSize } from '@/features/dashboard/registry';

type JiggleWrapperProps = {
  isEditing: boolean;
  index: number;
  size?: CardSize;
  fill?: boolean;
  onToggleSize: () => void;
  onDelete?: () => void;
  children: ReactNode;
};

export function JiggleWrapper({
  isEditing,
  index,
  size = 'large',
  fill = false,
  onToggleSize,
  onDelete,
  children,
}: JiggleWrapperProps) {
  const { colors } = useTheme();
  const rotation = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (isEditing) {
      // Leichter Phasenversatz pro Index fuer natuerliches iOS-Wackeln.
      const initialDirection = index % 2 === 0 ? 1 : -1;
      const duration = 120 + (index % 3) * 10;

      rotation.value = withRepeat(
        withSequence(
          withTiming(-1.2 * initialDirection, { duration }),
          withTiming(1.2 * initialDirection, { duration }),
        ),
        -1,
        true,
      );

      translateY.value = withRepeat(
        withSequence(
          withTiming(-0.8 * initialDirection, { duration: duration + 10 }),
          withTiming(0.8 * initialDirection, { duration: duration + 10 }),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(rotation);
      cancelAnimation(translateY);
      rotation.value = withTiming(0, { duration: 150 });
      translateY.value = withTiming(0, { duration: 150 });
    }
  }, [index, isEditing, rotation, translateY]);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { rotateZ: `${rotation.value}deg` }],
  }));

  const containerLayout =
    size === 'small'
      ? fill
        ? styles.smallGridContainer
        : styles.smallContainer
      : styles.largeContainer;
  const contentLayout = size === 'small' ? styles.smallCardContent : styles.largeCardContent;

  return (
    <Animated.View
      collapsable={false}
      style={[styles.baseContainer, containerLayout, fill && styles.fillContainer, animatedStyle]}>
      <View style={contentLayout} pointerEvents={isEditing ? 'none' : 'auto'}>
        {children}
      </View>

      {isEditing && fill ? (
        <SortableItem.Handle style={styles.dragHandle}>
          <View />
        </SortableItem.Handle>
      ) : null}

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
          <Txt variant="controlAction" tone="inverse" weight="700">
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
          <Txt variant="controlValueLarge" tone="inverse" weight="700">
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
  fillContainer: {
    width: '100%',
  },
  dragHandle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  smallGridContainer: {
    width: '100%',
    minHeight: 138,
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
