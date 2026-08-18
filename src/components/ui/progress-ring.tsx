import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/theme/themed-text';
import { useTheme } from '@/hooks/use-theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ProgressRingProps = {
  /** Erreichter Wert, z. B. aufgenommene Kalorien. */
  value: number;
  /** Zielwert. Bei 0 oder negativ wird der Ring leer dargestellt. */
  target: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  unit?: string;
  /**
   * 'value' (Default): grosse Zahl + Rest im Ring, wie bisher — Rezept-Log.
   * 'percent': nur die Prozentzahl, fuer kompakte Widgets wie das Dashboard.
   * 'remaining': Restwert + Einheit, fuer Tagesbilanzen wie das Tagebuch.
   */
  displayMode?: 'value' | 'percent' | 'remaining';
  progressColor?: string;
  trackColor?: string;
};

/**
 * Fortschrittsring fuer Kalorien und andere Tagesziele (#91).
 *
 * Ueberschreitung wird sichtbar gemacht, statt den Ring still bei 100 % stehen
 * zu lassen: der Fuellstand ist bei 1.0 gedeckelt, aber die Farbe wechselt und
 * der Text nennt die Ueberschreitung. Wer sein Ziel ueberschritten hat, soll das
 * sehen — ohne dass die App es bewertet.
 */
export function ProgressRing({
  value,
  target,
  size = 160,
  strokeWidth = 14,
  label,
  unit = 'kcal',
  displayMode = 'value',
  progressColor,
  trackColor,
}: ProgressRingProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const ratio = target > 0 ? value / target : 0;
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const exceeded = ratio > 1;

  const progress = useSharedValue(0);

  useEffect(() => {
    // `useReducedMotion` respektiert die Systemeinstellung "Bewegung reduzieren".
    // Ohne das laufen Fuellanimationen auch bei Nutzern, die genau das abgestellt
    // haben — fuer manche ein echtes Problem, nicht nur Geschmack.
    progress.value = reducedMotion ? clamped : withTiming(clamped, { duration: 700 });
  }, [clamped, reducedMotion, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const remaining = Math.round(target - value);
  const accessibilityLabel =
    target > 0
      ? `${label}: ${Math.round(value)} von ${Math.round(target)} ${unit}, ${
          exceeded ? `${Math.abs(remaining)} ${unit} darüber` : `${remaining} ${unit} übrig`
        }`
      : `${label}: ${Math.round(value)} ${unit}, kein Ziel gesetzt`;

  return (
    <View
      className="items-center justify-center self-center"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor ?? theme.backgroundSelected}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={exceeded ? theme.warning : (progressColor ?? theme.accent)}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // Bei -90 Grad beginnt der Ring oben statt rechts.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View className="absolute inset-0 items-center justify-center gap-half [pointer-events:none]">
        {displayMode === 'percent' ? (
          <ThemedText type="smallBold" className="text-body-lg">
            {Math.round(clamped * 100)}%
          </ThemedText>
        ) : displayMode === 'remaining' ? (
          <>
            <ThemedText className="text-[24px] leading-[28px] font-bold tracking-[-0.5px]">
              {target > 0 ? Math.abs(remaining) : Math.round(value)}
            </ThemedText>
            <ThemedText
              themeColor={exceeded ? 'warning' : 'textSecondary'}
              className="text-micro leading-[12px] font-semibold">
              {target > 0 ? `${unit} ${exceeded ? 'darüber' : 'übrig'}` : unit}
            </ThemedText>
          </>
        ) : (
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
        )}
      </View>
    </View>
  );
}
