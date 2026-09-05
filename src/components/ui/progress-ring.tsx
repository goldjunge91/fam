import { type ReactNode, useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/components/theme/ThemeProvider';
import { computeRingMetrics, type RingPreset, RingPresetSize } from '@/constants/rings';
import { Txt } from '@/constants/ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ProgressRingProps = {
  /** Erreichter Wert, z. B. aufgenommene Kalorien oder ablaufende Artikel. */
  value: number;
  /** Ziel- oder Maximalwert. Bei 0 oder negativ wird der Ring leer dargestellt. */
  target: number;
  /** Standardisiertes Größen-Preset ('compact', 'dashboard', 'medium', 'large'). */
  preset?: RingPreset;
  /** Benutzerdefinierter Durchmesser in pt (überschreibt das Preset). */
  size?: number;
  /** Benutzerdefinierte Strichstärke in pt (überschreibt das Preset). */
  strokeWidth?: number;
  /** Beschreibung für Screenreader. */
  label?: string;
  unit?: string;

  displayMode?: 'value' | 'percent' | 'remaining' | 'count' | 'none';
  /** Ob der Füllstand beim Mounten/Ändern animiert werden soll (Default: true). */
  animated?: boolean;
  progressColor?: string;
  trackColor?: string;
  /** Eigener Inhalt im Ringzentrum (überschreibt displayMode). */
  children?: ReactNode;
};

/**
 * Universeller Fortschrittsring für Kalorien, Tagesziele und Bestands-Karten (#91, #164).
 */
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
  const { colors } = useTheme();
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
  const activeColor = exceeded ? colors.warning : (progressColor ?? colors.accent);
  const backgroundTrackColor = trackColor ?? colors.backgroundSoft;

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
          <Txt
            variant="body"
            weight="700"
            className="text-center"
            style={{ fontVariant: ['tabular-nums'] }}>
            {value}
          </Txt>
        ) : displayMode === 'percent' ? (
          <Txt variant="body" weight="700">
            {Math.round(clamped * 100)}%
          </Txt>
        ) : displayMode === 'remaining' ? (
          <>
            <Txt variant="title">{target > 0 ? Math.abs(remaining) : Math.round(value)}</Txt>
            <Txt variant="label" tone={exceeded ? 'warning' : 'secondary'} weight="600">
              {target > 0 ? `${unit} ${exceeded ? 'darüber' : 'übrig'}` : unit}
            </Txt>
          </>
        ) : displayMode === 'value' ? (
          <>
            <Txt variant="title" weight="600">
              {Math.round(value)}
            </Txt>
            <Txt variant="body" tone="secondary" weight="500">
              {target > 0 ? `von ${Math.round(target)} ${unit}` : unit}
            </Txt>
            {target > 0 ? (
              <Txt
                variant="body"
                tone={exceeded ? 'warning' : 'secondary'}
                weight="500"
                className="mt-half">
                {exceeded ? `${Math.abs(remaining)} darüber` : `${remaining} übrig`}
              </Txt>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}
