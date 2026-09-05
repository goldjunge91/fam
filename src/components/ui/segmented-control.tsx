import {
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  View,
} from 'react-native';
import { radius, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';

/**
 * Boxshadow des aktiven "surface"-Segments als Inline-Style statt als
 * conditional getoggelte `shadow-surface`-Klasse: NativeWind/css-interop
 * crasht beim Toggeln von `shadow-*`-Klassen ueber Renders hinweg mit einem
 * irrefuehrenden "Couldn't find a navigation context"-Fehler (bekannter Bug,
 * siehe github.com/nativewind/nativewind/issues/1557 und
 * github.com/nativewind/react-native-css/issues/264). Wert entspricht
 * `boxShadow.surface` in tailwind.config.js.
 */
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

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  root: {
    flexDirection: 'row',
  },
  rootSurface: {
    height: 48,
    gap: space.sm,
    borderRadius: radius.md,
    padding: space.xs,
  },
  rootCompact: {
    height: 38,
    borderRadius: radius.sm,
    padding: 3,
    gap: space.xs,
  },
  rootDefault: {
    height: 40,
    borderRadius: 14,
    padding: 3,
    gap: space.xs,
  },
  scrollableRoot: {
    alignSelf: 'flex-start',
  },
  segment: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segmentSurface: {
    minHeight: 40,
  },
  segmentCompact: {
    minHeight: 32,
  },
  segmentDefault: {
    minHeight: 34,
  },
  fixedSegment: {
    flex: 1,
  },
  scrollableSegment: {
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 104,
  },
  pressed: {
    opacity: 0.75,
  },
});

/** Gleichbreite Einzelauswahl fuer kompakte Ansichtsmodi. */
export function SegmentedControl<T extends string>({
  label,
  options,
  selected,
  onSelect,
  appearance = 'accent',
  scrollable = false,
  size = 'default',
  gap: _gap,
  labelStyle: _labelStyle,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  const activeSurfaceShadow = {
    boxShadow: `0 3px 10px ${withAlpha(colors.shadowCard, 0.09)}`,
  };
  const rootStyle =
    appearance === 'surface'
      ? styles.rootSurface
      : size === 'compact'
        ? styles.rootCompact
        : styles.rootDefault;
  const segmentHeightStyle =
    appearance === 'surface'
      ? styles.segmentSurface
      : size === 'compact'
        ? styles.segmentCompact
        : styles.segmentDefault;

  const control = (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[
        styles.root,
        rootStyle,
        scrollable && styles.scrollableRoot,
        { backgroundColor: colors.backgroundSoft },
      ]}>
      {options.map((option) => {
        const active = option.value === selected;
        const isActiveSurface = active && appearance === 'surface';
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [
              styles.segment,
              segmentHeightStyle,
              scrollable ? styles.scrollableSegment : styles.fixedSegment,
              isActiveSurface ? activeSurfaceShadow : undefined,
              {
                backgroundColor: active
                  ? appearance === 'surface'
                    ? colors.backgroundElement
                    : colors.accent
                  : 'transparent',
              },
              pressed && styles.pressed,
            ]}>
            <Txt
              variant={appearance === 'surface' ? 'label' : 'caption'}
              tone={active ? (appearance === 'surface' ? 'primary' : 'onAccent') : 'secondary'}
              weight="600"
              style={_labelStyle}>
              {option.label}
            </Txt>
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
