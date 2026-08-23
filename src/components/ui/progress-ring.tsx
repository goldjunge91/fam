import { type ReactNode, useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/theme/themed-text';
import { computeRingMetrics, type RingPreset, RingPresetSize } from '@/constants/rings';
import { useTheme } from '@/hooks/use-theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ProgressRingProps = {
  value: number;
  target: number;
  preset?: RingPreset;
  size?: number;
  strokeWidth?: number;
  label?: string;
  unit?: string;
  displayMode?: 'value' | 'percent' | 'remaining' | 'count' | 'none';
  animated?: boolean;
  progressColor?: string;
  trackColor?: string;
  children?: ReactNode;
};

export function ProgressRing({
  value,
  target,
  preset,
  size: customSize,
  strokeWidth: customStrokeWidth,
  label = '',
  unit = 'kcal',
  displayMode = 'value',
  animated = true,
  progressColor,
  trackColor,
  children,
}: ProgressRingProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();

  const presetDimensions = preset ? RingPresetSize[preset] : RingPresetSize.large;
  const size = customSize ?? presetDimensions.size;
  const strokeWidth = customStrokeWidth ?? presetDimensions.strokeWidth;

  const { radius, circumference } = computeRingMetrics(size, strokeWidth);

  const ratio = target > 0 ? value / target : 0;
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const exceeded = ratio > 1;

  const progress = useSharedValue(animated ? 0 : clamped);

  useEffect(() => {
    if (!animated) {
      progress.value = clamped;
      return;
    }
    progress.value = reducedMotion ? clamped : withTiming(clamped, { duration: 700 });
  }, [clamped, reducedMotion, progress, animated]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const remaining = Math.round(target - value);
  const activeColor = exceeded ? theme.warning : (progressColor ?? theme.accent);
  const backgroundTrackColor = trackColor ?? theme.backgroundSelected;

  const accessibilityLabel =
    label.length > 0
      ? target > 0
        ? `${label}: ${Math.round(value)} von ${Math.round(target)} ${unit}, ${
            exceeded ? `${Math.abs(remaining)} ${unit} darüber` : `${remaining} ${unit} übrig`
          }`
        : `${label}: ${Math.round(value)} ${unit}`
      : `${Math.round(value)} von ${Math.round(target)}`;

  return (
    <View
      className="items-center justify-center self-center"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: target, now: value }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundTrackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {animated ? (
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={activeColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animatedProps={animatedProps}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : clamped > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={activeColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${clamped * circumference} ${circumference - clamped * circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>

      <View className="absolute inset-0 items-center justify-center gap-half [pointer-events:none]">
        {children !== undefined ? (
          children
        ) : displayMode === 'count' ? (
          <ThemedText
            type="body"
            className="font-bold text-center"
            style={{ fontVariant: ['tabular-nums'] }}>
            {value}
          </ThemedText>
        ) : displayMode === 'percent' ? (
          <ThemedText type="smallBold" className="text-body-lg">
            {Math.round(clamped * 100)}%
          </ThemedText>
        ) : displayMode === 'remaining' ? (
          <>
            <ThemedText
              style={{ fontSize: 32, lineHeight: 36, fontWeight: '700', letterSpacing: -0.5 }}>
              {target > 0 ? Math.abs(remaining) : Math.round(value)}
            </ThemedText>
            <ThemedText
              themeColor={exceeded ? 'warning' : 'textSecondary'}
              style={{ fontSize: 13, lineHeight: 16, fontWeight: '600' }}>
              {target > 0 ? `${unit} ${exceeded ? 'darüber' : 'übrig'}` : unit}
            </ThemedText>
          </>
        ) : displayMode === 'value' ? (
          <>
            <ThemedText type="subtitle">{Math.round(value)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {target > 0 ? `von ${Math.round(target)} ${unit}` : unit}
            </ThemedText>
            {target > 0 ? (
              <ThemedText
                type="small"
                themeColor={exceeded ? 'warning' : 'textSecondary'}
                className="mt-half">
                {exceeded ? `${Math.abs(remaining)} darüber` : `${remaining} übrig`}
              </ThemedText>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}
