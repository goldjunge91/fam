import {
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
} from 'react-native';
import { Typography } from '@/components/themed-text';
import { Radius, withAlpha } from '@/constants/theme';

import { useTheme } from '@/hooks/use-theme';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
};

type SegmentedControlProps<T extends string> = {
  label: string;
  options: readonly SegmentOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  appearance?: 'accent' | 'surface';
  scrollable?: boolean;
  size?: 'default' | 'compact';
  gap?: number;
  labelStyle?: StyleProp<TextStyle>;
};

/** Gleichbreite Einzelauswahl fuer kompakte Ansichtsmodi. */
export function SegmentedControl<T extends string>({
  label,
  options,
  selected,
  onSelect,
  appearance = 'accent',
  scrollable = false,
  size = 'default',
  gap,
  labelStyle,
}: SegmentedControlProps<T>) {
  const theme = useTheme();

  const control = (
    <View
      role="tablist"
      aria-label={label}
      style={[
        styles.root,
        appearance === 'surface' && styles.surfaceRoot,
        size === 'compact' && styles.compactRoot,
        scrollable && styles.scrollRoot,
        { backgroundColor: theme.backgroundSelected },
        gap !== undefined && { gap },
      ]}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            role="tab"
            aria-label={option.accessibilityLabel ?? option.label}
            aria-selected={active}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [
              styles.segment,
              appearance === 'surface' && styles.surfaceSegment,
              size === 'compact' && styles.compactSegment,
              scrollable && styles.scrollSegment,
              active && {
                backgroundColor: appearance === 'surface' ? theme.backgroundElement : theme.accent,
              },
              active &&
                appearance === 'surface' && {
                  boxShadow: `0 3px 10px ${withAlpha(theme.shadowCard, 0.09)}`,
                },
              pressed && styles.pressed,
            ]}>
            <Text
              style={[
                styles.label,
                appearance === 'surface' && styles.surfaceLabel,
                size === 'compact' && styles.compactLabel,
                {
                  color: active
                    ? appearance === 'surface'
                      ? theme.text
                      : '#FFFFFF'
                    : theme.textSecondary,
                },
                labelStyle,
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (!scrollable) return control;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}>
      {control}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 40,
    flexDirection: 'row',
    gap: 4,
    borderRadius: Radius.controlLarge,
    borderCurve: 'continuous',
    padding: 3,
  },
  surfaceRoot: {
    height: 48,
    gap: 8,
    borderRadius: Radius.card,
    padding: 4,
  },
  compactRoot: {
    height: 38,
    borderRadius: Radius.control,
    padding: 3,
  },
  scrollRoot: {
    alignSelf: 'flex-start',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  segment: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.control,
    borderCurve: 'continuous',
  },
  surfaceSegment: {
    minHeight: 40,
    borderRadius: Radius.control,
  },
  compactSegment: {
    minHeight: 32,
    borderRadius: Radius.control,
  },
  scrollSegment: {
    flex: 0,
    minWidth: 104,
  },
  label: {
    ...Typography.captionCompact,
    fontWeight: 600,
  },
  surfaceLabel: {
    ...Typography.label,
  },
  compactLabel: {
    ...Typography.captionCompact,
  },
  pressed: {
    opacity: 0.76,
  },
});
