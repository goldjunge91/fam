import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/theme/themed-text';
import { withAlpha } from '@/constants/theme';
import type { CardSize } from '@/features/dashboard/registry';
import { useTheme } from '@/hooks/use-theme';
import { useDashboardDrag } from './drag-context';

type JiggleWrapperProps = {
  id: string;
  isEditing: boolean;
  index: number;
  totalCards?: number;
  size?: CardSize;
  onToggleSize: () => void;
  onDelete?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDrop?: (fromIndex: number, toIndex: number) => void;
  children: ReactNode;
};

/** Kapselt Wackeln, Drag-and-Drop und Edit-Aktionen einer Dashboard-Card. */
export function JiggleWrapper({
  id: _id,
  isEditing,
  index,
  totalCards = 1,
  size = 'large',
  onToggleSize,
  onDelete,
  onDragStart,
  onDragEnd,
  onDrop,
  children,
}: JiggleWrapperProps) {
  const theme = useTheme();
  const dragCtx = useDashboardDrag();

  const rotation = useSharedValue(0);
  const translateY = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(1);
  const isDragging = useSharedValue(false);

  useEffect(() => {
    if (isEditing) {
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
  }, [isEditing, index, rotation, translateY]);

  function triggerHaptic() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleStart() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onDragStart) onDragStart();
  }

  function handleDropCommit(fromIdx: number, toIdx: number) {
    if (onDragEnd) onDragEnd();
    if (onDrop && fromIdx !== toIdx) {
      onDrop(fromIdx, toIdx);
    }
  }

  const panGesture = Gesture.Pan()
    .enabled(isEditing)
    .onStart(() => {
      isDragging.value = true;
      scale.value = 1.04;
      zIndex.value = 999;
      if (dragCtx) {
        dragCtx.activeDragIndex.value = index;
        dragCtx.hoverIndex.value = index;
        dragCtx.isDraggingShared.value = true;
      }
      runOnJS(handleStart)();
    })
    .onUpdate((event) => {
      dragX.value = event.translationX;
      dragY.value = event.translationY;

      if (dragCtx) {
        dragCtx.dragTranslationY.value = event.translationY;
        const rawTarget = index + Math.round(event.translationY / dragCtx.rowHeight);
        const clamped = Math.max(0, Math.min(totalCards - 1, rawTarget));
        if (dragCtx.hoverIndex.value !== clamped) {
          dragCtx.hoverIndex.value = clamped;
          runOnJS(triggerHaptic)();
        }
      }
    })
    .onFinalize(() => {
      isDragging.value = false;
      let targetSlot = index;
      if (dragCtx) {
        targetSlot = dragCtx.hoverIndex.value;
        dragCtx.activeDragIndex.value = -1;
        dragCtx.hoverIndex.value = -1;
        dragCtx.isDraggingShared.value = false;
      }

      dragX.value = 0;
      dragY.value = 0;
      scale.value = 1;
      zIndex.value = 1;
      runOnJS(handleDropCommit)(index, targetSlot);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value },
      { translateY: translateY.value + dragY.value },
      { rotateZ: `${rotation.value}deg` },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
  }));

  const containerLayout = size === 'small' ? styles.smallContainer : styles.largeContainer;
  const contentLayout = size === 'small' ? styles.smallCardContent : styles.largeCardContent;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.baseContainer, containerLayout, animatedStyle]}>
        <View pointerEvents={isEditing ? 'none' : 'auto'} style={contentLayout}>
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
                backgroundColor: theme.danger,
                boxShadow: `0 2px 8px ${withAlpha(theme.shadowCard, 0.25)}`,
              },
            ]}>
            <ThemedText style={styles.deleteBadgeText}>−</ThemedText>
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
                backgroundColor: theme.accent,
                boxShadow: `0 2px 8px ${withAlpha(theme.shadowCard, 0.25)}`,
              },
            ]}>
            <ThemedText style={styles.badgeText}>⤢</ThemedText>
          </Pressable>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  baseContainer: {
    position: 'relative',
    overflow: 'visible',
  },
  largeContainer: {
    width: '100%',
    marginBottom: 15,
  },
  smallContainer: {
    flex: 1,
    height: 138,
  },
  largeCardContent: {
    width: '100%',
  },
  smallCardContent: {
    width: '100%',
    height: 138,
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
  deleteBadgeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 18,
  },
});
