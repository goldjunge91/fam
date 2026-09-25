import * as Haptics from 'expo-haptics';
import { type ReactNode, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { dashboardCardSizes, radius } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { uiShadowStyles } from '@/constants/ui-shadow';
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
  const { t } = useTranslation();
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
          accessibilityLabel={t('dashboard.edit.removeCard')}
          onPress={() => {
            triggerHaptic();
            onDelete();
          }}
          style={[
            styles.badge,
            styles.deleteBadge,
            {
              backgroundColor: colors.danger,
            },
            uiShadowStyles.floatingControlBottom,
          ]}>
          <Txt variant="subheading" tone="onAccent" weight="700">
            −
          </Txt>
        </Pressable>
      ) : null}

      {isEditing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.edit.toggleSize')}
          onPress={() => {
            triggerHaptic();
            onToggleSize();
          }}
          style={[
            styles.badge,
            styles.resizeBadge,
            {
              backgroundColor: colors.accent,
            },
            uiShadowStyles.floatingControlBottom,
          ]}>
          <Txt variant="body" tone="onAccent" weight="700">
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
    minHeight: dashboardCardSizes.small.height,
  },
  largeCardContent: {
    width: '100%',
  },
  smallCardContent: {
    width: '100%',
    minHeight: dashboardCardSizes.small.height,
  },
  badge: {
    position: 'absolute',
    top: -4,
    width: 28,
    height: 28,
    borderRadius: radius.md,
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
